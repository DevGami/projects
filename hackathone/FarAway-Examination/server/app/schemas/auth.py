"""Pydantic schemas for Authentication — edge candidate auth + cloud user sync."""

from __future__ import annotations

from pydantic import BaseModel, Field


# ===========================================================================
# QR Token (internal parsing structure)
# ===========================================================================


class QRTokenPayload(BaseModel):
    """Decoded QR token payload for validation."""

    candidate_id: str
    exam_id: str
    center_id: str
    nonce: str
    issued_at: str
    expires_at: str
    signature: str  # Base64 RSA-2048 signature


# ===========================================================================
# Edge Authentication
# ===========================================================================


class AuthRequest(BaseModel):
    """Full authentication request: QR scan data + optional face image."""

    qr_data: str = Field(
        ...,
        description="Raw QR code content (JSON string with RSA-signed payload)",
    )
    face_image_base64: str | None = Field(
        default=None,
        description=(
            "Base64-encoded face embedding bytes (float32 x 512). "
            "If omitted, authenticates in QR-only mode (face step skipped)."
        ),
    )


class AuthResponse(BaseModel):
    """Authentication result with JWT session token."""

    session_id: str = Field(..., description="Exam session UUID")
    token: str = Field(..., description="RS256 JWT for subsequent exam API calls")
    variant_id: int = Field(..., description="Graph-colored variant assigned to this seat")
    expires_at: str = Field(..., description="ISO-8601 token expiry time")
    face_score: float = Field(default=0.0, description="Cosine similarity score (0–1)")
    method: str = Field(
        default="qr_only",
        description="Auth method: 'qr_face' | 'qr_only' | 'supervisor_override'",
    )


# ===========================================================================
# Supervisor Override
# ===========================================================================


class SupervisorOverrideRequest(BaseModel):
    """Manual override by invigilator — bypasses QR + face checks."""

    candidate_id: str = Field(..., description="Candidate UUID")
    exam_id: str = Field(..., description="Exam UUID")
    invigilator_id: str = Field(
        ...,
        description="Invigilator's staff ID (recorded in audit trail)",
    )
    reason: str = Field(
        ...,
        min_length=10,
        description="Mandatory justification for the override (≥10 characters)",
    )


class SupervisorOverrideResponse(BaseModel):
    """Response for a successful supervisor override."""

    session_id: str
    token: str
    variant_id: int
    expires_at: str
    face_score: float = 0.0
    method: str = "supervisor_override"


# ===========================================================================
# Cloud User Management (Clerk sync)
# ===========================================================================


class UserSyncRequest(BaseModel):
    """Sync or upsert a Clerk user into the local users table."""

    clerk_user_id: str = Field(..., description="Clerk user ID (e.g. user_xxx)")
    name: str = Field(..., min_length=1, description="Display name")
    role: str = Field(
        ...,
        description="Role: admin | expert | center_admin | invigilator | auditor",
    )


class UserMeResponse(BaseModel):
    """Current user profile from Clerk claims + local DB."""

    clerk_user_id: str
    name: str
    role: str
    email: str


class UserSyncResponse(BaseModel):
    """Result of user sync operation."""

    clerk_user_id: str
    name: str
    role: str
    created: bool = Field(..., description="True if newly created; False if updated")
