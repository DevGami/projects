"""
Edge API — Monitoring

Security event ingestion from desktop kiosk (MediaPipe alerts).
Protected by edge-local RSA-signed JWT.

Endpoints:
  POST  /monitoring/event                       — Report security frame (from kiosk)
  GET   /monitoring/events                      — List events (proctor dashboard)
  GET   /monitoring/events/{session_id}/summary — Session anomaly summary
  GET   /monitoring/events/detail/{event_id}    — Single event detail (A7f drawer)   ← NEW
  PATCH /monitoring/events/{event_id}/acknowledge — Proctor acknowledges alert        ← GAP-5
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.db.database import get_db
from server.app.middleware.edge_auth import verify_edge_jwt
from server.app.schemas.monitoring import (
    AcknowledgeResponse,
    DetectionFrameRequest,
    DetectionResultResponse,
    EventDetailResponse,
    EventListResponse,
    SecurityAlertResponse,
    SessionSummaryResponse,
)
from server.app.services.monitoring_service import MonitoringService
from shared.monitoring.rule_engine import DetectionFrame

router = APIRouter(prefix="/monitoring")


def _get_monitoring_service(db: AsyncSession = Depends(get_db)) -> MonitoringService:
    return MonitoringService(db)


@router.post("/event", response_model=DetectionResultResponse)
async def report_security_event(
    data: DetectionFrameRequest,
    auth: dict = Depends(verify_edge_jwt),
    svc: MonitoringService = Depends(_get_monitoring_service),
):
    """Report a security event from the desktop kiosk (e.g. multiple faces, gaze deviation)."""
    frame = DetectionFrame(
        session_id=data.session_id,
        candidate_id=data.candidate_id,
        face_count=data.face_count,
        gaze_yaw=data.gaze_yaw,
        gaze_pitch=data.gaze_pitch,
        camera_active=data.camera_active,
        answer_changes_last_30s=data.answer_changes_last_30s,
        timestamp=data.timestamp,
    )

    alerts = await svc.process_frame(frame)

    return DetectionResultResponse(
        alerts_generated=len(alerts),
        alerts=[
            SecurityAlertResponse(
                alert_type=a.alert_type.value,
                severity=a.severity.value,
                details=a.details,
                evidence_hash=a.evidence_hash,
            )
            for a in alerts
        ],
        message=f"{len(alerts)} alert(s) generated" if alerts else "No anomalies detected",
    )


@router.get("/events", response_model=EventListResponse)
async def list_events(
    session_id: str | None = None,
    severity: str | None = None,
    event_type: str | None = None,
    acknowledged: bool | None = None,
    page: int = 1,
    page_size: int = 50,
    auth: dict = Depends(verify_edge_jwt),
    svc: MonitoringService = Depends(_get_monitoring_service),
):
    """
    List security events for proctor dashboard.

    Supports filtering by session_id, severity, event_type, and acknowledged status.
    Results are ordered newest-first.
    """
    result = await svc.list_events(
        session_id=session_id,
        severity=severity,
        event_type=event_type,
        acknowledged=acknowledged,
        page=page,
        page_size=page_size,
    )
    return EventListResponse(**result)


# ---------------------------------------------------------------------------
# NOTE: /events/detail/{event_id} MUST be registered before
#       /events/{session_id}/summary to avoid path collision.
# ---------------------------------------------------------------------------

@router.get(
    "/events/detail/{event_id}",
    response_model=EventDetailResponse,
    summary="Get single security event detail",
    description=(
        "Returns full detail for a single security event by UUID. "
        "Used by the Anomaly Detail Drawer (screen A7f) in the proctor dashboard."
    ),
)
async def get_event_detail(
    event_id: str,
    auth: dict = Depends(verify_edge_jwt),
    svc: MonitoringService = Depends(_get_monitoring_service),
):
    """Fetch a single security event by ID for the detail drawer."""
    event = await svc.get_event(event_id)
    if event is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "event_not_found", "message": f"Security event {event_id} not found"},
        )
    return EventDetailResponse(
        id=event.id,
        session_id=event.session_id,
        candidate_id=event.candidate_id,
        event_type=event.event_type,
        severity=event.severity,
        details=event.details,
        evidence_hash=event.evidence_hash,
        acknowledged=event.acknowledged,
        created_at=str(event.created_at),
    )


@router.get("/events/{session_id}/summary", response_model=SessionSummaryResponse)
async def get_session_summary(
    session_id: str,
    auth: dict = Depends(verify_edge_jwt),
    svc: MonitoringService = Depends(_get_monitoring_service),
):
    """Get anomaly summary for a specific session."""
    result = await svc.get_session_summary(session_id)
    if result["total_events"] == 0:
        return SessionSummaryResponse(**result)
    return SessionSummaryResponse(**result)


@router.patch(
    "/events/{event_id}/acknowledge",
    response_model=AcknowledgeResponse,
    summary="Acknowledge a security alert",
    description=(
        "Marks a security event as acknowledged by the proctor. "
        "Acknowledged events are still stored and audited — this just updates "
        "the `acknowledged` flag so the UI can de-prioritize them. "
        "Returns 404 if the event ID does not exist."
    ),
)
async def acknowledge_event(
    event_id: str,
    auth: dict = Depends(verify_edge_jwt),
    svc: MonitoringService = Depends(_get_monitoring_service),
):
    """
    Proctor acknowledges a security alert (GAP-5).

    This endpoint was missing and caused the frontend to use optimistic-only UI.
    Now wired to MonitoringService.acknowledge_event() which flips acknowledged=True.
    """
    success = await svc.acknowledge_event(event_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "event_not_found",
                "message": f"Security event {event_id} not found — cannot acknowledge",
            },
        )
    return AcknowledgeResponse(
        id=event_id,
        acknowledged=True,
        message=f"Event {event_id} acknowledged successfully",
    )
