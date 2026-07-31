# Module 05 — State Recovery: Implementation Plan

> **Status:** Awaiting Approval
> **Author:** AI Agent (Lead Backend Engineer)
> **Date:** 2026-06-09

---

## Scope

Implement the State Recovery subsystem for FortisExam. This module ensures examination continuity after device failures (power loss, process crash, hardware failure) by persisting exam state on every answer change and restoring it within 60 seconds.

### In Scope
- Recovery snapshot save (on every answer submission)
- Recovery snapshot restore (after crash + re-authentication)
- Answer submission with auto-save to SQLite
- Timer tracking and restoration
- Snapshot integrity hashing (SHA-256)
- Audit event logging for all recovery operations
- Edge API endpoints for answer/recovery/restore
- Unit, integration, edge case, failure, and security tests

### Out of Scope
- Redis integration (removed per D-010)
- Re-authentication flow (Module 03 responsibility)
- Desktop/Electron UI (user said "do not touch frontend")
- Exam session creation (Module 03 responsibility)
- Question decryption (Module 02 responsibility)

---

## Goals

| Goal | Source | Metric |
|---|---|---|
| Prevent answer loss | PRD FR-08 | 0 answers lost on crash |
| Recovery within 60 seconds | PRD/TRD performance target | < 60s end-to-end |
| Answer save < 100ms | TRD performance target | < 100ms per answer |
| State restoration < 5 seconds | Module05 spec | < 5s for snapshot load |
| Snapshot integrity | Architecture (Layer 4) | SHA-256 verified on restore |
| Audit logging | Architecture (audit security) | All recovery events chained |

---

## Dependencies (Analysis)

| Dependency | Status | Risk |
|---|---|---|
| `server/app/models/recovery_snapshot.py` | ✅ Real model exists | None — extend as needed |
| `server/app/models/session.py` | ✅ Real model exists | None |
| `server/app/models/answer.py` | ✅ Real model exists | None |
| `server/app/db/database.py` | ✅ Async SQLAlchemy + `get_db()` | None |
| `shared/crypto/hashing.py` | ✅ `HashUtils.sha256_json()` | None |
| `shared/audit/event_logger.py` | ✅ `EventLogger.create_event()` | None |
| `server/app/services/audit_service.py` | ✅ Full implementation (Module 07) | None |
| SQLite with WAL mode | ✅ Supported via config | Must set `PRAGMA journal_mode=WAL` on startup |
| Redis | ❌ Removed per D-010 | None — not used |

**No blockers identified.**

---

## Architecture

### Design Decisions

1. **SQLite is sole datastore** (D-010). No Redis dual-write. Simpler recovery logic.
2. **Snapshot-per-session model** (not snapshot-per-answer). Only one `recovery_snapshot` row per `session_id` (existing model has `unique=True` on `session_id`). Updated on every answer change via UPSERT.
3. **Snapshot includes all answers** as a JSON blob, plus timer and question index. This makes restoration a single read.
4. **Snapshot hash** = SHA-256 of canonical JSON of the snapshot data. Verified on restore to detect corruption.
5. **Audit events** are logged for: answer submission, snapshot save, session recovery. Uses existing `AuditService` / `EventLogger`.

### Write Path (Normal Operation)

```
Candidate submits answer
    ↓
POST /api/v1/exam/answer
    ↓
1. UPSERT answer in `answers` table (session_id + question_id unique)
    ↓
2. Collect ALL current answers for this session from `answers` table
    ↓
3. UPSERT recovery_snapshot: { all_answers, timer_remaining, current_question_index }
    ↓
4. Compute snapshot_hash = SHA-256(answers_json + timer + question_index)
    ↓
5. Log ANSWER_SUBMITTED audit event
    ↓
Return { saved: true }
```

### Read Path (Recovery)

```
Candidate re-authenticates after crash
    ↓
GET /api/v1/recovery/{candidate_id}
    ↓
1. Look up latest session for candidate (status != 'submitted')
    ↓
2. Load recovery_snapshot for that session
    ↓
3. Verify snapshot_hash integrity
    ↓
4. Return snapshot data (answers, timer, question_index)
    ↓
POST /api/v1/recovery/restore/{session_id}
    ↓
1. Load snapshot
    ↓
2. Update session status → 'recovered'
    ↓
3. Log SESSION_RECOVERED audit event
    ↓
Return restored session state
```

---

## Proposed Changes

### Component 1: Shared Recovery Logic (`shared/recovery/`)

#### [NEW] `shared/recovery/__init__.py`
Package init.

#### [NEW] `shared/recovery/snapshot_manager.py`
Pure-logic snapshot manager (no DB dependency). Handles:
- Building snapshot dicts from answer data
- Computing snapshot hashes (SHA-256)
- Validating snapshot integrity
- Calculating timer remaining

This lives in `shared/` so it can be tested without DB fixtures and used by both edge server and any future desktop recovery logic.

---

### Component 2: Server Recovery Service

#### [MODIFY] `server/app/services/recovery_service.py`
Replace 3 TODO stubs with full implementations:
- `save_snapshot()` — UPSERT snapshot row, compute hash
- `get_snapshot()` — Load by candidate_id, verify hash
- `restore_session()` — Load snapshot, update session status, log audit

---

### Component 3: Edge API Routes

#### [MODIFY] `server/app/api/edge/recovery.py`
Replace 2 TODO stubs with full implementations:
- `GET /recovery/{candidate_id}` — calls `RecoveryService.get_snapshot()`
- `POST /recovery/restore/{session_id}` — calls `RecoveryService.restore_session()`

