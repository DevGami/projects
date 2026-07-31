"""
Common API — Audit Trail

Hash-chained audit ledger endpoints. Available in BOTH cloud and edge modes
because both zones emit and verify audit events.

Routes:
  POST /api/v1/audit/log               — Append event to chain
  GET  /api/v1/audit/chain             — Full chain (paginated)
  GET  /api/v1/audit/chain/{exam_id}   — Exam-scoped chain
  POST /api/v1/audit/verify            — Verify entire chain
  POST /api/v1/audit/verify/{exam_id}  — Verify exam-scoped chain
  GET  /api/v1/audit/events            — List events with filters
  GET  /api/v1/audit/export/{exam_id}  — Export as JSON or CSV

Security note: In production, log endpoint should be internal-only (no public auth).
For hackathon demo, all endpoints are open for easy demonstration. Production would
add RBAC: log=internal, chain/verify/export=admin+auditor.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.db.database import get_db
from server.app.schemas.audit import (
    AuditChainResponse,
    AuditListResponse,
    ChainVerificationResult,
    LogEventRequest,
    LogEventResponse,
)
from server.app.services.audit_service import AuditService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["Audit"])


# ---------------------------------------------------------------------------
# Dependency: AuditService injected per request
# ---------------------------------------------------------------------------

async def get_audit_service(db: Annotated[AsyncSession, Depends(get_db)]) -> AuditService:
    """Dependency injection for AuditService."""
    return AuditService(db)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post(
    "/log",
    response_model=LogEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Append audit event to hash chain",
    description=(
        "Appends a new event to the tamper-evident hash chain. "
        "Computes SHA-256 of the payload and links to the previous event's hash. "
        "Returns the assigned sequence number and event hash for the caller to store."
    ),
)
async def log_event(
    request: LogEventRequest,
    audit_svc: Annotated[AuditService, Depends(get_audit_service)],
) -> LogEventResponse:
    """Append a new event to the audit hash chain."""
    try:
        result = await audit_svc.log_event(
            event_type=request.event_type,
            actor_id=request.actor_id,
            payload=request.payload,
            exam_id=request.exam_id,
            actor_role=request.actor_role,
            target_id=request.target_id,
        )
        return result
    except Exception as exc:
        logger.error("Failed to log audit event: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "audit_log_failed",
                "message": "Failed to append event to audit chain",
                "details": str(exc),
            },
        ) from exc


@router.get(
    "/chain",
    response_model=AuditChainResponse,
    summary="Get full audit chain",
    description=(
        "Returns the complete audit chain ordered by sequence number. "
        "Optionally filter by exam_id. Use this endpoint to inspect the "
        "chain before calling /verify."
    ),
)
async def get_audit_chain(
    audit_svc: Annotated[AuditService, Depends(get_audit_service)],
    exam_id: str | None = Query(default=None, description="Filter by exam UUID"),
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=100, ge=1, le=500, description="Events per page"),
) -> AuditChainResponse:
    """Get the full audit chain, optionally scoped by exam."""
    result = await audit_svc.get_chain(exam_id=exam_id, page=page, page_size=page_size)
    return AuditChainResponse(**result)


@router.get(
    "/chain/{exam_id}",
    response_model=AuditChainResponse,
    summary="Get audit chain for specific exam",
    description="Returns the audit chain for a specific exam ID, ordered by sequence.",
)
async def get_exam_audit_chain(
    exam_id: str,
    audit_svc: Annotated[AuditService, Depends(get_audit_service)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
) -> AuditChainResponse:
    """Get the audit chain for a specific exam."""
    result = await audit_svc.get_chain(exam_id=exam_id, page=page, page_size=page_size)
    return AuditChainResponse(**result)


@router.post(
    "/verify",
    response_model=ChainVerificationResult,
    summary="Verify full audit chain integrity",
    description=(
        "Walks the entire audit chain and verifies all three cryptographic checks "
        "for each event: (1) payload_hash matches, (2) previous_hash chain link is "
        "correct, (3) event_hash matches. Returns the exact sequence number where "
        "tampering was detected."
    ),
)
async def verify_chain(
    audit_svc: Annotated[AuditService, Depends(get_audit_service)],
    exam_id: str | None = Query(default=None, description="Scope verification to specific exam"),
) -> ChainVerificationResult:
    """Verify the integrity of the full audit hash chain."""
    result = await audit_svc.verify_chain(exam_id=exam_id)
    return result


@router.post(
    "/verify/{exam_id}",
    response_model=ChainVerificationResult,
    summary="Verify audit chain for specific exam",
    description=(
        "Verifies the cryptographic integrity of all audit events "
        "associated with a specific exam."
    ),
)
async def verify_exam_chain(
    exam_id: str,
    audit_svc: Annotated[AuditService, Depends(get_audit_service)],
) -> ChainVerificationResult:
    """Verify the integrity of a specific exam's audit chain."""
    result = await audit_svc.verify_chain(exam_id=exam_id)
    return result


