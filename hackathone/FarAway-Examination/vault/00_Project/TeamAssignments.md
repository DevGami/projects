# FortisExam — Team Assignments

> **Last Updated:** 2026-06-08
> **Sprint:** Pre-Sprint (Vault Initialization)

---

## Team Structure

The project is organized into six development tracks. Each track can operate semi-independently with defined interfaces.

---

## Track 1: Backend Core

**Scope:** FastAPI backend, PostgreSQL schema, core APIs, encryption service

| Task | Priority | Status |
|---|---|---|
| Database schema design | P0 | 🔴 Not Started |
| FastAPI project scaffold | P0 | 🔴 Not Started |
| Question CRUD API | P0 | 🔴 Not Started |
| Encryption service (AES-256-GCM) | P0 | 🔴 Not Started |
| Exam compilation service | P1 | 🔴 Not Started |
| Package generation service | P0 | 🔴 Not Started |
| Distribution API | P1 | 🔴 Not Started |

**Key Interfaces:**
- Provides REST APIs consumed by Frontend and Desktop tracks
- Provides encrypted packages consumed by Edge Server

---

## Track 2: Frontend (Admin Portal)

**Scope:** React admin dashboard for exam authorities

| Task | Priority | Status |
|---|---|---|
| React project scaffold | P1 | 🔴 Not Started |
| Question management UI | P1 | 🔴 Not Started |
| Exam configuration UI | P1 | 🔴 Not Started |
| Center management UI | P2 | 🔴 Not Started |
| Audit viewer UI | P2 | 🔴 Not Started |

**Key Interfaces:**
- Consumes Backend Core APIs
- Displays audit trail data

---

## Track 3: Desktop (Electron Kiosk)

**Scope:** Electron candidate terminal with React UI

| Task | Priority | Status |
|---|---|---|
| Electron project scaffold | P0 | 🔴 Not Started |
| Kiosk mode implementation | P0 | 🔴 Not Started |
| Exam UI (question display, navigation, timer) | P0 | 🔴 Not Started |
| Answer auto-save | P0 | 🔴 Not Started |
| QR scanner integration | P0 | 🔴 Not Started |
| Webcam capture for face verify | P1 | 🔴 Not Started |

**Key Interfaces:**
- Communicates with Edge Server via local REST APIs
- Uses Electron IPC for internal communication

---

## Track 4: Security & Crypto

**Scope:** Encryption, key management, authentication, audit ledger

| Task | Priority | Status |
|---|---|---|
| AES-256-GCM encryption module | P0 | 🔴 Not Started |
| RSA-4096 key pair management | P0 | 🔴 Not Started |
| HKDF key derivation | P0 | 🔴 Not Started |
| JWT session tokens | P0 | 🔴 Not Started |
| QR token signing & validation | P0 | 🔴 Not Started |
| Hash-chained audit ledger | P0 | 🔴 Not Started |
| Package integrity verification | P1 | 🔴 Not Started |

**Key Interfaces:**
- Shared crypto library used by Backend Core, Edge Server, and Desktop

---

## Track 5: AI/ML

**Scope:** Face verification, anomaly detection, graph randomization

| Task | Priority | Status |
|---|---|---|
| InsightFace embedding generation | P1 | 🔴 Not Started |
| Face comparison service | P1 | 🔴 Not Started |
| MediaPipe face detection | P1 | 🔴 Not Started |
| Gaze tracking | P2 | 🔴 Not Started |
| Seating graph builder | P0 | 🔴 Not Started |
| Graph coloring variant generator | P0 | 🔴 Not Started |

**Key Interfaces:**
- Face services consumed by Authentication module
- Graph services consumed by Compilation service
- Monitoring runs locally on Electron desktop app

---

## Track 6: Documentation & DevOps

**Scope:** Documentation, testing, deployment, CI/CD

| Task | Priority | Status |
|---|---|---|
| Project vault maintenance | P0 | ✅ In Progress |
| Docker Compose setup | P0 | 🔴 Not Started |
| Environment configuration | P0 | 🔴 Not Started |
| Test plan creation | P0 | ✅ In Progress |
| Demo script preparation | P1 | 🔴 Not Started |
| CI/CD pipeline | P2 | 🔴 Not Started |

---

## Cross-Track Dependencies

```
Backend Core ──→ Frontend (APIs)
Backend Core ──→ Desktop (via Edge Server APIs)
Security ──→ Backend Core (shared crypto library)
Security ──→ Desktop (QR, JWT, face verify)
AI/ML ──→ Security (face verification)
AI/ML ──→ Backend Core (graph randomization)
Documentation ──→ All tracks (continuous)
```

---

## Related Documents

- [[SprintBoard]] — Sprint breakdown with timeline
- [[ActiveTasks]] — Current work items per track
- [[Roadmap]] — Phase overview
