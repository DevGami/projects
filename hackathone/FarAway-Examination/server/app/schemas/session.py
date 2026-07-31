"""Pydantic schemas for Exam Session API (GAP-4)."""

from __future__ import annotations

from pydantic import BaseModel


class SessionResponse(BaseModel):
    """Active exam session summary for proctor dashboard."""

    id: str
    candidate_id: str
    exam_id: str
    variant_id: int
    status: str               # active | submitted | recovered
    current_question_index: int
    started_at: str
    submitted_at: str | None = None

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    """Paginated list of exam sessions."""

    sessions: list[SessionResponse]
    total: int
    page: int
    page_size: int
    filter_status: str | None = None
    filter_exam_id: str | None = None
