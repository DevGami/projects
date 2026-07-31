# FortisExam — Data Flow

> **Last Updated:** 2026-06-08

---

## Overview

Data flows through three phases: Pre-Exam, During Exam, and Post-Exam. Each phase has different trust boundaries and security requirements.

---

## Phase 1: Pre-Exam (Cloud)

### Question Authoring Flow
```
Subject Expert
    │
    ▼
Admin Portal (React)
    │ POST /questions { subject, content, options, answer }
    ▼
Question Service (FastAPI)
    │ Validates input
    ▼
Encryption Service
    │ AES-256-GCM encrypt(content, per-question-key)
    │ RSA-4096 wrap(per-question-key, master-key)
    ▼
PostgreSQL
    │ Stores: encrypted_content, wrapped_key, metadata
    ▼
Audit Service
    │ Log: QUESTION_CREATED { question_id, content_hash, author, timestamp }
    ▼
Audit Chain (append)
```

### Exam Compilation Flow
```
Examination Authority
    │ POST /compile-exam { blueprint, question_pool }
    ▼
Compilation Service
    │ Select questions per blueprint (subject, difficulty)
    │ Generate base variant
    ▼
Package Generator
    │ Bundle: encrypted_questions + blueprint + manifest
    │ Sign package with RSA-4096
    ▼
Distribution Service
    │ Package stored for delivery
    ▼
Audit Service
    │ Log: PACKAGE_GENERATED { package_id, manifest_hash }
```

### Distribution Flow
```
Distribution Service
    │ Push encrypted package to center edge nodes
    ▼
Center Edge Node
    │ Receive package
    │ Verify manifest signature (RSA-4096)
    │ Store encrypted package locally
    │
    │ (Separately, at exam time):
    ▼
Key Distribution Service
    │ Deliver center-specific decryption key
    │ Key = HKDF(master_key, center_id, exam_id)
    ▼
Edge Node decrypts package → exam is ready
```

---

## Phase 2: During Exam (Edge — Offline)

### Authentication Flow
```
Candidate
    │ Presents QR code
    ▼
QR Scanner (Electron)
    │ Read QR token (contains: candidate_id, exam_id, nonce, signature)
    ▼
Edge Authentication Service
    │ Verify RSA signature on token
    │ Check nonce (anti-replay)
    │ Check exam assignment
    ▼
Webcam Capture (Electron)
    │ Capture face image
    ▼
Face Verification Service
    │ Generate face embedding (InsightFace)
    │ Compare against stored embedding (cosine similarity)
    │ Threshold check
    ▼
Session Creation
    │ Generate JWT session token
    │ Store session in SQLite + Redis
    ▼
Audit Service
    │ Log: CANDIDATE_AUTHENTICATED { candidate_id, method, score }
```

### Exam Execution Flow
```
Authenticated Candidate
    │ Session JWT
    ▼
Exam Service (Edge)
    │ Load candidate's variant (graph-colored)
    │ Decrypt questions using center key
    ▼
Electron Kiosk (React UI)
    │ Render question in kiosk mode
    │ Display timer, navigation, progress
    ▼
Candidate answers question
    │ POST /submit-answer { session_id, question_id, answer }
    ▼
Edge Server
    │ Validate session
    │ Save to SQLite (WAL mode, immediate)
    │ Sync to Redis (session cache)
    ▼
Audit Service
    │ Log: ANSWER_SUBMITTED { session_id, question_id, answer_hash }
```

### State Recovery Flow
```
NORMAL:
    Answer saved → SQLite (primary) → Redis (cache) → Recovery snapshot

FAILURE:
    Device crash / power loss
        ▼
    Candidate re-authenticates (face verify)
        ▼
    Edge Server loads latest snapshot
        │ Source priority: Redis → SQLite
        ▼
    Restore: answers, timer position, question index
        ▼
    Candidate resumes exam (< 60 seconds)
```

### Monitoring Flow
```
Webcam Feed (Electron)
    │ Continuous frame capture
    ▼
MediaPipe Processor (client-side)
    │ Face detection: count faces
    │ Face mesh: gaze direction
    ▼
Event Detector
    │ Rules: multiple_faces → HIGH
    │         looking_away(>5s) → MEDIUM
    │         camera_missing → HIGH
    ▼
Security Event
    │ POST /security-event { candidate_id, type, severity }
    ▼
Edge Server
    │ Store event
    │ Notify proctor dashboard
    ▼
Audit Service
    │ Log: ANOMALY_DETECTED { candidate_id, type, severity }
```

---

## Phase 3: Post-Exam (Sync)

### Submission Flow
```
Candidate clicks Submit
    ▼
Exam Service
    │ Freeze timer
    │ Collect all answers
    │ Generate submission hash
    │ Sign submission
    ▼
Submission Package
    │ { session_id, answers[], submission_hash, signature, timestamp }
    ▼
SQLite (store locally)
    ▼
Audit Service
    │ Log: EXAM_SUBMITTED { session_id, submission_hash }
```

### Cloud Sync Flow
```
Exam ends → Internet restored
    ▼
Edge Server
    │ Upload submission packages (encrypted)
    │ Upload audit chain
    ▼
Cloud Backend
    │ Receive and verify signatures
    │ Decrypt answers
    │ Score exam
    │ Verify audit chain integrity
    ▼
Result Compilation
    │ Aggregate scores
    │ Detect statistical anomalies
    ▼
Audit Archive
```

---

## Data at Rest

| Store | Location | Content | Encryption |
|---|---|---|---|
| PostgreSQL | Cloud | Questions, Exams, Users, Centers | AES-256-GCM (content), TDE |
| SQLite | Edge Node | Sessions, Answers, Snapshots | Application-level encryption |
| Redis | Edge Node | Active sessions, temp state | In-memory only, volatile |

---

## Related Documents

- [[ArchitectureSummary]] — Architecture overview
- [[SecurityModel]] — Security controls at each boundary
- [[ServiceBoundaries]] — Service responsibilities
