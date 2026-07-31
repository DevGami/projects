# FortisExam — Sprint Board

> **Last Updated:** 2026-06-08

---

## Sprint 0: Foundation (Current)
**Duration:** 0.5 day
**Goal:** Project scaffolding, documentation, repository setup

| Task | Track | Priority | Status | Assignee |
|---|---|---|---|---|
| Create project vault | Docs | P0 | ✅ Done | AI Agent |
| Analyze PRD/TRD/Architecture | Docs | P0 | ✅ Done | AI Agent |
| Design repository structure | Docs | P0 | ✅ Done | AI Agent |
| Create sprint plan | Docs | P0 | ✅ Done | AI Agent |
| Generate test plans | Docs | P0 | ✅ Done | AI Agent |
| Create judge preparation docs | Docs | P0 | ✅ Done | AI Agent |

---

## Sprint 1: Core Backend + Crypto
**Duration:** 1 day
**Goal:** Database, APIs, encryption, audit foundation

| Task | Track | Priority | Status | Depends On |
|---|---|---|---|---|
| PostgreSQL schema + Alembic migrations | Backend | P0 | 🔴 TODO | Sprint 0 |
| FastAPI cloud backend scaffold | Backend | P0 | 🔴 TODO | Sprint 0 |
| AES-256-GCM encryption module | Security | P0 | 🔴 TODO | — |
| RSA-4096 key management module | Security | P0 | 🔴 TODO | — |
| SHA-256 hash chain module | Security | P0 | 🔴 TODO | — |
| Question CRUD API | Backend | P0 | 🔴 TODO | DB schema, Crypto |
| Audit event logger | Backend | P0 | 🔴 TODO | Hash chain |
| Unit tests for crypto modules | Security | P0 | 🔴 TODO | Crypto modules |
| Unit tests for question API | Backend | P0 | 🔴 TODO | Question API |

---

## Sprint 2: Compilation + Distribution + Auth
**Duration:** 1 day
**Goal:** Exam compilation, package delivery, candidate authentication

| Task | Track | Priority | Status | Depends On |
|---|---|---|---|---|
| Exam compilation service | Backend | P0 | 🔴 TODO | Question API |
| Seating graph builder | AI/ML | P0 | 🔴 TODO | — |
| Graph coloring algorithm | AI/ML | P0 | 🔴 TODO | Graph builder |
| Variant generator | AI/ML | P0 | 🔴 TODO | Graph coloring |
| Package generation + signing | Backend | P0 | 🔴 TODO | Compilation |
| Distribution API | Backend | P1 | 🔴 TODO | Package gen |
| Edge server scaffold (FastAPI + SQLite) | Backend | P0 | 🔴 TODO | — |
| QR token generation + signing | Security | P0 | 🔴 TODO | RSA module |
| QR token validation on edge | Security | P0 | 🔴 TODO | Edge server |
| Face embedding service (InsightFace) | AI/ML | P1 | 🔴 TODO | — |
| Face verification endpoint | Backend | P1 | 🔴 TODO | Face service |
| JWT session management | Security | P0 | 🔴 TODO | Edge server |

---

## Sprint 3: Exam Execution + Recovery
**Duration:** 1 day
**Goal:** Desktop app, exam UI, state recovery

| Task | Track | Priority | Status | Depends On |
|---|---|---|---|---|
| Electron app scaffold | Desktop | P0 | 🔴 TODO | — |
| Kiosk mode configuration | Desktop | P0 | 🔴 TODO | Electron scaffold |
| React exam UI | Frontend | P0 | 🔴 TODO | Electron scaffold |
| Question display + navigation | Frontend | P0 | 🔴 TODO | Exam UI |
| Timer component | Frontend | P0 | 🔴 TODO | Exam UI |
| Answer submission API (edge) | Backend | P0 | 🔴 TODO | Edge server |
| Auto-save to SQLite | Backend | P0 | 🔴 TODO | Answer API |
| Redis session sync | Backend | P1 | 🔴 TODO | Auto-save |
| Recovery snapshot generation | Backend | P0 | 🔴 TODO | Auto-save |
| Recovery restoration endpoint | Backend | P0 | 🔴 TODO | Snapshots |
| Recovery UI flow | Desktop | P0 | 🔴 TODO | Recovery API |

---

## Sprint 4: Monitoring + Integration + Demo
**Duration:** 1 day
**Goal:** Anomaly detection, end-to-end integration, demo polish

| Task | Track | Priority | Status | Depends On |
|---|---|---|---|---|
| MediaPipe face detection integration | AI/ML | P1 | 🔴 TODO | Electron app |
| Gaze tracking implementation | AI/ML | P2 | 🔴 TODO | MediaPipe |
| Security event generation | AI/ML | P1 | 🔴 TODO | Detection rules |
| Proctor dashboard (minimal) | Frontend | P1 | 🔴 TODO | Edge APIs |
| Admin dashboard (minimal) | Frontend | P1 | 🔴 TODO | Cloud APIs |
| Audit trail viewer | Frontend | P2 | 🔴 TODO | Audit API |
| End-to-end integration testing | All | P0 | 🔴 TODO | All modules |
| Demo script rehearsal | Docs | P0 | 🔴 TODO | Integration |
| Docker Compose finalization | DevOps | P0 | 🔴 TODO | All services |
| Documentation finalization | Docs | P0 | 🔴 TODO | All |

---

## Velocity Notes

- Sprint 0 completed by AI Agent (vault + planning)
- Sprints 1-4 require developer execution
- Crypto modules (Sprint 1) are parallelizable with DB schema
- Graph algorithms (Sprint 2) are parallelizable with authentication
- Desktop and backend tracks can work in parallel from Sprint 2 onward

---

## Related Documents

- [[ActiveTasks]] — Current work focus
- [[TeamAssignments]] — Developer track assignments
- [[Roadmap]] — Phase overview
- [[Blockers]] — Active blockers
