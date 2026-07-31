"""
Recovery Service — state persistence + crash restoration (edge only).

Saves snapshots on every answer submission.
Restores session state in < 60 seconds after crash.

Architecture:
  - SQLite is sole datastore (D-010: Redis removed from edge).
  - One snapshot per session (UPSERT via unique session_id constraint).
  - Snapshot hash verified on every restore to detect corruption.
  - All recovery events are audit-logged.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.models.answer import Answer
from server.app.models.recovery_snapshot import RecoverySnapshot
from server.app.models.session import ExamSession
from shared.crypto.hashing import HashUtils
from shared.recovery.snapshot_manager import SnapshotManager

logger = logging.getLogger(__name__)


class RecoveryService:
    """Exam state recovery from SQLite snapshots."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # -------------------------------------------------------------------
    # Answer persistence
    # -------------------------------------------------------------------

    async def save_answer(
        self,
        session_id: str,
        question_id: str,
        selected_option: str | None,
    ) -> Answer:
        """
        Save or update an answer (UPSERT by session_id + question_id).

        Args:
            session_id: Active exam session UUID
            question_id: Question UUID
            selected_option: Selected option (A/B/C/D) or None to clear

        Returns:
            The saved Answer model instance

        Raises:
            ValueError: If session does not exist or is already submitted
        """
        # Verify session exists and is active
        session = await self._get_active_session(session_id)
        if session is None:
            raise ValueError(f"No active session found: {session_id}")

        # Compute answer hash for integrity
        answer_content = {
            "session_id": session_id,
            "question_id": question_id,
            "selected_option": selected_option,
        }
        answer_hash = HashUtils.sha256_json(answer_content)

        # UPSERT: check for existing answer
        stmt = select(Answer).where(
            Answer.session_id == session_id,
            Answer.question_id == question_id,
        )
        result = await self._db.execute(stmt)
        existing = result.scalar_one_or_none()

        now = datetime.now(timezone.utc)

        if existing:
            existing.selected_option = selected_option
            existing.answer_hash = answer_hash
            existing.answered_at = now
            answer = existing
        else:
            answer = Answer(
                id=str(uuid.uuid4()),
                session_id=session_id,
                question_id=question_id,
                selected_option=selected_option,
                answer_hash=answer_hash,
                answered_at=now,
            )
            self._db.add(answer)

        await self._db.flush()
        return answer

    # -------------------------------------------------------------------
    # Snapshot persistence
    # -------------------------------------------------------------------

    async def save_snapshot(
        self,
        session_id: str,
        current_question_index: int,
        remaining_seconds: int,
    ) -> RecoverySnapshot:
        """
        Save recovery snapshot (UPSERT by session_id).

        Collects all current answers for the session and builds a full
        snapshot. Called after every answer submission.

        Args:
            session_id: Active exam session UUID
            current_question_index: 0-based question position
            remaining_seconds: Timer countdown in seconds

        Returns:
            The saved RecoverySnapshot model instance
        """
        # Get session to extract candidate_id
        session = await self._get_active_session(session_id)
        if session is None:
            raise ValueError(f"No active session found: {session_id}")

        # Collect all answers for this session
        answers = await self._get_all_answers(session_id)

        # Build answer list for snapshot
        answer_list = [
            {
                "question_id": a.question_id,
                "selected_option": a.selected_option,
                "answered_at": a.answered_at.isoformat() if a.answered_at else None,
            }
            for a in answers
        ]

        # Build snapshot using shared logic
        snapshot_data = SnapshotManager.build_snapshot(
            session_id=session_id,
            candidate_id=session.candidate_id,
            answers=answer_list,
            current_question_index=current_question_index,
            remaining_seconds=remaining_seconds,
        )

        # UPSERT: check for existing snapshot
        stmt = select(RecoverySnapshot).where(
            RecoverySnapshot.session_id == session_id
        )
        result = await self._db.execute(stmt)
        existing = result.scalar_one_or_none()

        now = datetime.now(timezone.utc)

        if existing:
            existing.answers_json = snapshot_data["answers_json"]
            existing.current_question_index = current_question_index
            existing.remaining_seconds = remaining_seconds
            existing.snapshot_hash = snapshot_data["snapshot_hash"]
            existing.updated_at = now
            snapshot = existing
        else:
            snapshot = RecoverySnapshot(
                id=str(uuid.uuid4()),
                session_id=session_id,
                candidate_id=session.candidate_id,
                answers_json=snapshot_data["answers_json"],
                current_question_index=current_question_index,
                remaining_seconds=remaining_seconds,
                snapshot_hash=snapshot_data["snapshot_hash"],
                created_at=now,
                updated_at=now,
            )
            self._db.add(snapshot)

        await self._db.flush()
        logger.info(
            "Snapshot saved for session %s (%d answers, %ds remaining)",
            session_id,
            len(answer_list),
            remaining_seconds,
        )
        return snapshot

    # -------------------------------------------------------------------
    # Recovery
    # -------------------------------------------------------------------

    async def get_snapshot(self, candidate_id: str) -> dict | None:
        """
        Get latest recovery snapshot for a candidate.

        Looks up the most recent active (non-submitted) session for the
        candidate, then loads its snapshot. Verifies integrity hash.

        Args:
            candidate_id: Candidate UUID

        Returns:
            Snapshot dict with integrity_verified flag, or None if no
            snapshot exists
        """
        # Find latest active session for this candidate
        stmt = (
            select(ExamSession)
            .where(
                ExamSession.candidate_id == candidate_id,
                ExamSession.status.in_(["active", "recovered"]),
            )
            .order_by(ExamSession.started_at.desc())
            .limit(1)
        )
        result = await self._db.execute(stmt)
        session = result.scalar_one_or_none()

        if session is None:
            return None

        # Load snapshot for this session
        stmt = select(RecoverySnapshot).where(
            RecoverySnapshot.session_id == session.id
        )
        result = await self._db.execute(stmt)
        snapshot = result.scalar_one_or_none()

        if snapshot is None:
            return None

        # Verify integrity
        verification = SnapshotManager.verify_snapshot({
            "answers_json": snapshot.answers_json,
            "current_question_index": snapshot.current_question_index,
            "remaining_seconds": snapshot.remaining_seconds,
            "snapshot_hash": snapshot.snapshot_hash,
        })

        # Parse answers
        answers = SnapshotManager.parse_answers(snapshot.answers_json)

        return {
            "snapshot_id": snapshot.id,
            "session_id": snapshot.session_id,
            "candidate_id": snapshot.candidate_id,
            "answers": answers,
            "current_question_index": snapshot.current_question_index,
            "remaining_seconds": snapshot.remaining_seconds,
            "snapshot_hash": snapshot.snapshot_hash,
            "integrity_verified": verification["is_valid"],
            "created_at": (
                snapshot.created_at.isoformat()
                if snapshot.created_at
                else None
            ),
            "updated_at": (
                snapshot.updated_at.isoformat()
                if snapshot.updated_at
                else None
            ),
        }

    async def restore_session(self, session_id: str) -> dict:
        """
        Restore a crashed session from the latest snapshot.

        Updates session status to 'recovered' and returns the full
        snapshot state for the client to resume.

        Args:
            session_id: Session UUID to restore

        Returns:
            Restored session state dict

        Raises:
            ValueError: If session not found, already submitted,
                        or no snapshot exists
        """
        # Load session
        stmt = select(ExamSession).where(ExamSession.id == session_id)
        result = await self._db.execute(stmt)
        session = result.scalar_one_or_none()

        if session is None:
            raise ValueError(f"Session not found: {session_id}")

        if session.status == "submitted":
            raise ValueError(
                f"Cannot restore submitted session: {session_id}"
            )

        # Load snapshot
        stmt = select(RecoverySnapshot).where(
            RecoverySnapshot.session_id == session_id
        )
        result = await self._db.execute(stmt)
        snapshot = result.scalar_one_or_none()

        if snapshot is None:
            raise ValueError(
                f"No recovery snapshot found for session: {session_id}"
            )

        # Verify integrity
        verification = SnapshotManager.verify_snapshot({
            "answers_json": snapshot.answers_json,
            "current_question_index": snapshot.current_question_index,
            "remaining_seconds": snapshot.remaining_seconds,
            "snapshot_hash": snapshot.snapshot_hash,
        })

        if not verification["is_valid"]:
            raise ValueError(
                f"Snapshot integrity check failed for session {session_id}. "
                f"Expected hash: {verification['expected_hash']}, "
                f"Actual hash: {verification['actual_hash']}"
            )

        # Update session status
        session.status = "recovered"
        await self._db.flush()

        # Parse answers
        answers = SnapshotManager.parse_answers(snapshot.answers_json)

        logger.info(
            "Session %s restored (%d answers, %ds remaining)",
            session_id,
            len(answers),
            snapshot.remaining_seconds,
        )

        return {
            "session_id": session_id,
            "status": "recovered",
            "answers": answers,
            "current_question_index": snapshot.current_question_index,
            "remaining_seconds": snapshot.remaining_seconds,
            "restored": True,
        }

    # -------------------------------------------------------------------
    # Exam submission
    # -------------------------------------------------------------------

    async def submit_exam(self, session_id: str) -> dict:
        """
        Final exam submission. Freezes session, generates submission hash.

        Args:
            session_id: Active exam session UUID

        Returns:
            Submission result dict

        Raises:
            ValueError: If session not found or already submitted
        """
        session = await self._get_active_session(session_id)
        if session is None:
            raise ValueError(f"No active session found: {session_id}")

        # Collect all answers
        answers = await self._get_all_answers(session_id)

        # Build submission payload for hashing
        submission_payload = {
            "session_id": session_id,
            "candidate_id": session.candidate_id,
            "exam_id": session.exam_id,
            "answers": [
                {
                    "question_id": a.question_id,
                    "selected_option": a.selected_option,
                    "answer_hash": a.answer_hash,
                }
                for a in answers
            ],
        }
        submission_hash = HashUtils.sha256_json(submission_payload)
        submission_id = str(uuid.uuid4())

        # Freeze session
        now = datetime.now(timezone.utc)
        session.status = "submitted"
        session.submitted_at = now
        await self._db.flush()

        logger.info(
            "Exam submitted for session %s (%d answers, hash=%s)",
            session_id,
            len(answers),
            submission_hash[:16],
        )

        return {
            "submission_id": submission_id,
            "total_answers": len(answers),
            "submission_hash": submission_hash,
            "submitted_at": now.isoformat(),
            "submitted": True,
        }

    # -------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------

    async def _get_active_session(
        self, session_id: str
    ) -> ExamSession | None:
        """Load session if it exists and is not submitted."""
        stmt = select(ExamSession).where(ExamSession.id == session_id)
        result = await self._db.execute(stmt)
        session = result.scalar_one_or_none()

        if session is None:
            return None
        if session.status == "submitted":
            return None

        return session

    async def _get_all_answers(self, session_id: str) -> list[Answer]:
        """Load all answers for a session, ordered by answered_at."""
        stmt = (
            select(Answer)
            .where(Answer.session_id == session_id)
            .order_by(Answer.answered_at)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())
