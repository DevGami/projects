"""
Integration Tests — Module 06: Monitoring API Endpoints

Tests the edge monitoring API routes using FastAPI TestClient.
Since the monitoring routes are edge-only, we create a dedicated
test app with SERVER_MODE=edge and mock the auth + service.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.app.api.edge.monitoring import router as monitoring_router
from server.app.api.edge.monitoring import _get_monitoring_service
from server.app.middleware.edge_auth import verify_edge_jwt
from shared.monitoring.rule_engine import AlertSeverity, AlertType, SecurityAlert


# ---------------------------------------------------------------------------
# Create a test-specific FastAPI app with edge routes mounted
# ---------------------------------------------------------------------------

test_app = FastAPI()
test_app.include_router(monitoring_router, prefix="/api/v1", tags=["Monitoring"])


# ---------------------------------------------------------------------------
# Mock dependencies
# ---------------------------------------------------------------------------

async def _mock_edge_jwt():
    return {"sub": "test-session", "candidate_id": "c-1", "exam_id": "e-1"}


class MockMonitoringService:
    """Mock monitoring service that returns predictable data."""

    async def process_frame(self, frame):
        alerts = []
        if frame.face_count >= 2:
            alerts.append(SecurityAlert(
                alert_type=AlertType.MULTIPLE_FACES,
                severity=AlertSeverity.HIGH,
                details={"face_count": frame.face_count, "candidate_id": frame.candidate_id},
                evidence_hash="a" * 64,
            ))
        if frame.face_count == 0:
            alerts.append(SecurityAlert(
                alert_type=AlertType.NO_FACE,
                severity=AlertSeverity.HIGH,
                details={"face_count": 0, "candidate_id": frame.candidate_id},
                evidence_hash="b" * 64,
            ))
        return alerts

    async def list_events(self, session_id=None, severity=None, event_type=None, acknowledged=None, page=1, page_size=50):
        events = [
            {
                "id": "evt-1",
                "session_id": "s-1",
                "candidate_id": "c-1",
                "event_type": "MULTIPLE_FACES",
                "severity": "HIGH",
                "details": '{"face_count":2}',
                "evidence_hash": "a" * 64,
                "acknowledged": False,
                "created_at": "2026-06-11T12:00:00",
            }
        ]
        if severity:
            events = [e for e in events if e["severity"] == severity]
        if acknowledged is not None:
            events = [e for e in events if e["acknowledged"] == acknowledged]
        return {"events": events, "total": len(events), "page": page, "page_size": page_size}

    async def get_session_summary(self, session_id):
        return {
            "session_id": session_id,
            "total_events": 3,
            "high_count": 2,
            "medium_count": 1,
            "low_count": 0,
            "event_types": {"MULTIPLE_FACES": 2, "GAZE_DEVIATION": 1},
        }


# Override dependencies on the test app
test_app.dependency_overrides[verify_edge_jwt] = _mock_edge_jwt
test_app.dependency_overrides[_get_monitoring_service] = lambda: MockMonitoringService()

client = TestClient(test_app)


# ---------------------------------------------------------------------------
# POST /monitoring/event
# ---------------------------------------------------------------------------

class TestReportEvent:
    """Tests for POST /api/v1/monitoring/event."""

    def test_normal_frame_no_alerts(self):
        resp = client.post("/api/v1/monitoring/event", json={
            "session_id": "s-1",
            "candidate_id": "c-1",
            "face_count": 1,
            "camera_active": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["alerts_generated"] == 0
        assert data["message"] == "No anomalies detected"

    def test_multiple_faces_generates_alert(self):
        resp = client.post("/api/v1/monitoring/event", json={
            "session_id": "s-1",
            "candidate_id": "c-1",
            "face_count": 3,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["alerts_generated"] == 1
        assert data["alerts"][0]["alert_type"] == "MULTIPLE_FACES"
        assert data["alerts"][0]["severity"] == "HIGH"

    def test_no_face_generates_alert(self):
        resp = client.post("/api/v1/monitoring/event", json={
            "session_id": "s-1",
            "candidate_id": "c-1",
            "face_count": 0,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["alerts_generated"] == 1
        assert data["alerts"][0]["alert_type"] == "NO_FACE"

    def test_invalid_face_count_rejected(self):
        resp = client.post("/api/v1/monitoring/event", json={
            "session_id": "s-1",
            "candidate_id": "c-1",
            "face_count": -1,
        })
        assert resp.status_code == 422  # Pydantic validation (ge=0)


# ---------------------------------------------------------------------------
# GET /monitoring/events
# ---------------------------------------------------------------------------

class TestListEvents:
    """Tests for GET /api/v1/monitoring/events."""

    def test_list_events_returns_data(self):
        resp = client.get("/api/v1/monitoring/events")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert len(data["events"]) >= 1

    def test_list_events_with_severity_filter(self):
        resp = client.get("/api/v1/monitoring/events?severity=HIGH")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /monitoring/events/{session_id}/summary
# ---------------------------------------------------------------------------

class TestSessionSummary:
    """Tests for GET /api/v1/monitoring/events/{session_id}/summary."""

    def test_summary_returns_counts(self):
        resp = client.get("/api/v1/monitoring/events/s-1/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert data["session_id"] == "s-1"
        assert data["total_events"] == 3
        assert data["high_count"] == 2
        assert data["medium_count"] == 1
        assert data["low_count"] == 0
        assert "MULTIPLE_FACES" in data["event_types"]
