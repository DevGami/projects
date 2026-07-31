# FortisExam — Frontend Implementation Plan

> **Last Updated:** 2026-06-11
> **Phase:** Sprint 2 — Frontend & Desktop
> **Status:** 🟡 Planning

---

## 1. Wireframe Analysis — Screen Inventory

Based on the stitch screens image, the application comprises **22 screens** across **4 user roles** and **2 platforms** (Cloud Web Admin + Edge Desktop Kiosk).

---

### Role 1: Examination Authority / Admin (Cloud Portal — `web/`)

| # | Screen Name | Key Features | Backend APIs Used |
|---|---|---|---|
| A1 | **Admin Dashboard** | Module status cards, total questions/exams/centers stats, recent activity timeline, quick action buttons (Create Question, Compile Exam, Release Key) | `GET /questions`, `GET /exams`, `GET /audit/events` |
| A2 | **Question Bank** | CRUD table with search/filter, subject/difficulty tags, encrypted status badge, version history, bulk import | `POST/GET/PUT/DELETE /questions` |
| A3 | **Question Editor** | Rich text editor, option fields (A/B/C/D), correct answer selector, difficulty/subject metadata, auto-encrypt-on-save indicator | `POST /questions`, `PUT /questions/{id}` |
| A4 | **Exam Configuration** | Blueprint builder (subject weight, difficulty distribution, question count), exam metadata (date, duration, name), center assignment | `POST /exams`, `GET /exams`, `POST /exams/{id}/compile` |
| A5 | **Package Management** | List of compiled packages, package status (generated/distributed/key-released), signature/hash display, download & verify buttons | `GET /packages/{id}`, `POST /packages/generate`, `POST /packages/{id}/verify` |
| A6 | **Distribution & Key Release** | Center list with distribution status, "Distribute to Center" button, **"Release Key" button** (D-012), key release timestamp | `GET /distribution/packages`, `GET /distribution/status/{id}`, `POST /exams/{id}/release-key` |
| A7 | **Center Management** | Center CRUD, seating layout editor (grid), seat count, center address/admin assignment | ⚠️ **MISSING API** |
| A8 | **User / Role Management** | User list from Clerk, role assignment (admin/expert/auditor/center_admin/invigilator), invite user | `GET /users`, `POST /users/sync` |

**Total Admin Screens: 8**

---

### Role 2: Auditor (Cloud Portal — `web/`)

| # | Screen Name | Key Features | Backend APIs Used |
|---|---|---|---|
| B1 | **Audit Trail Viewer** | Paginated event list, event type filter, exam scope filter, actor filter, timestamp ordering | `GET /audit/events`, `GET /audit/chain` |
| B2 | **Chain Verification** | "Verify Chain" button, visual chain diagram (hash→hash→hash), green/red integrity status, broken-link indicator | `POST /audit/verify`, `GET /audit/chain` |
| B3 | **Tamper Detection Demo** | Side-by-side: original event vs. tampered, re-verify shows chain break, visual diff | `POST /audit/verify` |
| B4 | **Audit Export** | Export as JSON/CSV, download button, export metadata (timestamp, scope, validity) | `GET /audit/export` |

**Total Auditor Screens: 4**

---

### Role 3: Candidate (Desktop Kiosk — `desktop/`)

| # | Screen Name | Key Features | Backend APIs Used |
|---|---|---|---|
| C1 | **QR Scan / Login** | Camera feed for QR code scanning, manual code entry fallback, QR validation status | `POST /auth/authenticate` |
| C2 | **Face Verification** | Webcam preview, face capture button, match score display, retry on failure, supervisor override link | `POST /auth/authenticate` |
| C3 | **Exam Ready / Waiting** | "Waiting for key release" state, exam metadata display, countdown to start, instructions | `GET /exam/session/{id}` |
| C4 | **Exam Taking** | Question text + options (A/B/C/D), navigation (prev/next/jump), progress bar, timer, auto-save indicator, "Mark for Review" flag | `GET /exam/session/{id}`, `POST /exam/answer` |
| C5 | **Exam Summary / Review** | All questions grid (answered/unanswered/marked), change answers, final submit confirmation dialog | `POST /exam/submit` |
| C6 | **Submission Complete** | Submission confirmation, submission hash display, "Your exam has been submitted securely" | — |
| C7 | **Recovery Screen** | "Previous session detected" prompt, restore or start fresh, answer count restored, timer resumed | `GET /recovery/{candidate_id}`, `POST /recovery/restore/{session_id}` |

