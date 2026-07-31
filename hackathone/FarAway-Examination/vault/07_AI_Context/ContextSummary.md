# FortisExam — Context Summary

> **Last Updated:** 2026-06-12

---

## Quick Context for AI Agents

### What Is This Project?
FortisExam is a Zero-Trust, Edge-First examination infrastructure for large-scale national exams (NEET, JEE, UPSC). It prevents paper leaks through encryption, prevents copying through spatial randomization, and ensures accountability through hash-chained audit trails.

### Current Status
**Currently Completed:**
* **Architecture:** Core design, D-001 through D-015, SQLite edge DB (Redis removed).
* **Module 01 (Question Pool):** Fully implemented. Alembic migrations, QuestionService with AES-256-GCM auto-encryption, Clerk JWT RBAC protected cloud routes, 12 unit/integration/security tests.
* **Module 02 (Crypto Delivery):** Fully implemented. AES-256-GCM, RSA-2048, and PackageService complete. D-012 Admin key release endpoint active.
* **Module 03 (Authentication):** Fully implemented. JWTHandler (RS256), QRTokenService (RSA sig + anti-replay nonce), FaceVerificationService (cosine similarity), AuthService (8-step pipeline), Clerk JWKS middleware, RBAC, supervisor override. 63 new tests.
* **Module 04 (Graph Randomization):** Core logic, deterministic seeding, graph coloring.
* **Module 05 (State Recovery):** Auto-snapshots to SQLite on every answer, async API endpoints, hash integrity verification, session status restoration, 58/58 tests passing with 99% coverage.
* **Module 06 (Anomaly Detection):** Fully implemented. RuleEngine with 5 detection rules (multiple faces, no face, gaze deviation, camera blocked, rapid answer changes), debounce cooldowns, MonitoringService with audit integration, SecurityEvent model, 3 edge API endpoints, 49 tests.
* **Module 07 (Audit Ledger):** Chained hashing, generic `EventLogger`, PostgreSQL+SQLite support, 87 unit/integration/security tests passing with 98% coverage.
* **Frontend Phase 1:** Design system (CSS tokens, 14 UI components), API client (`api.ts`), Layout (dark sidebar + topbar), Clerk auth gate, 12 routes.
* **Frontend Phase 2a:** Dashboard (stat cards, activity feed, risk map), Question Bank (table, search, filters, delete), Question Editor (SHA-256 hashing, AI normalizer, save & encrypt).
* **Frontend Phase 2b:** Exam Builder (blueprint configurator, compile, status pipeline), Packages (generate, verify RSA, download), Distribution (key release D-012), Centers (CRUD, seating grid, risk scores), Users (Clerk profile, role permission matrix, sync).
* **Frontend Phase 3a:** Desktop Kiosk Auth — AuthPage (QR scan + face verify + webcam + edge health check), edgeApi.ts (full typed edge API client), index.css (premium dark kiosk design system with glassmorphism).
* **Frontend Phase 3b:** Desktop Kiosk Exam — ExamPage (MCQ render, timer ring, question palette, answer auto-save, focus-loss monitoring), SummaryPage (review + auto-submit), CompletePage (submission hash proof), ProtectedRoute guard.
* **Frontend Phase 4:** Audit Explorer (event log, chain verify, JSON/CSV export) and Proctor Dashboard (live monitoring feed, session panel, severity tabs, anomaly detail drawer, supervisor override modal).
* **Backend Gaps Resolved:** GAP-4 (`GET /exam/sessions`), GAP-5 (`PATCH /monitoring/events/{id}/acknowledge`) implemented.
- **Phase:** Sprint 2 — Frontend & Desktop (Phases 1-4 COMPLETE)
- **Next Step:** Phase 5 — Demo Polish (seed/reset scripts, end-to-end rehearsal).
- **Code exists for:** Questions API (`server/app/api/cloud/questions.py`), Monitoring API (`server/app/api/edge/monitoring.py`), Audit API (`server/app/api/common/audit.py` — 8 routes: log, chain, verify, events, export, stats), Graph subsystem (`shared/graph/`), crypto package (`shared/crypto/`), auth pipeline (`server/app/services/auth_service.py`, `server/app/middleware/`)

### Tech Stack
- Backend: Python, FastAPI, PostgreSQL
- Edge: Python, FastAPI, SQLite (WAL mode) — Redis removed per D-010
- Desktop: Electron, React, TypeScript
- Admin Portal: React, Vite, Clerk, TypeScript
- AI: MediaPipe, InsightFace, OpenCV
- Crypto: AES-256-GCM, RSA-2048 (demo) / RSA-4096 (production, D-008), SHA-256
- Graphs: NetworkX

### Architecture
- 3 zones: Cloud (authoring) → Distribution → Edge (exam execution)
- 7 modules: Question Pool, Crypto Delivery, Authentication, Graph Randomization, State Recovery, Anomaly Detection, Audit Ledger
- 4 security layers: Identity → Content → Execution → Audit

### Key Decisions Made
- D-001: Edge-First over Cloud-First
- D-002: AES-256-GCM for question encryption
- D-003: SQLite for edge persistence
- D-004: Graph coloring for anti-copying
- D-005: Hash-chained audit ledger
- D-006: Electron for candidate kiosk
- D-007: MediaPipe for edge AI

### Hackathon Demo Scope
8 flows to demonstrate: question creation, package encryption, candidate auth, spatial randomization, exam execution, state recovery, audit logging, anomaly detection.

---

## Where to Find Things

| Need | Location |
|---|---|
| Project overview | `vault/00_Project/ProjectOverview.md` |
| Current status | `vault/00_Project/CurrentState.md` |
| Architecture decisions | `vault/00_Project/Decisions.md` |
| Module details | `vault/03_Modules/Module0X_*.md` |
| API specs | `vault/04_Implementation/APIContracts.md` |
| DB schema | `vault/04_Implementation/DatabaseDesign.md` |
| Repo structure | `vault/04_Implementation/RepositoryStructure.md` |
| Sprint plan | `vault/05_Development/SprintBoard.md` |
| Current tasks | `vault/05_Development/ActiveTasks.md` |
| Test plan | `vault/06_Testing/TestPlan.md` |
| Frontend plan | `vault/08_Frontend/FrontendImplementationPlan.md` |
| Screen inventory | `vault/08_Frontend/ScreenInventory.md` |
| Stitch designs | `vault/08_Frontend/stitch_screens.json` |
| Source docs | `docs/PRD.md`, `docs/TRD.md`, `docs/Architecture.md` |

---

## Related Documents

- [[AIInstructions]] — Full AI behavior rules
- [[PromptPatterns]] — Useful prompt patterns
- [[AIHandoffTemplate]] — Session handoff format
