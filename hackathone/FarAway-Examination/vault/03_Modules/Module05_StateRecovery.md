# Module 05 — State Recovery System

> **Last Updated:** 2026-06-08
> **Status:** Implemented  
> **Priority:** High  
> **Lead:** Lead Backend Engineer

---

## Purpose

Guarantee examination continuity after device failures (power loss, process crash, hardware failure). Recover full exam state — answers, timer position, question index — within 60 seconds.

---

## Components

| Component | Responsibility |
|---|---|
| Local Cache (SQLite) | Primary persistent storage with WAL mode for crash safety |
| Sync Service (Redis) | Secondary in-memory cache for fast access |
| Recovery Manager | Orchestrate recovery from best available source |
| Snapshot Generator | Create recovery snapshots on each state change |

---

## Recovery Architecture

### Write Path (Normal Operation)
```
Candidate answers question
    ↓
Write to SQLite (WAL mode, immediate) ← PRIMARY
    ↓
Write to Redis (session cache) ← SECONDARY
    ↓
Update recovery snapshot: { answers, timer_remaining, current_question, timestamp }
```

### Read Path (Recovery)
```
Device restarts → Candidate re-authenticates
    ↓
Recovery Manager checks sources:
    1. Redis (fastest, may be lost if Redis crashed)
    2. SQLite (persistent, survives power loss with WAL)
    ↓
Load latest consistent snapshot
    ↓
Restore: all answers, timer position, question index
    ↓
Candidate resumes exam
```

---

## Recovery Snapshot Schema

```json
{
  "snapshotId": "uuid",
  "sessionId": "uuid",
  "candidateId": "uuid",
  "examId": "uuid",
  "answers": [
    { "questionId": "uuid", "selectedOption": "string", "timestamp": "datetime" }
  ],
  "timerRemaining": "int (seconds)",
  "currentQuestionIndex": "int",
  "totalQuestions": "int",
  "snapshotTimestamp": "datetime",
  "snapshotHash": "sha256 (integrity check)"
}
```

---

## Performance Targets

| Metric | Target |
|---|---|
| Answer save latency | < 100 ms |
| Recovery time (total) | < 60 seconds |
| Re-authentication | < 5 seconds |
| State restoration | < 5 seconds |
| Data loss window | 0 (every answer persisted immediately) |

---

## Failure Scenarios

| Scenario | Recovery Source | Expected Outcome |
|---|---|---|
| Electron process crash | Redis (if alive) → SQLite | Full state recovered |
| Power loss (sudden) | SQLite WAL journal | All committed writes recovered |
| Redis crash | SQLite | All data available, slightly slower |
| SQLite corruption | Redis snapshot | Partial recovery (session data only) |
| Both crash | Last synced snapshot on edge server | Recovery with potential minor loss |

---

## Dependencies

- SQLite with WAL mode — crash-safe local persistence
- Redis — fast in-memory session cache
- Authentication Service — re-authentication before recovery
- Audit Service — recovery events logged

---

## Testing Requirements

- Unit: Save → crash → recover produces identical state
- Unit: Timer calculation is correct after recovery
- Integration: Kill Electron process → restart → verify all answers present
- Integration: Simulate power loss → verify SQLite WAL recovery
- Performance: Recovery completes in < 60 seconds
- Edge: Recovery with empty Redis (SQLite only)
- Edge: Recovery with corrupted SQLite (Redis only)

---

## Related Documents

- [[Module03_Authentication]] — Re-authentication before recovery
- [[Module07_AuditLedger]] — Recovery events are audit-logged
- [[DatabaseDesign]] — SQLite schema for recovery snapshots