**Total Candidate Screens: 7**

---

### Role 4: Invigilator / Proctor (Could be web/ or desktop/)

| # | Screen Name | Key Features | Backend APIs Used |
|---|---|---|---|
| D1 | **Proctor Dashboard** | Live candidate list with status (authenticating/active/submitted), alert feed, session count | `GET /monitoring/events`, ⚠️ **MISSING: `GET /exam/sessions` (list all active sessions)** |
| D2 | **Live Monitoring Feed** | Real-time alert cards (MULTIPLE_FACES, GAZE_DEVIATION, etc.), severity badges, candidate name/seat, acknowledge button | `GET /monitoring/events`, ⚠️ **MISSING: `PATCH /monitoring/events/{id}/acknowledge`** |
| D3 | **Supervisor Override** | Manual override form (reason, invigilator ID), override confirmation | `POST /auth/supervisor-override` |

**Total Proctor Screens: 3**

---

### Summary

| Role | Platform | Screen Count |
|---|---|---|
| Admin / Examination Authority | Cloud Web (`web/`) | 8 |
| Auditor | Cloud Web (`web/`) | 4 |
| Candidate | Desktop Kiosk (`desktop/`) | 7 |
| Invigilator / Proctor | Cloud Web or Desktop | 3 |
| **TOTAL** | | **22** |

---

## 2. API Gap Analysis

Comparing the wireframe features against the implemented backend endpoints:

### ⚠️ Missing Endpoints (must add before/during frontend)

| # | Endpoint | Purpose | Needed By Screen |
|---|---|---|---|
| GAP-1 | `GET /api/v1/centers` | List exam centers | A7 (Center Management) |
| GAP-2 | `POST /api/v1/centers` | Create a center | A7 (Center Management) |
| GAP-3 | `PUT /api/v1/centers/{id}` | Update center (seating layout) | A7 (Center Management) |
| GAP-4 | `GET /api/v1/exam/sessions` | List all active sessions on edge | D1 (Proctor Dashboard) |
| GAP-5 | `PATCH /api/v1/monitoring/events/{id}/acknowledge` | Proctor acknowledges an alert | D2 (Live Monitoring) |
| GAP-6 | `GET /api/v1/dashboard/stats` | Aggregated stats for admin dashboard | A1 (Dashboard) |

### ✅ Existing Endpoints — Fully Covered

All question CRUD, exam compile/release-key, package generate/download/verify, audit log/chain/verify/export, auth/supervisor-override, exam session/answer/submit, recovery snapshot/restore, and monitoring event/events/summary are already implemented.

---

## 3. Phase-Wise Implementation Plan

### Phase 1: Foundation & Design System (Day 1 — ~4 hours)
**Goal:** Shared component library, routing, API client, theming

| Task | Files | Owner | Effort |
|---|---|---|---|
| Install UI dependencies (Lucide icons, a chart lib) | `web/package.json` | Any | 30min |
| Create design tokens & global CSS variables | `web/src/index.css` | Any | 1h |
| Build reusable components: Sidebar, TopBar, Card, Table, Modal, Badge, Button, StatusIndicator | `web/src/components/ui/*` | Any | 2h |
| Create API client service (axios/fetch wrapper with Clerk JWT) | `web/src/services/api.ts` | Any | 30min |
| Set up routing for all admin + auditor pages | `web/src/App.tsx` | Any | 30min |

**Commit:** `feat(frontend): add design system, shared components, and API client`

---

### Phase 2: Admin Cloud Portal (Day 1-2 — ~8 hours)
**Goal:** All 8 admin screens functional and wired to backend

#### Phase 2a: Dashboard + Question Bank (4h)

| Task | Screen | Files | Effort |
|---|---|---|---|
| Admin Dashboard with stat cards and activity feed | A1 | `web/src/pages/Dashboard.tsx` | 2h |
| Question Bank table with search/filter/status | A2 | `web/src/pages/Questions.tsx` | 1.5h |
| Question Create/Edit modal with rich form | A3 | `web/src/components/QuestionEditor.tsx` | 1.5h |
| ⚠️ Add `GET /dashboard/stats` backend endpoint | GAP-6 | `server/app/api/cloud/dashboard.py` | 30min |

**Commit:** `feat(frontend): implement Admin Dashboard and Question Bank UI`

#### Phase 2b: Exam + Package + Distribution (4h)

