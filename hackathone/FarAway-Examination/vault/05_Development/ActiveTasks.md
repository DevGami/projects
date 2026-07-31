# FortisExam — Active Tasks

> **Last Updated:** 2026-06-12
> **Current Sprint:** Sprint 2 (Frontend & Desktop)

---

## 🟢 Completed

| Task | Track | Assignee | Notes |
|---|---|---|---|
| ~~Vault creation~~ | Docs | AI Agent | ✅ Complete |
| ~~Architecture analysis~~ | Docs | AI Agent | ✅ Complete |
| ~~Sprint planning~~ | Docs | AI Agent | ✅ Complete |
| ~~Module 04: Graph Randomization~~ | Backend | AI Agent | ✅ Complete |
| ~~Module 05: State Recovery~~ | Backend | Team Member | ✅ Complete (58 tests, 99% coverage) |
| ~~Module 07: Audit Ledger~~ | Backend | AI Agent | ✅ 87 tests, 98% coverage |
| ~~Module 02: Crypto Delivery~~ | Backend | AI Agent | ✅ 219 tests, 92% coverage |
| ~~Module 03: Authentication~~ | Backend | AI Agent | ✅ 282 tests, 81% coverage |
| ~~Module 02 & 03 Test Hardening~~ | QA | ayaan-goel | ✅ 354 total tests |
| ~~Module 01: Question Pool~~ | Backend | AI Agent | ✅ 12 tests, Alembic schema, CRUD |
| ~~Module 06: Anomaly Detection~~ | Backend | Harsh Bhavsar | ✅ 49 tests, rule engine, 3 API endpoints |
| ~~Frontend Phase 1: Foundation~~ | Frontend | AI Agent | ✅ Design system, components, API client, routing |
| ~~Frontend Phase 2a: Question Bank~~ | Frontend | Harsh Bhavsar | ✅ Questions list, QuestionEditor, Dashboard — merged 2026-06-12 |
| ~~Frontend Phase 2b: Exam Config~~ | Frontend | AI Agent | ✅ Exams, Packages, Distribution, Centers, Users — merged 2026-06-12 |
| ~~Frontend Phase 3a: Kiosk Auth~~ | Desktop | Team Member | ✅ QR scan, face verify, edge health check, webcam, ProtectedRoute |
| ~~Frontend Phase 3b: Exam Execution~~ | Desktop | Team Member | ✅ ExamPage (MCQ, timer, palette, auto-save), SummaryPage (review, auto-submit), CompletePage (hash proof), edgeApi.ts (full typed client) |

---

## ✅ Frontend Phase 3 — COMPLETE

### Desktop Kiosk Deliverables

| File | Status | Description |
|---|---|---|
| `desktop/src/App.tsx` | ✅ Done | Routes: `/` (Auth), `/exam` (Protected), `/summary` (Protected), `/complete`. ProtectedRoute guard via localStorage `exam_session`. |
| `desktop/src/pages/AuthPage.tsx` | ✅ Done | 3-step auth: CONNECTING (edge health check) → SCAN_QR (barcode scanner input + simulate button) → FACE_VERIFY (webcam + face guide overlay + capture). Error/success states with retry. |
| `desktop/src/pages/ExamPage.tsx` | ✅ Done | Full exam UI: question content, A/B/C/D options with selection glow, question palette (answered/flagged/current), SVG timer ring (orange < 5min), Previous/Next/Flag/Review buttons, focus-loss monitoring, auto-save via `submitAnswer()`. |
| `desktop/src/pages/SummaryPage.tsx` | ✅ Done | Review panel: candidate name, exam, total/answered/unanswered counts. Auto-submit on timer expiry. "Confirm Submission" → POST `/exam/submit` → navigate `/complete`. |
| `desktop/src/pages/CompletePage.tsx` | ✅ Done | Success screen: ✓ circle, submission hash in monospace, answers count. Clears localStorage session. "Return to Login" resets. |
| `desktop/src/services/edgeApi.ts` | ✅ Done | Full typed HTTP client: `authenticate()`, `supervisorOverride()`, `getSession()`, `submitAnswer()`, `submitExam()`, `checkSnapshot()`, `restoreSession()`, `reportMonitoringEvent()`, `checkEdgeHealth()`. All types exported. |
| `desktop/src/index.css` | ✅ Done | 662-line premium dark design system: glassmorphism cards, ambient gradients, QR scan frame + scan-line animation, webcam frame + face-guide oval pulse, MCQ option buttons with selection glow, question palette pills, SVG timer ring, progress bars, spinner, check-circle pop animation, utility classes. |
| `desktop/electron/main.js` | ✅ Done | Kiosk config: fullscreen, frameless, no devtools, context isolation, keyboard shortcut blocking (Ctrl+Shift+I, F12, Ctrl+W). |

