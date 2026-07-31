# Module 07 — Audit Ledger: Manual Testing Checklist

> **For:** Hackathon Demo, Judge Demonstration, Proctor QA
> **Environment:** Local dev or Docker (both cloud/edge modes)
> **Prerequisite:** Server running at `http://localhost:8000` (cloud) or `http://localhost:8001` (edge)

---

## Pre-Requisite: Start Server

```bash
# Cloud mode (PostgreSQL)
make run-cloud

# Or edge mode (SQLite) — works with same tests
docker compose -f docker/docker-compose.yml up -d edge-server
```

Verify server is up:
```bash
curl http://localhost:8000/health
# Expected: {"status": "healthy", "mode": "cloud"}
```

---

## Test 1: Log an Audit Event

```bash
curl -X POST http://localhost:8000/api/v1/audit/log \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "CANDIDATE_AUTHENTICATED",
    "actor_id": "candidate-test-001",
    "actor_role": "candidate",
    "exam_id": "demo-exam-001",
    "target_id": "candidate-test-001",
    "payload": {
      "candidate_id": "candidate-test-001",
      "method": "qr+face",
      "face_score": 0.95,
      "nonce": "anti-replay-nonce-001"
    }
  }'
```

**Expected Response:**
```json
{
  "id": "<uuid>",
  "sequence": 1,
  "event_hash": "<64-char hex>",
  "previous_hash": "0000000000000000000000000000000000000000000000000000000000000000",
  "created_at": "<ISO8601>"
}
```

✅ Verify `previous_hash` is 64 zeros (genesis event)

---

## Test 2: Log Several More Events

```bash
# Log question created
curl -X POST http://localhost:8000/api/v1/audit/log \
  -H "Content-Type: application/json" \
  -d '{"event_type":"EXAM_STARTED","actor_id":"candidate-test-001","actor_role":"candidate","exam_id":"demo-exam-001","payload":{"session_id":"s-001","timestamp":"2026-06-09T15:00:00Z"}}'

# Log answer submitted
curl -X POST http://localhost:8000/api/v1/audit/log \
  -H "Content-Type: application/json" \
  -d '{"event_type":"ANSWER_SUBMITTED","actor_id":"candidate-test-001","actor_role":"candidate","exam_id":"demo-exam-001","payload":{"session_id":"s-001","question_id":"q-001","selected_option":2}}'
```

✅ Verify each response has increasing `sequence` numbers: 1, 2, 3, ...
✅ Verify `previous_hash` of event N equals `event_hash` of event N-1

---

## Test 3: View the Audit Chain

```bash
curl http://localhost:8000/api/v1/audit/chain?exam_id=demo-exam-001
```

**Expected:** Paginated list of events in sequence order.

```bash
# Full chain (all exams)
curl http://localhost:8000/api/v1/audit/chain
```

✅ Events ordered by sequence (ascending)
✅ `total` count matches logged events

---

## Test 4: Verify Chain Integrity (Should Pass)

```bash
curl -X POST http://localhost:8000/api/v1/audit/verify
```

**Expected Response:**
```json
{
  "is_valid": true,
  "total_events": 3,
  "verified_events": 3,
  "first_broken_at_sequence": null,
  "broken_event_id": null,
  "failure_reason": null,
  "message": "Chain intact — 3 events verified"
}
```

✅ `is_valid: true`
✅ Message says "intact"

---

## Test 5: Exam-Scoped Verification

```bash
curl -X POST http://localhost:8000/api/v1/audit/verify/demo-exam-001
```

✅ Verifies only events for `demo-exam-001`

---

## Test 6: Export Chain as JSON

```bash
curl -o audit_export.json "http://localhost:8000/api/v1/audit/export/demo-exam-001?format=json"
cat audit_export.json
```

**Expected:**
```json
{
  "metadata": {
    "exam_id": "demo-exam-001",
    "total_events": 3,
    "export_format": "json",
    "chain_valid": true,
    "exported_at": "<ISO8601>"
  },
  "chain": [...]
}
```

✅ `chain_valid: true`
✅ Events ordered by sequence

---

## Test 7: Export Chain as CSV

```bash
curl -o audit_export.csv "http://localhost:8000/api/v1/audit/export/demo-exam-001?format=csv"
cat audit_export.csv
```

✅ CSV header row includes: sequence, event_type, event_hash, previous_hash
✅ Number of data rows matches total events
✅ Metadata comment lines start with `#`

---

## Test 8: List Events with Filters

```bash
# Filter by event type
curl "http://localhost:8000/api/v1/audit/events?event_type=CANDIDATE_AUTHENTICATED"

# Filter by exam
curl "http://localhost:8000/api/v1/audit/events?exam_id=demo-exam-001&page=1&page_size=10"
```

✅ Results filtered correctly
✅ Pagination works

---

## 🔴 DEMO ACT 3: Tamper Detection (Critical Demo!)

This is the **most important demo step** — shows the audit chain is cryptographically tamper-evident.

### Step 1: Verify chain is currently valid
```bash
curl -X POST http://localhost:8000/api/v1/audit/verify
# Expected: is_valid: true
```

### Step 2: Tamper with a DB record directly

**SQLite (edge mode):**
```bash
# Find the SQLite file
ls data/edge/fortis_edge.db

# Open SQLite and modify an event
sqlite3 data/edge/fortis_edge.db "UPDATE audit_events SET payload = '{\"tampered\":true}' WHERE sequence = 2;"
```

**PostgreSQL (cloud mode):**
```bash
docker exec -it fortis-postgres psql -U fortis -c "UPDATE audit_events SET payload_hash = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' WHERE sequence = 2;"
```

### Step 3: Verify chain detects the tamper
```bash
curl -X POST http://localhost:8000/api/v1/audit/verify
```

**Expected Response:**
```json
{
  "is_valid": false,
  "total_events": 3,
  "verified_events": 1,
  "first_broken_at_sequence": 2,
  "broken_event_id": "<uuid>",
  "failure_reason": "payload_hash_mismatch",
  "message": "Chain BROKEN at sequence 2 — payload hash mismatch"
}
```

✅ `is_valid: false`
✅ `first_broken_at_sequence: 2` (exact tamper point)
✅ `failure_reason: "payload_hash_mismatch"`

**This is your judge moment.** Explain: "Even with direct database access, any modification is immediately detectable — no one can alter the exam record without it being caught."

---

## Test 9: Chain Statistics

```bash
curl "http://localhost:8000/api/v1/audit/stats"
curl "http://localhost:8000/api/v1/audit/stats?exam_id=demo-exam-001"
```

✅ Returns total_events, latest_sequence, latest_event_hash

---

## Automated Test Verification

Run the full automated test suite to confirm all 87 tests pass:

```bash
# Unit + integration + security tests
python -m pytest tests/unit/test_audit.py tests/integration/test_audit_integration.py tests/security/test_audit_security.py -v

# Coverage report
python -m coverage run -m pytest tests/unit/test_audit.py tests/integration/test_audit_integration.py tests/security/test_audit_security.py
python -m coverage report --include="shared/audit/*,server/app/services/audit_service.py,server/app/schemas/audit.py"
```

**Expected:** 87 passed, 98% coverage

---

## Cleanup / Reset

```bash
# Reset all audit events (for demo reset)
# SQLite
sqlite3 data/edge/fortis_edge.db "DELETE FROM audit_events;"

# PostgreSQL
docker exec -it fortis-postgres psql -U fortis -c "TRUNCATE audit_events;"
```