| Task | Screen | Files | Effort |
|---|---|---|---|
| Exam Configuration page with blueprint builder | A4 | `web/src/pages/Exams.tsx` | 2h |
| Package Management page with status tracking | A5 | `web/src/pages/Packages.tsx` | 1h |
| Distribution & Key Release page | A6 | `web/src/pages/Distribution.tsx` | 1h |
| Center Management page (CRUD + layout editor) | A7 | `web/src/pages/Centers.tsx` | 1h |
| ⚠️ Add center CRUD backend endpoints | GAP-1/2/3 | `server/app/api/cloud/centers.py` | 30min |

**Commit:** `feat(frontend): implement Exam Config, Packages, Distribution, and Centers UI`

---

### Phase 3: Candidate Desktop Kiosk (Day 2-3 — ~10 hours)
**Goal:** Full exam-taking flow in Electron kiosk mode

#### Phase 3a: Auth + Exam UI (5h)

| Task | Screen | Files | Effort |
|---|---|---|---|
| Electron main process kiosk config (fullscreen, no devtools) | — | `desktop/electron/main.js` | 1h |
| QR Scan page with camera integration | C1 | `desktop/src/pages/AuthPage.tsx` | 1.5h |
| Face Verification page with webcam capture | C2 | `desktop/src/pages/FaceVerify.tsx` | 1.5h |
| Waiting Room / Exam Ready screen | C3 | `desktop/src/pages/WaitingRoom.tsx` | 1h |

**Commit:** `feat(desktop): implement kiosk auth flow — QR scan, face verify, waiting room`

#### Phase 3b: Exam Execution + Recovery (5h)

| Task | Screen | Files | Effort |
|---|---|---|---|
| Exam Taking page — question render, options, navigation, timer | C4 | `desktop/src/pages/ExamPage.tsx` | 2.5h |
| Exam Summary / Review page — grid + submit | C5 | `desktop/src/pages/SummaryPage.tsx` | 1h |
| Submission Complete confirmation | C6 | `desktop/src/pages/CompletePage.tsx` | 30min |
| Recovery detection + restore flow | C7 | `desktop/src/pages/RecoveryPage.tsx` | 1h |

**Commit:** `feat(desktop): implement exam taking, review, submission, and crash recovery UI`

---

### Phase 4: Audit Viewer & Proctor Dashboard (Day 3 — ~5 hours)
**Goal:** Audit chain visualization and proctor monitoring

| Task | Screen | Files | Effort |
|---|---|---|---|
| Audit Trail Viewer with filtering | B1 | `web/src/pages/Audit.tsx` | 1.5h |
| Chain Verification visual (hash chain diagram) | B2 | `web/src/pages/AuditVerify.tsx` | 1.5h |
| Audit Export page | B4 | Part of Audit.tsx | 30min |
| Proctor Dashboard with live session list | D1 | `web/src/pages/ProctorDashboard.tsx` | 1h |
| Live Monitoring Feed with alert cards | D2 | `web/src/pages/MonitoringFeed.tsx` | 1h |
| ⚠️ Add `GET /exam/sessions` and `PATCH /monitoring/events/{id}/acknowledge` | GAP-4/5 | `server/app/api/edge/*` | 30min |

**Commit:** `feat(frontend): implement Audit Viewer, Chain Verification, and Proctor Dashboard`

---

### Phase 5: Demo Polish & Integration Testing (Day 4 — ~4 hours)
**Goal:** End-to-end demo readiness

| Task | Files | Effort |
|---|---|---|
| Demo seed script (20 questions, 2 exams, 6 candidates, 1 center) | `scripts/seed-demo-data.py` | 1h |
| Demo reset script (wipe and re-seed) | `scripts/demo-reset.sh` | 30min |
| Tamper detection demo page (modify audit event, re-verify) | B3 `web/src/pages/TamperDemo.tsx` | 1h |
| End-to-end walkthrough: Act 1→2→3→4 from DemoFlow.md | Manual | 1h |
| Bug fixes, responsive tweaks, loading states | Various | 1h |

**Commit:** `feat(demo): add seed/reset scripts and tamper detection demo page`

---

## 4. API Gap Implementation Details

These small backend additions should be done **before or in parallel** with the frontend phases:

### GAP-1/2/3: Center CRUD (`server/app/api/cloud/centers.py`)

```
POST   /api/v1/centers           → Create center (name, address, seat_count, layout_grid)
GET    /api/v1/centers           → List all centers
PUT    /api/v1/centers/{id}      → Update center (seating layout)
```

The `Center` model already exists in `server/app/models/center.py`. Just needs routes + service.

