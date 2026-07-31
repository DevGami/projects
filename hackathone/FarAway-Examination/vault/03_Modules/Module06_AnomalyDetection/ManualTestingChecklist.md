# Module 06 — Anomaly Detection: Manual Testing Checklist

> **Last Updated:** 2026-06-11

---

## Prerequisites

1. Edge server running: `SERVER_MODE=edge uvicorn server.app.main:app`
2. Valid edge JWT token (from QR authentication flow)
3. API testing tool (curl, httpie, or Postman)

---

## Test 1: Normal Frame — No Alerts

**Steps:**
```bash
curl -X POST http://localhost:8000/api/v1/monitoring/event \
  -H "Authorization: Bearer <edge_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"s-1","candidate_id":"c-1","face_count":1,"gaze_yaw":5.0,"gaze_pitch":3.0,"camera_active":true,"answer_changes_last_30s":2}'
```

**Expected:** `alerts_generated: 0`, message: "No anomalies detected"

---

## Test 2: Multiple Faces Detected

**Steps:**
```bash
curl -X POST http://localhost:8000/api/v1/monitoring/event \
  -H "Authorization: Bearer <edge_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"s-1","candidate_id":"c-1","face_count":3}'
```

**Expected:** 1 alert, type: `MULTIPLE_FACES`, severity: `HIGH`

---

## Test 3: No Face Detected

**Steps:**
```bash
curl -X POST http://localhost:8000/api/v1/monitoring/event \
  -H "Authorization: Bearer <edge_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"s-1","candidate_id":"c-1","face_count":0}'
```

**Expected:** 1 alert, type: `NO_FACE`, severity: `HIGH`

---

## Test 4: Gaze Deviation

**Steps:**
```bash
curl -X POST http://localhost:8000/api/v1/monitoring/event \
  -H "Authorization: Bearer <edge_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"s-1","candidate_id":"c-1","face_count":1,"gaze_yaw":45.0,"gaze_pitch":0.0}'
```

**Expected:** 1 alert, type: `GAZE_DEVIATION`, severity: `MEDIUM`

---

## Test 5: Camera Blocked

**Steps:**
```bash
curl -X POST http://localhost:8000/api/v1/monitoring/event \
  -H "Authorization: Bearer <edge_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"s-1","candidate_id":"c-1","camera_active":false}'
```

**Expected:** 1 alert, type: `CAMERA_BLOCKED`, severity: `HIGH`

---

## Test 6: Rapid Answer Changes

**Steps:**
```bash
curl -X POST http://localhost:8000/api/v1/monitoring/event \
  -H "Authorization: Bearer <edge_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"s-1","candidate_id":"c-1","answer_changes_last_30s":15}'
```

**Expected:** 1 alert, type: `RAPID_ANSWER_CHANGES`, severity: `LOW`

---

## Test 7: Debounce — Duplicate Suppression

**Steps:** Send Test 2 twice in rapid succession (within 10 seconds).

**Expected:** First call returns 1 alert, second call returns 0 alerts.

---

## Test 8: List Events

**Steps:**
```bash
curl http://localhost:8000/api/v1/monitoring/events \
  -H "Authorization: Bearer <edge_jwt>"
```

**Expected:** Paginated list of all security events.

---

## Test 9: Session Summary

**Steps:**
```bash
curl http://localhost:8000/api/v1/monitoring/events/s-1/summary \
  -H "Authorization: Bearer <edge_jwt>"
```

**Expected:** Summary with total_events, severity counts, event_type breakdown.

---

## Failure Conditions

- Missing JWT → 401 or 403
- Invalid face_count (negative) → 422
- Missing required fields → 422

---

## Regression Checks

- [ ] All Module 07 audit tests still pass (audit chain not broken)
- [ ] All Module 03 auth tests still pass (edge JWT middleware unchanged)
- [ ] All Module 05 recovery tests still pass (no model conflicts)
