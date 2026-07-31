"""Pydantic schemas for Audit API request/response validation.

All schemas use from_attributes=True for SQLAlchemy ORM compatibility.
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Event Type Enum — 14 types as specified in Module 07 spec
# ---------------------------------------------------------------------------

class EventType(str, Enum):
    """Canonical list of all audit event types in FortisExam."""

    QUESTION_CREATED = "QUESTION_CREATED"
    QUESTION_MODIFIED = "QUESTION_MODIFIED"
    EXAM_COMPILED = "EXAM_COMPILED"
    PACKAGE_GENERATED = "PACKAGE_GENERATED"
    PACKAGE_DISTRIBUTED = "PACKAGE_DISTRIBUTED"
    KEY_RELEASED = "KEY_RELEASED"
    CANDIDATE_AUTHENTICATED = "CANDIDATE_AUTHENTICATED"
    AUTH_FAILED = "AUTH_FAILED"
    EXAM_STARTED = "EXAM_STARTED"
    ANSWER_SUBMITTED = "ANSWER_SUBMITTED"
    EXAM_SUBMITTED = "EXAM_SUBMITTED"
    ANOMALY_DETECTED = "ANOMALY_DETECTED"
    SUPERVISOR_OVERRIDE = "SUPERVISOR_OVERRIDE"
    RECOVERY_INITIATED = "RECOVERY_INITIATED"
    # Graph randomization events (Module 04 integration)
    GRAPH_CONSTRUCTED = "GRAPH_CONSTRUCTED"
    GRAPH_COLORED = "GRAPH_COLORED"
    VARIANTS_GENERATED = "VARIANTS_GENERATED"


class ActorRole(str, Enum):
    """Role of the actor performing an audited action."""

    ADMIN = "admin"
    EXPERT = "expert"
    CANDIDATE = "candidate"
    INVIGILATOR = "invigilator"
    CENTER_ADMIN = "center_admin"
    AUDITOR = "auditor"
    SYSTEM = "system"


# ---------------------------------------------------------------------------
# Request Schemas
# ---------------------------------------------------------------------------

class LogEventRequest(BaseModel):
    """Request body for POST /api/v1/audit/log — append event to chain."""

    exam_id: str | None = Field(
        default=None,
        description="Exam UUID this event belongs to. Null for system-level events.",
    )
    event_type: str = Field(
        description="Event type string (use EventType enum values).",
        examples=["CANDIDATE_AUTHENTICATED"],
    )
    actor_id: str = Field(
        description="UUID or identifier of the actor performing the action.",
    )
    actor_role: str | None = Field(
        default=None,
        description="Role of the actor (admin/candidate/system/invigilator).",
    )
    target_id: str | None = Field(
        default=None,
        description="UUID of the affected entity (e.g., candidate_id, question_id).",
    )
    payload: dict[str, Any] = Field(
        description="Event-specific data. Will be JSON-serialized and hashed.",
    )


# ---------------------------------------------------------------------------
# Response Schemas
# ---------------------------------------------------------------------------

class LogEventResponse(BaseModel):
    """Response after successfully logging an audit event."""

    id: str = Field(description="UUID of the created audit event.")
    sequence: int = Field(description="Monotonic sequence number assigned to this event.")
    event_hash: str = Field(description="SHA-256 hash of this event (chain link).")
    previous_hash: str = Field(description="SHA-256 hash of the preceding event.")
    created_at: datetime = Field(description="Server timestamp of event creation.")

    model_config = {"from_attributes": True}


class AuditEventResponse(BaseModel):
    """Full audit event with all chain fields — used in chain and list endpoints."""

    id: str
    sequence: int
    exam_id: str | None = None
    event_type: str
    actor_id: str
    actor_role: str | None = None
    target_id: str | None = None
    payload: str = Field(description="JSON-serialized payload string.")
    payload_hash: str
    previous_hash: str
    event_hash: str
    created_at: datetime
    synced: bool = False

    model_config = {"from_attributes": True}


class AuditChainResponse(BaseModel):
    """Paginated list of audit events forming the chain."""

    events: list[AuditEventResponse]
    total: int
    page: int
    page_size: int
    exam_id: str | None = None


class ChainVerificationResult(BaseModel):
    """Result of hash chain integrity verification."""

    is_valid: bool
    total_events: int
    verified_events: int
    first_broken_at_sequence: int | None = None
    broken_event_id: str | None = None
    failure_reason: str | None = None
    message: str

    model_config = {"from_attributes": True}


class AuditListResponse(BaseModel):
    """Paginated list of audit events with optional type filtering."""

    events: list[AuditEventResponse]
    total: int
    page: int
    page_size: int
    filter_event_type: str | None = None
    filter_exam_id: str | None = None


class ExportMetadata(BaseModel):
    """Metadata included in audit chain export."""

    exam_id: str | None
    total_events: int
    export_format: str
    chain_valid: bool
    exported_at: datetime


class AuditExportResponse(BaseModel):
    """Full audit chain export (JSON format)."""

    metadata: ExportMetadata
    chain: list[AuditEventResponse]
