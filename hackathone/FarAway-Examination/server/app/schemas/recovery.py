"""Pydantic schemas for State Recovery (Module 05) API endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Answer submission
# ---------------------------------------------------------------------------

class SubmitAnswerRequest(BaseModel):
    """Request body for POST /exam/answer."""

    session_id: str = Field(..., description="Active exam session UUID")
    question_id: str = Field(..., description="Question UUID being answered")
    selected_option: str | None = Field(
        None, description="Selected option (A/B/C/D) or null to clear"
    )
    current_question_index: int = Field(
        ..., ge=0, description="0-based index of the current question"
    )
    remaining_seconds: int = Field(
        ..., ge=0, description="Remaining exam time in seconds"
    )


class SubmitAnswerResponse(BaseModel):
    """Response for POST /exam/answer."""

    saved: bool
    answer_id: str
    snapshot_saved: bool
    answer_hash: str


# ---------------------------------------------------------------------------
# Exam submission
# ---------------------------------------------------------------------------

class SubmitExamRequest(BaseModel):
    """Request body for POST /exam/submit."""

    session_id: str = Field(..., description="Active exam session UUID")


class SubmitExamResponse(BaseModel):
    """Response for POST /exam/submit."""

    submission_id: str
    total_answers: int
    submission_hash: str
    submitted_at: str | None = None
    submitted: bool = True


# ---------------------------------------------------------------------------
# Session loading
# ---------------------------------------------------------------------------

class ExamSessionResponse(BaseModel):
    """Response for GET /exam/session/{session_id}."""

    session_id: str
    candidate_id: str
    candidate_name: str
    exam_id: str
    exam_title: str
    variant_id: int
    status: str
    current_question_index: int
    total_questions: int
    duration_seconds: int
    remaining_seconds: int
    started_at: str
    questions: list[dict]


# ---------------------------------------------------------------------------
# Recovery
# ---------------------------------------------------------------------------

class AnswerSnapshot(BaseModel):
    """Single answer within a recovery snapshot."""

    question_id: str
    selected_option: str | None
    answered_at: str


class RecoverySnapshotResponse(BaseModel):
    """Response for GET /recovery/{candidate_id}."""

    snapshot_id: str
    session_id: str
    candidate_id: str
    answers: list[AnswerSnapshot]
    current_question_index: int
    remaining_seconds: int
    snapshot_hash: str
    integrity_verified: bool
    created_at: str
    updated_at: str | None = None


class RestoreSessionResponse(BaseModel):
    """Response for POST /recovery/restore/{session_id}."""

    session_id: str
    status: str
    answers: list[AnswerSnapshot]
    current_question_index: int
    remaining_seconds: int
    restored: bool = True
