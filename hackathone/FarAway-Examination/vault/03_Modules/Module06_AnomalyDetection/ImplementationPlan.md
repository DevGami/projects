# Module 06 — Anomaly Detection: Implementation Plan

> **Last Updated:** 2026-06-11
> **Status:** 🟡 In Progress
> **Author:** Harsh Bhavsar

---

## Scope

Implement the backend anomaly detection pipeline for FortisExam. This module provides:
1. A **shared rule engine** (`shared/monitoring/`) that evaluates detection rules against frame analysis results
2. An **edge MonitoringService** that persists security events, logs to audit chain, and provides proctor queries
3. **Edge API endpoints** for the desktop kiosk to report events and for the proctor dashboard to query them
4. A **SecurityEvent SQLAlchemy model** for persistent storage

> **Note:** The actual MediaPipe/webcam frame processing runs client-side in the Electron desktop app (Module 06 spec). This backend module receives pre-processed detection results from the kiosk and applies server-side rule evaluation, persistence, and alerting.

---

## Goals

| ID | Goal |
|---|---|
| G1 | Apply detection rules (multiple faces, no face, gaze deviation, camera blocked, rapid answer changes) |
| G2 | Debounce duplicate alerts within configurable cooldown periods |
| G3 | Persist security events with evidence hashes to SQLite |
| G4 | Log all anomaly events to the cryptographic audit chain |
| G5 | Provide proctor dashboard query API (filter by session, severity, type) |

---

## APIs

### Edge Endpoints (protected by edge JWT)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/monitoring/event` | Report a detection frame from the kiosk |
| GET | `/api/v1/monitoring/events` | List/filter security events for proctor |
| GET | `/api/v1/monitoring/events/{session_id}/summary` | Get anomaly summary for a session |

---

## Data Structures

### SecurityEvent Model (SQLite)

| Column | Type | Description |
|---|---|---|
| id | String(36) PK | UUID |
| session_id | String(36) | FK to sessions |
| candidate_id | String(36) | Candidate who triggered |
| event_type | String(50) | MULTIPLE_FACES, NO_FACE, GAZE_DEVIATION, CAMERA_BLOCKED, RAPID_ANSWER_CHANGES |
| severity | String(10) | HIGH, MEDIUM, LOW |
| details | Text (JSON) | Detection metadata (face_count, gaze_angle, etc.) |
| evidence_hash | String(64) | SHA-256 of the evidence payload |
| acknowledged | Boolean | Proctor acknowledged this alert |
| created_at | DateTime | Server timestamp |

### DetectionFrame (Pydantic input from kiosk)

```python
class DetectionFrame:
    session_id: str
    candidate_id: str
    face_count: int
    gaze_yaw: float | None      # degrees, None if no face
    gaze_pitch: float | None
    camera_active: bool
    answer_changes_last_30s: int
    timestamp: str               # ISO 8601
```

---

## Dependencies

- **Existing:** AuditService (Module 07), edge JWT middleware (Module 03), SQLAlchemy Base
- **New packages:** None (pure Python rule engine)
- **MediaPipe:** NOT a backend dependency — runs in Electron client

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| High event volume from rapid webcam frames | DB bloat | Debounce cooldown (configurable per rule) |
| False positives on gaze detection | Proctor fatigue | MEDIUM severity + cooldown, not auto-action |
| No actual webcam in test environment | Can't integration test live | Mock detection frames in tests |

---

## Test Strategy

### Unit Tests
- Rule engine: each rule triggers correctly at threshold
- Rule engine: debounce suppresses duplicates within cooldown
- Rule engine: edge cases (zero faces, negative angles, boundary values)
- Evidence hash computation is deterministic

### Integration Tests
- POST /monitoring/event → event persisted + audit logged
- GET /monitoring/events → filtering works
- GET /monitoring/events/{session_id}/summary → correct counts

### Security Tests
- Tampered evidence hash is detectable
- Events without valid JWT are rejected

---

## Manual Testing Strategy

See `ManualTestingChecklist.md` in this directory.