### GAP-4: List Active Sessions (`server/app/api/edge/exam.py`)

```
GET    /api/v1/exam/sessions     → List all active sessions (for proctor)
```

`ExamSession` model already exists. Add a query route.

### GAP-5: Acknowledge Alert (`server/app/api/edge/monitoring.py`)

```
PATCH  /api/v1/monitoring/events/{id}/acknowledge  → Mark alert as acknowledged
```

`MonitoringService.acknowledge_event()` already exists — just needs a route.

### GAP-6: Dashboard Stats (`server/app/api/cloud/dashboard.py`)

```
GET    /api/v1/dashboard/stats   → { total_questions, total_exams, total_centers, total_audit_events, recent_activity[] }
```

Aggregation query across existing models.

---

## 5. Default Agent Handoff Prompt

Use this prompt when any team member needs an AI agent to continue frontend work:

````
Read first:
* vault/00_Project/CurrentState.md
* vault/07_AI_Context/ContextSummary.md
* vault/05_Development/ActiveTasks.md
* vault/08_Frontend/FrontendImplementationPlan.md
* vault/08_Frontend/ManualTestingChecklist.md

Inspect the existing codebase:
* web/src/ (Cloud Admin Portal — React + Vite + Clerk)
* desktop/src/ (Candidate Kiosk — Electron + React)
* server/app/api/ (Backend API endpoints)

Do not assume files are stubs. Evaluate existing code before modifying.

---

DESIGN REFERENCE:
Almost every screen has already been designed in a stitch/wireframe document.
The stitch screens cover all 22 screens across 4 roles (Admin, Auditor, Candidate, Proctor).
Refer to the screen inventory in vault/08_Frontend/FrontendImplementationPlan.md (Section 1) for the full mapping of screen IDs (A1-A8, B1-B4, C1-C7, D1-D3) to features.
Match the layout, component placement, and feature set from the stitch wireframes exactly.
Do NOT invent new screens or rearrange UI elements — the designs are final.

---

ROLE: Lead Frontend Engineer for FortisExam.

CURRENT PHASE: [FILL IN: Phase 2a / 2b / 3a / 3b / 4 / 5]

OBJECTIVE:
Implement the screens listed in the current phase of vault/08_Frontend/FrontendImplementationPlan.md.

REQUIREMENTS:
1. Wire each page to the real backend API endpoints
2. Use the shared design system from web/src/components/ui/
3. Add loading, error, and empty states to every page
4. Ensure Clerk auth wraps all admin pages
5. Use edge JWT auth for all desktop/kiosk pages
6. Follow the stitch screen designs — match layout, features, and component placement

AFTER IMPLEMENTATION:
1. Run the dev server and verify pages render
2. Create automated smoke tests if applicable
3. Update vault/08_Frontend/ManualTestingChecklist.md with test results
4. Update vault/00_Project/CurrentState.md and vault/05_Development/ActiveTasks.md
5. Commit with descriptive message matching the phase

COMMIT CONVENTION:
- Feature: `feat(frontend): <description>`
- Tests: `test(frontend): <description>`
- Fixes: `fix(frontend): <description>`
- Docs: `docs(frontend): <description>`

Stop after completing the current phase. Do not begin the next phase.
````

---

## 6. Phase-Wise Manual Testing Checklists

### Phase 1 Manual Testing: Foundation

| # | Test | Steps | Expected Result |
|---|---|---|---|
| 1.1 | Dev server starts | `cd web && npm run dev` | Vite serves on localhost:5173 |
| 1.2 | Clerk auth gate | Open localhost:5173 without login | Clerk SignIn component renders |
| 1.3 | Clerk login works | Sign in with test credentials | Redirected to Dashboard |
| 1.4 | Sidebar navigation | Click each nav item | Correct page renders, URL updates |
| 1.5 | API client works | Open Dashboard (check console) | API call to /health returns 200 |

---

### Phase 2 Manual Testing: Admin Portal

| # | Test | Steps | Expected Result |
|---|---|---|---|
| 2.1 | Dashboard loads stats | Navigate to `/` | Stat cards show question/exam/center counts |
| 2.2 | Create question | Click "New Question", fill form, save | Question appears in table, encrypted badge shown |
| 2.3 | Edit question | Click edit on existing question | Pre-filled form, save updates correctly |
| 2.4 | Delete question | Click delete, confirm | Question removed from list |
| 2.5 | Create exam | Navigate to Exams, click Create | Form with blueprint fields |
| 2.6 | Compile exam | Click "Compile" on existing exam | Package generated, hash displayed |
| 2.7 | Release key | Click "Release Key" on distributed exam | Key released timestamp shown, status updated |
| 2.8 | View packages | Navigate to Packages | List with status badges (generated/distributed) |
| 2.9 | Verify package | Click "Verify" on a package | Integrity check result shown (valid/invalid) |
| 2.10 | Manage centers | Navigate to Centers, CRUD operations | Create/edit/delete centers with seating grid |
| 2.11 | Manage users | Navigate to Users | Clerk user list with role assignment |

