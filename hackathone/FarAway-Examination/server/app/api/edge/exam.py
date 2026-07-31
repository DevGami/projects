"""
Edge API — Exam Execution

Variant loading, answer submission, exam completion.
Protected by edge-local RSA-signed JWT.

Endpoints:
  GET  /exam/sessions              — List all active sessions (GAP-4 proctor dashboard)  ← NEW
  GET  /exam/session/{session_id}  — Load exam session with variant
  POST /exam/answer                — Submit/update answer + auto-snapshot
  POST /exam/submit                — Final exam submission
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.db.database import get_db
from server.app.models.session import ExamSession
from server.app.models.candidate import Candidate
from server.app.models.exam import Exam
from server.app.models.question import Question
from server.app.services.question_service import QuestionService
from server.app.schemas.recovery import (
    ExamSessionResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    SubmitExamRequest,
    SubmitExamResponse,
)
from server.app.schemas.session import SessionListResponse, SessionResponse
from server.app.services.recovery_service import RecoveryService

router = APIRouter(prefix="/exam")


# ---------------------------------------------------------------------------
# GAP-4: List all active sessions (needed by proctor dashboard D1)
# ---------------------------------------------------------------------------

@router.get(
    "/sessions",
    response_model=SessionListResponse,
    summary="List all exam sessions",
    description=(
        "Returns a paginated list of exam sessions on this edge node. "
        "Supports filtering by status and exam_id. "
        "Used by the Proctor Dashboard (D1) to show who is currently in exam."
    ),
)
async def list_sessions(
    status: str | None = Query(
        default=None,
        description="Filter by status: active | submitted | recovered",
        pattern="^(active|submitted|recovered)$",
    ),
    exam_id: str | None = Query(
        default=None,
        description="Filter by exam UUID",
    ),
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=50, ge=1, le=200, description="Sessions per page"),
    db: AsyncSession = Depends(get_db),
) -> SessionListResponse:
    """
    List exam sessions with optional filters.

    This endpoint implements GAP-4 from the frontend implementation plan.
    Returns all sessions on this edge node ordered by start time (newest first).
    """
    page_size = min(page_size, 200)
    offset = (page - 1) * page_size

    query = select(ExamSession).order_by(ExamSession.started_at.desc())
    count_query = select(func.count(ExamSession.id))

    if status is not None:
        query = query.where(ExamSession.status == status)
        count_query = count_query.where(ExamSession.status == status)
    if exam_id is not None:
        query = query.where(ExamSession.exam_id == exam_id)
        count_query = count_query.where(ExamSession.exam_id == exam_id)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    result = await db.execute(query.offset(offset).limit(page_size))
    sessions = result.scalars().all()

    session_list = [
        SessionResponse(
            id=s.id,
            candidate_id=s.candidate_id,
            exam_id=s.exam_id,
            variant_id=s.variant_id,
            status=s.status,
            current_question_index=s.current_question_index,
            started_at=s.started_at.isoformat() if s.started_at else "",
            submitted_at=s.submitted_at.isoformat() if s.submitted_at else None,
        )
        for s in sessions
    ]

    return SessionListResponse(
        sessions=session_list,
        total=total,
        page=page,
        page_size=page_size,
        filter_status=status,
        filter_exam_id=exam_id,
    )


# ---------------------------------------------------------------------------
# Existing endpoints — NOT MODIFIED (as per requirement)
# ---------------------------------------------------------------------------

@router.get("/session/{session_id}", response_model=ExamSessionResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Load exam session with candidate's variant (graph-colored question order)."""
    stmt = select(ExamSession).where(ExamSession.id == session_id)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    candidate = await db.scalar(select(Candidate).where(Candidate.id == session.candidate_id))
    exam = await db.scalar(select(Exam).where(Exam.id == session.exam_id))

    if not candidate or not exam:
        raise HTTPException(status_code=500, detail="Incomplete session data")

    # Fetch 30 questions for this exam (in real life, fetch variant mapping)
    q_result = await db.execute(select(Question).limit(30))
    db_questions = q_result.scalars().all()

    # Decrypt questions
    aes_key = b"12345678901234567890123456789012"
    q_service = QuestionService(db, aes_key)
    
    # Load recovered state if it exists
    rec_svc = RecoveryService(db)
    recovery_state = None
    try:
        recovery_state = await rec_svc.get_state(session_id)
    except Exception:
        pass
    
    decrypted_questions = []
    for i, q in enumerate(db_questions):
        try:
            q_data = await q_service.get(str(q.id))
            raw_options = q_data.get("options", [])
            if isinstance(raw_options, list):
                mapped_options = {
                    "A": raw_options[0] if len(raw_options) > 0 else "",
                    "B": raw_options[1] if len(raw_options) > 1 else "",
                    "C": raw_options[2] if len(raw_options) > 2 else "",
                    "D": raw_options[3] if len(raw_options) > 3 else "",
                }
            else:
                mapped_options = raw_options

            # Re-attach selected option
            sel_opt = None
            if recovery_state and "answers" in recovery_state:
                sel_opt = recovery_state["answers"].get(str(q.id))

            decrypted_questions.append({
                "id": str(q.id),
                "index": i,
                "content": q_data["content"],
                "options": mapped_options,
                "subject": q.subject,
                "difficulty": q.difficulty,
                "selected_option": sel_opt,
            })
        except Exception as e:
            print(f"Failed to decrypt question {q.id}: {e}")

    # Calculate remaining time
    # This is a demo, we assume 180 min duration = 10800s
    dur_secs = int(exam.duration_minutes) * 60
    
    return ExamSessionResponse(
        session_id=session.id,
        candidate_id=session.candidate_id,
        candidate_name=candidate.name,
        exam_id=session.exam_id,
        exam_title=exam.name,
        variant_id=session.variant_id,
        status=session.status,
        current_question_index=session.current_question_index,
        total_questions=len(decrypted_questions),
        duration_seconds=dur_secs,
        remaining_seconds=dur_secs,  # In real life, calculate based on started_at
        started_at=session.started_at.isoformat() if session.started_at else "",
        questions=decrypted_questions
    )


@router.post("/answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    request: SubmitAnswerRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit or update an answer. Auto-saved to SQLite immediately."""
    svc = RecoveryService(db)

    try:
        # 1. Save/update the answer
        answer = await svc.save_answer(
            session_id=request.session_id,
            question_id=request.question_id,
            selected_option=request.selected_option,
        )

        # 2. Save recovery snapshot (auto-save on every answer)
        snapshot = await svc.save_snapshot(
            session_id=request.session_id,
            current_question_index=request.current_question_index,
            remaining_seconds=request.remaining_seconds,
        )

        await db.commit()

        return SubmitAnswerResponse(
            saved=True,
            answer_id=answer.id,
            snapshot_saved=True,
            answer_hash=answer.answer_hash,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/submit", response_model=SubmitExamResponse)
async def submit_exam(
    request: SubmitExamRequest,
    db: AsyncSession = Depends(get_db),
):
    """Final exam submission. Freezes timer, generates submission hash."""
    svc = RecoveryService(db)

    try:
        result = await svc.submit_exam(request.session_id)
        await db.commit()

        return SubmitExamResponse(
            submission_id=result["submission_id"],
            total_answers=result["total_answers"],
            submission_hash=result["submission_hash"],
            submitted_at=result.get("submitted_at")
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
