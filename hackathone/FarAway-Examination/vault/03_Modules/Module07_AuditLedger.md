# Module 07 — Cryptographic Audit Ledger

> **Last Updated:** 2026-06-08
> **Status:** 🔴 Not Started

---

## Purpose

Create tamper-evident records of every critical examination action. The audit ledger uses a hash chain where each event includes the SHA-256 hash of the previous event, making any modification mathematically detectable.

---

## Components

| Component | Responsibility |
|---|---|
| Event Logger | Capture and format audit events |
| Hash Chain Generator | Compute SHA-256 chain linking |
| Chain Verifier | Validate integrity of entire chain |
| Export Service | Export audit trail for external review |

---

## Audit Event Schema

```json
{
  "eventId": "uuid",
  "eventType": "string (e.g., QUESTION_CREATED, CANDIDATE_AUTHENTICATED)",
  "timestamp": "datetime (ISO 8601)",
  "actorId": "uuid (who performed the action)",
  "actorRole": "string (admin, candidate, system)",
  "targetId": "uuid (affected entity)",
  "payload": { "key": "value (event-specific data)" },
  "payloadHash": "sha256(JSON.stringify(payload))",
  "previousHash": "sha256 (hash of previous event in chain)",
  "currentHash": "sha256(eventId + eventType + timestamp + payloadHash + previousHash)"
}
```

---

## Hash Chain Mechanics

```
Event 0 (Genesis):
    previousHash = "0" * 64 (zero hash)
    currentHash = SHA256(eventId + eventType + timestamp + payloadHash + "0"*64)

Event N:
    previousHash = Event[N-1].currentHash
    currentHash = SHA256(eventId + eventType + timestamp + payloadHash + previousHash)
```

### Verification
```
For each event in chain (1..N):
    1. Recompute payloadHash from payload → must match stored payloadHash
    2. Verify previousHash == chain[i-1].currentHash
    3. Recompute currentHash from components → must match stored currentHash
    4. If any check fails → CHAIN BROKEN at event i
```

---

## Event Types

| Event Type | Trigger | Key Payload |
|---|---|---|
| QUESTION_CREATED | New question saved | question_id, content_hash, author |
| QUESTION_MODIFIED | Question updated | question_id, diff_hash, editor |
| EXAM_COMPILED | Exam compiled from pool | exam_id, blueprint_hash, question_count |
| PACKAGE_GENERATED | Encrypted package created | package_id, manifest_hash |
| PACKAGE_DISTRIBUTED | Package sent to center | package_id, center_id |
| KEY_RELEASED | Decryption key released | exam_id, center_id |
| CANDIDATE_AUTHENTICATED | Candidate verified | candidate_id, method, score |
| AUTH_FAILED | Authentication failed | candidate_id, reason |
| EXAM_STARTED | Candidate starts exam | session_id, variant_id |
| ANSWER_SUBMITTED | Answer saved | session_id, question_id, answer_hash |
| EXAM_SUBMITTED | Exam completed | session_id, submission_hash |
| ANOMALY_DETECTED | Monitoring alert | candidate_id, anomaly_type, severity |
| SUPERVISOR_OVERRIDE | Manual auth override | candidate_id, supervisor_id, reason |
| RECOVERY_INITIATED | State recovery started | session_id, recovery_source |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /api/v1/audit/log | Log new audit event (appends to chain) |
| GET | /api/v1/audit/chain/{exam_id} | Get audit chain for exam |
| POST | /api/v1/audit/verify/{exam_id} | Verify chain integrity |
| GET | /api/v1/audit/export/{exam_id} | Export chain as JSON/CSV |

---

## Dependencies

- SHA-256 — hash computation (Python hashlib)
- PostgreSQL — cloud audit storage
- SQLite — edge audit storage
- All other modules — emit audit events

---

## Testing Requirements

- Unit: Genesis event has correct zero previousHash
- Unit: Chain of 100 events verifies correctly
- Unit: Modified event breaks chain verification
- Unit: Deleted event breaks chain verification
- Unit: payloadHash matches recomputed hash
- Integration: Real events from auth + exam → chain verifies
- Performance: Verification of 10,000 events < 5 seconds

---

## Related Documents

- [[SecurityModel]] — Audit security layer
- [[ThreatModel]] — T-009: Audit chain corruption threat
- [[Decisions]] — D-005: Hash-chained audit decision