---

### Phase 3 Manual Testing: Candidate Kiosk

| # | Test | Steps | Expected Result |
|---|---|---|---|
| 3.1 | Electron starts in kiosk | `cd desktop && npm run dev:electron` | Fullscreen, no devtools, no menu bar |
| 3.2 | QR scan page | App opens | Camera feed visible, QR scanner active |
| 3.3 | QR validation | Scan valid QR token | "Authenticated" → proceed to face verify |
| 3.4 | Invalid QR rejected | Scan tampered QR | Error message, stays on scan page |
| 3.5 | Face verification | Webcam captures face | Match score shown, session created |
| 3.6 | Waiting room | After auth, before key release | "Waiting for exam to start" message |
| 3.7 | Exam loads | After key released | Questions render with options, timer starts |
| 3.8 | Answer selection | Click option A/B/C/D | Option highlighted, auto-save indicator flashes |
| 3.9 | Navigation | Click Next/Previous/Jump | Correct question loads, progress bar updates |
| 3.10 | Timer countdown | Wait 30 seconds | Timer decrements, visual warning at 5 min |
| 3.11 | Summary page | Click "Review" | Grid shows answered/unanswered/marked |
| 3.12 | Submit exam | Click "Submit", confirm dialog | Submission hash shown, "Thank You" screen |
| 3.13 | Crash recovery | Kill Electron, reopen, re-auth | "Previous session found" → Restore → Answers restored, timer resumed |

---

### Phase 4 Manual Testing: Audit & Proctor

| # | Test | Steps | Expected Result |
|---|---|---|---|
| 4.1 | Audit trail loads | Navigate to Audit page | Event list with type/actor/timestamp |
| 4.2 | Filter by type | Select "ANOMALY_DETECTED" filter | Only anomaly events shown |
| 4.3 | Verify chain | Click "Verify Chain" | Green "Chain Valid" with event count |
| 4.4 | Export JSON | Click "Export JSON" | JSON file downloads with metadata |
| 4.5 | Export CSV | Click "Export CSV" | CSV file downloads |
| 4.6 | Proctor dashboard | Navigate to Proctor Dashboard | Live session list with candidate statuses |
| 4.7 | Alert feed | Trigger anomaly (multi-face) | Alert card appears with HIGH severity badge |
| 4.8 | Acknowledge alert | Click "Acknowledge" on alert | Alert marked as acknowledged |

---

### Phase 5 Manual Testing: Demo Readiness

| # | Test | Steps | Expected Result |
|---|---|---|---|
| 5.1 | Seed script | Run `python scripts/seed-demo-data.py` | 20 questions, 2 exams, 6 candidates, 1 center created |
| 5.2 | Reset script | Run `scripts/demo-reset.sh` | DB wiped and re-seeded cleanly |
| 5.3 | Tamper demo | Modify audit event, re-verify | Chain breaks at tampered event, red indicator |
| 5.4 | Full Act 1 | Create Q → Compile → Distribute → Release Key | Entire flow completes in < 2 min |
| 5.5 | Full Act 2 | QR → Face → Exam → Spatial randomization visible | Two kiosk instances show different variant orders |
| 5.6 | Full Act 3 | Answer questions → Kill process → Recover | Recovery in < 60s, all answers intact |
| 5.7 | Full Act 4 | View audit → Verify → Tamper → Re-verify | Chain integrity proven, tamper detected |

---

## 7. Vault File Locations

This plan should be saved to:

```
vault/08_Frontend/FrontendImplementationPlan.md    ← This document
vault/08_Frontend/ManualTestingChecklist.md        ← Phase-wise testing
vault/08_Frontend/ScreenInventory.md               ← Per-screen feature breakdown
```

Update after each phase:
```
vault/00_Project/CurrentState.md       ← Module/phase status
vault/05_Development/ActiveTasks.md    ← Task tracking
vault/05_Development/Changelog.md      ← Changes log
vault/07_AI_Context/ContextSummary.md  ← AI context
```