@router.get(
    "/events",
    response_model=AuditListResponse,
    summary="List audit events with filters",
    description=(
        "Returns a paginated list of audit events with optional filtering "
        "by event_type, exam_id, and actor_id. Results are ordered newest-first "
        "for proctor dashboard convenience."
    ),
)
async def list_audit_events(
    audit_svc: Annotated[AuditService, Depends(get_audit_service)],
    event_type: str | None = Query(default=None, description="Filter by event type"),
    exam_id: str | None = Query(default=None, description="Filter by exam UUID"),
    actor_id: str | None = Query(default=None, description="Filter by actor UUID"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> AuditListResponse:
    """List audit events with optional type and exam filtering."""
    result = await audit_svc.list_events(
        event_type=event_type,
        exam_id=exam_id,
        actor_id=actor_id,
        page=page,
        page_size=page_size,
    )
    return AuditListResponse(**result)


@router.get(
    "/export/{exam_id}",
    summary="Export audit chain for exam",
    description=(
        "Exports the complete audit chain for an exam in JSON or CSV format. "
        "The export includes metadata (chain validity, export timestamp) and "
        "the full ordered chain of events. Use format=csv for spreadsheet tools, "
        "format=json for programmatic processing."
    ),
    responses={
        200: {
            "description": "Audit chain export",
            "content": {
                "application/json": {},
                "text/csv": {},
            },
        }
    },
)
async def export_audit_chain(
    exam_id: str,
    audit_svc: Annotated[AuditService, Depends(get_audit_service)],
    fmt: str = Query(default="json", pattern="^(json|csv)$", description="Export format"),
) -> Response:
    """Export the audit chain for a specific exam as JSON or CSV."""
    try:
        content, media_type = await audit_svc.export_chain(exam_id=exam_id, fmt=fmt)
        filename = f"audit_chain_{exam_id}.{fmt}"
        return Response(
            content=content,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Chain-Exam-Id": exam_id,
            },
        )
    except Exception as exc:
        logger.error("Failed to export audit chain: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "export_failed",
                "message": f"Failed to export audit chain for exam {exam_id}",
                "details": str(exc),
            },
        ) from exc


@router.get(
    "/stats",
    summary="Audit chain statistics",
    description="Returns summary statistics about the audit chain.",
)
async def get_audit_stats(
    audit_svc: Annotated[AuditService, Depends(get_audit_service)],
    exam_id: str | None = Query(default=None),
) -> dict:
    """Get audit chain statistics (total events, latest sequence, etc.)."""
    chain_result = await audit_svc.get_chain(exam_id=exam_id, page=1, page_size=1)
    latest = await audit_svc.get_latest_event()

    return {
        "total_events": chain_result["total"],
        "latest_sequence": latest.sequence if latest else 0,
        "latest_event_hash": latest.event_hash if latest else None,
        "exam_id": exam_id,
    }


@router.post(
    "/tamper",
    summary="[Demo] Simulate database tampering",
    description="Directly modifies the payload of the latest event in the database without updating the hashes, intentionally breaking the cryptographic chain for demonstration purposes.",
)
async def simulate_tampering(
    audit_svc: Annotated[AuditService, Depends(get_audit_service)],
    exam_id: str | None = Query(default=None),
) -> dict:
    """Intentionally corrupt an audit event to demonstrate tamper detection."""
    # We will access the db directly through the service to perform the malicious update
    result = await audit_svc._db.execute(
        select(AuditEvent)
        .where(AuditEvent.exam_id == exam_id if exam_id else True)
        .order_by(AuditEvent.sequence.desc())
        .limit(1)
    )
    event = result.scalar_one_or_none()
    
    if not event:
        raise HTTPException(status_code=404, detail="No events found to tamper with")
        
    # Corrupt the payload directly
    event.payload = '{"content":"MODIFIED BY ATTACKER — leak attempt"}'
    await audit_svc._db.commit()
    
    return {"status": "tampered", "sequence": event.sequence}

