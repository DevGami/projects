"""Pydantic schemas for Center API request/response validation."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CenterCreate(BaseModel):
    """Request body for creating a center."""
    name: str
    code: str = ""
    city: str = ""
    state: str = ""
    seat_count: int = Field(..., ge=1)
    address: str = ""
    seating_layout: dict[str, Any] | None = None
    status: str = "active"
    rsa_public_key: str | None = None


class CenterUpdate(BaseModel):
    """Request body for updating a center."""
    name: str | None = None
    city: str | None = None
    state: str | None = None
    seat_count: int | None = None
    address: str | None = None
    seating_layout: dict[str, Any] | None = None
    status: str | None = None
    rsa_public_key: str | None = None


class CenterResponse(BaseModel):
    """Response body for center details."""
    id: str
    name: str
    code: str
    seat_count: int
    city: str = ""
    state: str = ""
    address: str = ""
    risk_score: float = 0.0
    status: str = "active"
    seating_layout: dict[str, Any] | None = None
    rsa_public_key: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class CenterListResponse(BaseModel):
    """Paginated center list."""
    items: list[CenterResponse]
    total: int
    page: int
    page_size: int