#### [MODIFY] `server/app/api/edge/exam.py`
Replace 3 TODO stubs with full implementations:
- `GET /exam/session/{session_id}` — load session + variant
- `POST /exam/answer` — upsert answer + save snapshot
- `POST /exam/submit` — final submission + hash

---

### Component 4: Schemas

#### [NEW] `server/app/schemas/recovery.py`
Pydantic models for request/response validation:
- `SubmitAnswerRequest`
- `SubmitAnswerResponse`
- `SubmitExamRequest`
- `SubmitExamResponse`
- `RecoverySnapshotResponse`
- `RestoreSessionResponse`

---

### Component 5: Model Updates

#### [MODIFY] `server/app/models/recovery_snapshot.py`
Add `candidate_id` column (needed for lookup by candidate on recovery). Add `updated_at` for tracking last snapshot time.

---

### Component 6: Tests

#### [NEW] `tests/unit/test_recovery.py`
Unit tests for `shared/recovery/snapshot_manager.py`:
- Snapshot construction
- Hash computation / verification
- Timer calculation
- Edge cases (empty answers, zero timer, max answers)

#### [NEW] `tests/integration/test_recovery_integration.py`
Integration tests using in-memory SQLite:
- Full pipeline: submit answer → save snapshot → simulate crash → restore → verify
- Multiple answers accumulate correctly
- Timer restoration accuracy
- Snapshot hash verification on restore
- Corrupted snapshot detected

#### [NEW] `tests/unit/test_recovery_edge_cases.py`
Edge case + failure tests:
- Restore with no snapshot (first-time candidate)
- Restore already submitted exam (should fail)
- Concurrent answer submissions
- Answer overwrite (change answer to same question)
- Very large answer payload
- Snapshot for non-existent session

#### [NEW] `tests/security/test_recovery_security.py`
Security tests:
- Tampered snapshot hash detected
- Cross-session snapshot injection blocked
- Candidate cannot restore another candidate's session

---

### Component 7: Documentation

#### [NEW] `vault/03_Modules/Module05_StateRecovery/ManualTestingChecklist.md`
Step-by-step manual testing guide.

#### [MODIFY] `vault/00_Project/CurrentState.md`
#### [MODIFY] `vault/05_Development/ActiveTasks.md`
#### [MODIFY] `vault/05_Development/Changelog.md`
#### [MODIFY] `vault/07_AI_Context/ContextSummary.md`
#### [MODIFY] `vault/03_Modules/Module05_StateRecovery.md` — Update status

---

## APIs

### Edge Endpoints (Zone C)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/exam/session/{session_id}` | Load exam session with variant |
| `POST` | `/api/v1/exam/answer` | Submit/update answer + auto-snapshot |
| `POST` | `/api/v1/exam/submit` | Final exam submission |
| `GET` | `/api/v1/recovery/{candidate_id}` | Get latest recovery snapshot |
| `POST` | `/api/v1/recovery/restore/{session_id}` | Restore session from snapshot |

---

## Data Structures

### Recovery Snapshot (updated)

```json
{
  "id": "uuid",
  "session_id": "uuid",
  "candidate_id": "uuid",
  "answers_json": "[{\"question_id\": \"uuid\", \"selected_option\": \"A\", \"answered_at\": \"ISO\"}]",
  "current_question_index": 5,
  "remaining_seconds": 1800,
  "snapshot_hash": "sha256-of-canonical-content",
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

### SubmitAnswerRequest

```json
{
  "session_id": "uuid",
  "question_id": "uuid",
  "selected_option": "B",
  "current_question_index": 5,
  "remaining_seconds": 1800
}
```

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| SQLite WAL mode not enabled | Data loss on crash | LOW | Explicitly set `PRAGMA journal_mode=WAL` at startup |
| Snapshot hash collision | Wrong data restored | NEGLIGIBLE | SHA-256 collision is computationally infeasible |
| `answers` table grows large | Slow snapshot builds | LOW | Query only by `session_id` (indexed via unique constraint) |
| Concurrent answer writes | Race condition in snapshot | LOW | SQLite serializes writes; single-process edge deployment |
| Timer drift during crash | Wrong time restored | MEDIUM | `remaining_seconds` is stored at last answer, not computed from wall clock |

---

## Test Strategy

### Unit Tests (~20 tests)
- Snapshot hash computation
- Snapshot validation (corrupt/valid)
- Timer calculation correctness
- Edge cases (empty, zero, max values)

### Integration Tests (~15 tests)
- Full answer → snapshot → restore pipeline
- Multiple answers per session
- Answer overwrite semantics
- Snapshot integrity verification
- Audit event generation during recovery

### Edge Case / Failure Tests (~10 tests)
- No snapshot exists
- Already-submitted session recovery blocked
- Non-existent session/candidate
- Tampered snapshot detected
- Very large payloads

### Security Tests (~5 tests)
- Cross-session injection
- Hash tampering detection
- Unauthorized candidate access

**Target: ~50 tests, >= 80% coverage**

---

## Manual Testing Strategy

Will create `ManualTestingChecklist.md` with:
1. Setup: Create test database, start edge server
2. Create session → submit answers → verify snapshots created
3. Simulate crash (kill process) → restart → verify recovery
4. Tamper with snapshot → verify detection
5. Submit exam → verify recovery blocked post-submission
