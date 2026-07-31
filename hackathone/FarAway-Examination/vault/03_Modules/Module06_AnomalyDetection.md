# Module 06 — Edge AI Anomaly Detection

> **Last Updated:** 2026-06-08
> **Status:** 🔴 Not Started

---

## Purpose

Detect suspicious candidate behavior during exams using on-device AI models. Runs entirely offline on edge hardware — no cloud inference required.

---

## Components

| Component | Responsibility |
|---|---|
| Webcam Processor | Continuous frame capture from candidate webcam |
| Face Detector (MediaPipe) | Count faces in frame, detect face absence |
| Gaze Tracker (MediaPipe Face Mesh) | Estimate gaze direction, detect looking away |
| Event Detector | Apply rules to generate security events |
| Alert Dispatcher | Notify proctor dashboard, log to audit |

---

## Detection Rules

| Rule | Condition | Severity | Action |
|---|---|---|---|
| Multiple Faces | face_count > 1 for > 2 seconds | HIGH | Alert proctor, log event |
| No Face | face_count == 0 for > 5 seconds | HIGH | Alert proctor, log event |
| Looking Away | gaze deviation > 30° for > 5 seconds | MEDIUM | Alert proctor, log event |
| Camera Blocked | no video signal for > 3 seconds | HIGH | Alert proctor, log event |
| Rapid Answer Changes | > 10 answer changes in 30 seconds | LOW | Log event (post-exam review) |

---

## Processing Pipeline

```
Webcam → Frame capture (every 200ms)
    ↓
MediaPipe Face Detection
    │ Output: face_count, face_bounding_boxes
    ↓
MediaPipe Face Mesh (if face_count == 1)
    │ Output: 468 face landmarks, gaze direction
    ↓
Rule Engine
    │ Apply detection rules
    │ Debounce: suppress duplicate alerts within cooldown period
    ↓
Security Event
    │ { candidate_id, event_type, severity, timestamp, evidence_hash }
    ↓
Edge Server → Proctor Dashboard (WebSocket)
    ↓
Audit Service → Hash chain
```

---

## Performance Requirements

| Metric | Target |
|---|---|
| Processing frame rate | ≥ 5 FPS |
| Detection latency | < 2 seconds from event to alert |
| CPU usage | < 30% of one core |
| Memory usage | < 200 MB |

---

## Dependencies

- MediaPipe — face detection and face mesh models
- Electron — webcam access via WebRTC/getUserMedia
- Edge Server — event storage and proctor notification
- Audit Service — event logging

---

## Testing Requirements

- Unit: Single face → no alert
- Unit: Two faces → HIGH alert generated
- Unit: Face looking away > 5s → MEDIUM alert
- Unit: No face > 5s → HIGH alert
- Integration: End-to-end webcam → detection → proctor notification
- Performance: 5 FPS maintained on target hardware

---

## Related Documents

- [[Module07_AuditLedger]] — Anomaly events logged in audit chain
- [[Module03_Authentication]] — Face detection reuses same camera pipeline
- [[SecurityModel]] — Execution security layer
