"""
Snapshot Manager — pure-logic snapshot operations for exam state recovery.

Builds, hashes, and validates recovery snapshots without any database
dependency. This enables unit testing without DB fixtures and reuse across
edge server and potential desktop recovery paths.

Snapshot hash formula:
    SHA-256(canonical JSON of { answers_json, current_question_index, remaining_seconds })
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from shared.crypto.hashing import HashUtils


class SnapshotManager:
    """Build, hash, and validate recovery snapshots (pure logic, no DB)."""

    @staticmethod
    def build_snapshot(
        session_id: str,
        candidate_id: str,
        answers: list[dict[str, Any]],
        current_question_index: int,
        remaining_seconds: int,
    ) -> dict[str, Any]:
        """
        Build a recovery snapshot dict from current exam state.

        Args:
            session_id: Active session UUID
            candidate_id: Candidate UUID
            answers: List of answer dicts [{ question_id, selected_option, answered_at }]
            current_question_index: 0-based index of the question being viewed
            remaining_seconds: Timer countdown in seconds

        Returns:
            Complete snapshot dict ready for DB persistence

        Raises:
            ValueError: If session_id or candidate_id is empty, or
                        remaining_seconds is negative
        """
        if not session_id:
            raise ValueError("session_id cannot be empty")
        if not candidate_id:
            raise ValueError("candidate_id cannot be empty")
        if remaining_seconds < 0:
            raise ValueError(
                f"remaining_seconds cannot be negative, got {remaining_seconds}"
            )
        if current_question_index < 0:
            raise ValueError(
                f"current_question_index cannot be negative, got {current_question_index}"
            )

        # Canonical JSON for answers (sorted keys for determinism)
        answers_json = json.dumps(
            answers, sort_keys=True, separators=(",", ":")
        )

        # Compute integrity hash over the mutable state
        snapshot_hash = SnapshotManager.compute_hash(
            answers_json, current_question_index, remaining_seconds
        )

        now = datetime.now(timezone.utc).isoformat()

        return {
            "session_id": session_id,
            "candidate_id": candidate_id,
            "answers_json": answers_json,
            "current_question_index": current_question_index,
            "remaining_seconds": remaining_seconds,
            "snapshot_hash": snapshot_hash,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def compute_hash(
        answers_json: str,
        current_question_index: int,
        remaining_seconds: int,
    ) -> str:
        """
        Compute SHA-256 integrity hash over the mutable snapshot state.

        The hash covers answers, question position, and timer — the three
        fields that must be verified on recovery to detect corruption.

        Formula:
            SHA-256(canonical JSON of {
                answers_json, current_question_index, remaining_seconds
            })
        """
        hash_input = {
            "answers_json": answers_json,
            "current_question_index": current_question_index,
            "remaining_seconds": remaining_seconds,
        }
        return HashUtils.sha256_json(hash_input)

    @staticmethod
    def verify_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
        """
        Verify a snapshot's integrity hash matches its content.

        Args:
            snapshot: Snapshot dict with answers_json, current_question_index,
                      remaining_seconds, and snapshot_hash fields

        Returns:
            { "is_valid": bool, "expected_hash": str, "actual_hash": str }
        """
        expected_hash = SnapshotManager.compute_hash(
            snapshot["answers_json"],
            snapshot["current_question_index"],
            snapshot["remaining_seconds"],
        )
        actual_hash = snapshot.get("snapshot_hash", "")

        return {
            "is_valid": expected_hash == actual_hash,
            "expected_hash": expected_hash,
            "actual_hash": actual_hash,
        }

    @staticmethod
    def parse_answers(answers_json: str) -> list[dict[str, Any]]:
        """
        Parse the answers_json string back into a list of answer dicts.

        Args:
            answers_json: JSON string of answers

        Returns:
            List of answer dicts

        Raises:
            ValueError: If JSON is invalid
        """
        try:
            answers = json.loads(answers_json)
        except (json.JSONDecodeError, TypeError) as e:
            raise ValueError(f"Invalid answers JSON: {e}") from e

        if not isinstance(answers, list):
            raise ValueError(
                f"answers_json must deserialize to a list, got {type(answers).__name__}"
            )

        return answers

    @staticmethod
    def calculate_remaining_time(
        exam_duration_seconds: int,
        started_at: datetime,
        now: datetime | None = None,
    ) -> int:
        """
        Calculate remaining exam time based on start time and total duration.

        Useful for validating client-reported remaining_seconds against
        server-side tracking.

        Args:
            exam_duration_seconds: Total exam duration in seconds
            started_at: When the exam session started (UTC)
            now: Current time (default: UTC now)

        Returns:
            Remaining seconds (clamped to >= 0)
        """
        if now is None:
            now = datetime.now(timezone.utc)

        elapsed = (now - started_at).total_seconds()
        remaining = exam_duration_seconds - int(elapsed)
        return max(0, remaining)
