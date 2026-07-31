# FortisExam — Architecture Summary

> **Last Updated:** 2026-06-08
> **Source:** [[docs/Architecture.md]]

---

## Architecture Vision

Edge-First, Zero-Trust architecture for high-stakes examinations at national scale. Each exam center operates as an independent secure execution environment.

---

## Core Principles

| Principle | Description |
|---|---|
| **Offline First** | Exam centers function without internet during exams |
| **Zero Trust** | No component trusts another without cryptographic proof |
| **Defense in Depth** | Four security layers protect the exam lifecycle |
| **Cryptographic Accountability** | Every action is hash-chained and verifiable |
| **Local Resilience** | Edge nodes recover from failures autonomously |
| **Scalable Synchronization** | Cloud sync is asynchronous, not real-time |

---

## Three Trust Zones

### Zone A: Secure Authoring Cloud
- **Purpose:** Pre-exam preparation
- **Components:** Admin Portal, Question Service, Encryption Service, Compilation Service, Audit Service
- **Actors:** Examination Authority, Subject Experts
- **Data:** PostgreSQL, Redis
- **Deployment:** Docker Compose (FastAPI backend)

### Zone B: Distribution Layer
- **Purpose:** Secure package delivery
- **Components:** Package Distribution Service, Key Distribution Service, Manifest Verification
- **Actors:** Distribution Service (automated)
- **Timing:** Pre-exam (packages distributed days before, keys released at exam time)

### Zone C: Center Edge Node
- **Purpose:** Exam execution (fully offline)
- **Components:** Authentication Service, Examination Service, Monitoring Service, State Recovery Service, Local Database, Audit Service
- **Actors:** Candidates, Invigilators, Center Administrators
- **Data:** SQLite (persistent), Redis (session cache)
- **Deployment:** Docker Compose (FastAPI edge server)

### Candidate Terminal
- **Purpose:** Locked-down exam environment
- **Components:** Electron Application, React Frontend
- **Deployment:** Native desktop application (kiosk mode)

---

## Four Security Layers

| Layer | Name | Controls |
|---|---|---|
| 1 | Identity Security | Signed QR tokens, face verification |
| 2 | Content Security | AES-256-GCM encryption, package signatures |
| 3 | Execution Security | Kiosk mode, restricted navigation |
| 4 | Audit Security | Hash chaining, signed events |

---

## Key Data Flows

### Pre-Exam: Question → Package
```
Author creates question → Encrypted immediately (AES-256-GCM)
→ Stored as ciphertext in PostgreSQL
→ Selected for exam via blueprint → Compiled into package
→ Package signed (RSA-4096) → Distributed to centers
→ Key sent separately, time-locked
```

### Exam Day: Authentication → Execution
```
Candidate scans QR → Signature validated on edge
→ Face captured → Embedding compared → Session created (JWT)
→ Variant loaded (graph-colored) → Exam rendered in kiosk mode
→ Answers auto-saved to SQLite → Synced to edge Redis
→ Exam submitted → Submission package generated & signed
```

### Post-Exam: Aggregation → Audit
```
Edge packages synced to cloud → Answers decrypted & scored
→ Results compiled → Audit chains verified end-to-end
→ Anomaly reports reviewed → Final results published
```

---

## Service Communication

| Context | Style | Protocol |
|---|---|---|
| Cloud services | REST APIs | HTTPS |
| Edge services | REST APIs | Local network (HTTP) |
| Desktop ↔ Edge | REST APIs | Local network |
| Desktop internal | IPC | Electron IPC |

---

## Related Documents

- [[SecurityModel]] — Detailed security architecture
- [[DataFlow]] — Data flow diagrams
- [[ThreatModel]] — Threat analysis
- [[ServiceBoundaries]] — Service responsibilities
- [[DeploymentArchitecture]] — Deployment topology
