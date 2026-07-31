"""Pydantic schemas for Exam API request/response validation."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class BlueprintRow(BaseModel):
    """Single row in the exam blueprint (subject + difficulty + count)."""
    subject: str
    difficulty: str  # easy | medium | hard
    count: int = Field(..., ge=1)


class ExamCreate(BaseModel):
    """Request body for creating an exam — matches frontend ExamCreateRequest."""
    name: str
    exam_date: str = Field(default="", description="ISO date string e.g. 2026-07-15")
    duration_minutes: int = Field(..., ge=1)
    blueprint: list[BlueprintRow] | dict[str, Any]  # list from UI or legacy dict


class ExamResponse(BaseModel):
    """Response body for exam details."""
    id: str
    name: str
    subject: str
    status: str
    duration_minutes: str
    created_at: str

    model_config = {"from_attributes": True}