### Integration Notes

| Item | Status |
|---|---|
| Edge API client uses `http://localhost:8001/api/v1` | ✅ |
| Auth uses edge-local RS256 JWTs (no Clerk) | ✅ |
| Monitoring events (focus loss) reported to `/monitoring/event` | ✅ |
| Answer submission auto-saves with snapshot via `/exam/answer` | ✅ |
| Recovery flow typed in `edgeApi.ts` (checkSnapshot, restoreSession) | ✅ |
| ProtectedRoute prevents `/exam` and `/summary` access without session | ✅ |

## Current Task: Phase 5 - Demo Polish (COMPLETE)
**Goal:** Deliver a polished, unified demo experience for hackathon judges with a single-click reset capability.
**Status:** COMPLETE 🟢

### Subtasks:
- [x] Create `seed_demo.py` script to populate Edge SQLite DB (30 questions, 1 exam, 3 centers, 9 candidates, 8 chain events).
- [x] Implement robust AES-GCM encryption within the seed script to accurately mock Question payload.
- [x] Create `reset_demo.py` script for instant DB wiping and reseeding.
- [x] Fix `GET /dashboard/stats` in backend to display live statistics properly.
- [x] Build `DemoLanding.tsx` (Premium animated UI mapping out 8 key Security Guarantees).
- [x] Wire up the new `/demo` route in the sidebar layout.
- [x] Run full end-to-end integration and frontend compilation pass (0 Errors).

---

## 🟧 IN PROGRESS / UP NEXT

| Task | Track | Assignee | Notes |
|---|---|---|---|
| Phase 5: Demo Polish | Full Stack | AI Agent | Seed/reset scripts, end-to-end rehearsal, final testing. |

---

## 🟢 Recently Completed

| Task | Track | Date |
|---|---|---|
| Frontend Phase 4: Audit & Proctor Dashboard | Frontend | 2026-06-12 |
| Frontend Phase 4: A7f Anomaly Drawer & D3 Override | Frontend | 2026-06-12 |
| Backend GAP-4: `GET /exam/sessions` | Backend | 2026-06-12 |
| Backend GAP-5: `PATCH /monitoring/events/{id}/acknowledge` | Backend | 2026-06-12 |

---

## 🔴 Backend Gaps

| Gap | What's Missing | Files | Priority |
|---|---|---|---|
| GAP-4 | `GET /exam/sessions` | `server/app/api/edge/exam.py` | ✅ Completed |
| GAP-5 | `PATCH /monitoring/events/{id}/acknowledge` | `server/app/api/edge/monitoring.py` | ✅ Completed |

**Note:** GAP-1/2/3 (ExamService, Centers CRUD, Dashboard stats) may have been filled by team member during Phase 3. Frontend already handles these with demo data fallback.

---

## 📋 Backlog (Phase 4–5)

| Phase | Task |
|---|---|
| 4 | Audit Explorer (B1/B1b), Chain Verification visual, Audit Export (B4) |
| 4 | Proctor Dashboard, Live Monitoring Feed (D1/D2), Center Admin views |
| 4 | Backend: GAP-4 (sessions list) + GAP-5 (acknowledge alert) |
| 5 | Demo seed/reset scripts, tamper demo page |
| 5 | End-to-end walkthrough rehearsal |

---

## Related Documents

- [[BackendGaps]] — Active backend gaps
- [[StitchScreenRegistry]] — Stitch screen → phase mapping
