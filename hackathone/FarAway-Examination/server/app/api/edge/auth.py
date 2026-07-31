"""
Edge API — Candidate Authentication

QR token validation + optional face embedding comparison.
Offline — no Clerk dependency. Uses custom RSA-signed JWTs.

Endpoints:
  POST /auth/authenticate        — Full QR + face auth → JWT session
  POST /auth/supervisor-override — Manual invigilator override (audit-logged)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.db.database import get_db
from server.app.schemas.auth import (
    AuthRequest,
    AuthResponse,
    SupervisorOverrideRequest,
    SupervisorOverrideResponse,
)
from server.app.services.auth_service import AuthService

router = APIRouter(prefix="/auth")


@router.post(
    "/authenticate",
    response_model=AuthResponse,
    summary="Candidate Authentication",
    description=(
        "Full dual-factor authentication: QR token RSA signature verification "
        "+ optional face embedding comparison. Creates an edge-local JWT session. "
        "face_image_base64 is optional — if absent, operates in QR-only mode."
    ),
)
async def authenticate(
    request: AuthRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """
    Authenticate a candidate using QR token + optional face verification.

    Steps:
      1. Parse and verify RSA-2048 QR token signature
      2. Check token expiry
      3. Consume nonce (prevent replay)
      4. Optionally compare face embedding
      5. Create exam session
      6. Issue edge-local RS256 JWT
      7. Audit log CANDIDATE_AUTHENTICATED
    """
    svc = AuthService(db)
    try:
        result = await svc.authenticate(
            qr_data=request.qr_data,
            face_image_base64=request.face_image_base64,
        )
        await db.commit()
        return AuthResponse(**result)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication system error: {exc}",
        ) from exc


@router.post(
    "/supervisor-override",
    response_model=SupervisorOverrideResponse,
    summary="Supervisor Authentication Override",
    description=(
        "Manual override by invigilator when QR scan or face verification fails. "
        "Always logged to the audit trail. Requires candidate_id and reason."
    ),
)
async def supervisor_override(
    request: SupervisorOverrideRequest,
    db: AsyncSession = Depends(get_db),
) -> SupervisorOverrideResponse:
    """
    Manual authentication override by invigilator.

    Bypasses QR + face checks. Creates a session directly.
    A SUPERVISOR_OVERRIDE audit event is ALWAYS logged.
    """
    svc = AuthService(db)
    try:
        result = await svc.supervisor_override(
            candidate_id=request.candidate_id,
            exam_id=request.exam_id,
            invigilator_id=request.invigilator_id,
            reason=request.reason,
        )
        await db.commit()
        return SupervisorOverrideResponse(**result)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Override system error: {exc}",
        ) from exc


@router.get(
    "/candidates",
    summary="List All Candidates",
    description="Returns all candidates from the DB. Used by the kiosk supervisor override picker.",
)
async def list_candidates(
    db: AsyncSession = Depends(get_db),
):
    """List all candidates — used by kiosk override picker."""
    from sqlalchemy import select
    from server.app.models.candidate import Candidate

    result = await db.execute(select(Candidate))
    candidates = result.scalars().all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "roll_number": c.roll_number,
            "exam_id": c.exam_id,
        }
        for c in candidates
    ]


@router.get(
    "/demo-qr/{candidate_id}",
    summary="Generate Demo QR Token",
    description="Generate a server-signed demo QR token for testing. NOT for production use.",
)
async def demo_qr(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Generate a demo QR JSON payload for a candidate — testing only."""
    import json
    import uuid
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select
    from server.app.models.candidate import Candidate

    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    qr_payload = {
        "candidate_id": candidate.id,
        "exam_id": candidate.exam_id,
        "nonce": str(uuid.uuid4()),
        "issued_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat(),
        "signature": "demo_bypass",
    }
    return {
        "qr_data": json.dumps(qr_payload),
        "candidate_name": candidate.name,
    }
