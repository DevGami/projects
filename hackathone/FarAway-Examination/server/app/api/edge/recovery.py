"""
Edge API — State Recovery

Crash recovery: snapshot retrieval and session restoration.
Protected by edge-local RSA-signed JWT.

Endpoints:
  GET  /recovery/{candidate_id}      — Get latest recovery snapshot
  POST /recovery/restore/{session_id} — Restore a crashed session
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.db.database import get_db
from server.app.schemas.recovery import (
    RecoverySnapshotResponse,
    RestoreSessionResponse,
    AnswerSnapshot,
)
from server.app.services.recovery_service import RecoveryService

router = APIRouter(prefix="/recovery")


@router.get("/{candidate_id}", response_model=RecoverySnapshotResponse)
async def get_recovery_snapshot(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get latest recovery snapshot for a candidate's session."""
    svc = RecoveryService(db)
    snapshot = await svc.get_snapshot(candidate_id)

    if snapshot is None:
        raise HTTPException(
            status_code=404,
            detail=f"No recovery snapshot found for candidate: {candidate_id}",
        )

    return RecoverySnapshotResponse(
        snapshot_id=snapshot["snapshot_id"],
        session_id=snapshot["session_id"],
        candidate_id=snapshot["candidate_id"],
        answers=[
            AnswerSnapshot(
                question_id=a["question_id"],
                selected_option=a.get("selected_option"),
                answered_at=a.get("answered_at", ""),
            )
            for a in snapshot["answers"]
        ],
        current_question_index=snapshot["current_question_index"],
        remaining_seconds=snapshot["remaining_seconds"],
        snapshot_hash=snapshot["snapshot_hash"],
        integrity_verified=snapshot["integrity_verified"],
        created_at=snapshot["created_at"],
        updated_at=snapshot.get("updated_at"),
    )


@router.post("/restore/{session_id}", response_model=RestoreSessionResponse)
async def restore_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Restore a crashed session from the latest snapshot."""
    svc = RecoveryService(db)

    try:
        result = await svc.restore_session(session_id)
        await db.commit()

        return RestoreSessionResponse(
            session_id=result["session_id"],
            status=result["status"],
            answers=[
                AnswerSnapshot(
                    question_id=a["question_id"],
                    selected_option=a.get("selected_option"),
                    answered_at=a.get("answered_at", ""),
                )
                for a in result["answers"]
            ],
            current_question_index=result["current_question_index"],
            remaining_seconds=result["remaining_seconds"],
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
