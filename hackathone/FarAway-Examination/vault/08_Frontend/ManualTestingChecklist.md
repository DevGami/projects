# FortisExam — Manual Testing Status & Bug Report

> **Last Updated:** 2026-06-12
> **Tested Phases:** Phase 1–4 (Foundation → Question Bank → Exams/Packages/Distribution/Centers/Users → Desktop Kiosk → Audit/Monitoring/TamperDemo)
> **Testers:** QA Team

---

## 🚀 Quick Start for Testers

Before running any test:

```bash
# Terminal 1 — Backend (from project root)
python -m uvicorn server.app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend (from web/)
npm run dev
```

Then open the **interactive checklist** in your browser:
```
vault\06_Testing\TESTING_CHECKLIST.html
```
> The HTML checklist has Pass / Fail / Skip buttons with progress tracking, filters, and a copy-report feature. Use it to log results.

| URL | Purpose |
|---|---|
| http://localhost:5173 | Admin Portal (main thing to test) |
| http://localhost:8000/docs | Swagger API docs (backend test) |
| http://localhost:8000/health | Backend health check |

---

## ⚠️ Important Context for Testers

### Demo Data vs. Real Data

Most Phase 2b and Phase 4 pages show a **yellow banner** at the top when the backend API is not available.

**Rule for testers:**
- ✅ PASS: Page renders with demo data + yellow banner, modals open, buttons work
- ❌ FAIL: Page crashes, shows white screen, modal doesn't open, layout is broken
- ✅ PASS: Network request fires (even if backend returns an error)
- ❌ FAIL: Clicking a button does nothing at all (no network request, no UI feedback)

---

## 1. Dashboard (`/`)
**Status:** ✅ Working (GAP-6 now implemented)
**Frontend File:** `web/src/pages/Dashboard.tsx`
**Wired Endpoints:** `GET /api/v1/dashboard/stats`

**Test checklist:** D-01 through D-09 in `TESTING_CHECKLIST.html`

---

## 2. Question Bank List (`/questions`)
**Status:** ✅ Working (real API wired)
**Frontend File:** `web/src/pages/Questions.tsx`
**Wired Endpoints:**
- `GET /api/v1/questions` — list with `{items, total, page, page_size}` wrapper
- `DELETE /api/v1/questions/{id}` — soft delete

**Test checklist:** Q-01 through Q-13 in `TESTING_CHECKLIST.html`

---

## 3. Question Editor (`/questions/new`, `/questions/:id/edit`)
**Status:** ✅ Fixed — Save now works correctly
**Frontend File:** `web/src/pages/QuestionEditor.tsx`
**Wired Endpoints:**
- `POST /api/v1/questions/` — create
- `GET /api/v1/questions/{id}` — load for edit
- `PUT /api/v1/questions/{id}` — update

**Test checklist:** E-01 through E-10 in `TESTING_CHECKLIST.html`

---

## 4. Exam Builder (`/exams`)
**Status:** 🟡 UI Complete — Backend Create/List are stubs
**Frontend File:** `web/src/pages/Exams.tsx`
**Wired Endpoints:**
- `GET /api/v1/exams/` — list (backend returns stub/None — demo data shown)
- `POST /api/v1/exams/` — create (backend is a stub — error expected)
- `POST /api/v1/exams/{id}/compile` — compile (backend stub)
- `POST /api/v1/exams/{id}/release-key` — ✅ **FULLY IMPLEMENTED** (RSA key wrapping works)

**Test checklist:** EX-01 through EX-14 in `TESTING_CHECKLIST.html`

---

## 5. Package Management (`/packages`)
**Status:** 🟡 UI Complete — Verify and Download are real
**Frontend File:** `web/src/pages/Packages.tsx`
**Wired Endpoints:**
- `GET /api/v1/distribution/packages` — list (demo fallback)
- `POST /api/v1/packages/{id}/verify` — ✅ **REAL** (RSA signature verification)
- `GET /api/v1/packages/{id}/download` — ✅ **REAL** (encrypted payload download)

**Test checklist:** PK-01 through PK-11 in `TESTING_CHECKLIST.html`

---

## 6. Distribution & Key Release (`/distribution`)
**Status:** 🟡 UI Complete — Read-only (no write endpoints)
**Frontend File:** `web/src/pages/Distribution.tsx`
**Wired Endpoints:**
- `GET /api/v1/distribution/packages` — list packages with status (demo fallback)

**Test checklist:** DI-01 through DI-09 in `TESTING_CHECKLIST.html`

---

## 7. Center Management (`/centers`)
**Status:** 🟡 UI Complete — Backend CRUD (GAP-1/2/3) not yet implemented
**Frontend File:** `web/src/pages/Centers.tsx`
**Wired Endpoints:**
- `GET /api/v1/centers` — ⚠️ GAP-1 (not yet built, demo fallback)
- `POST /api/v1/centers` — ⚠️ GAP-2 (not yet built, demo simulates)
- `PUT /api/v1/centers/{id}` — ⚠️ GAP-3 (not yet built)

**Test checklist:** CE-01 through CE-14 in `TESTING_CHECKLIST.html`

---

## 8. User & Role Management (`/users`)
**Status:** ✅ Working (profile loads from real Clerk JWT)
**Frontend File:** `web/src/pages/Users.tsx`
**Wired Endpoints:**
- `GET /api/v1/users/me` — ✅ **REAL** (returns from Clerk JWT claims)
- `POST /api/v1/users/sync` — ✅ **REAL** (syncs Clerk user to local DB)

**Test checklist:** U-01 through U-11 in `TESTING_CHECKLIST.html`

---

## 9. Audit Explorer (`/audit`) — Phase 4 ✅ NEW
**Status:** ✅ Complete — Real API wired with demo fallback
**Frontend File:** `web/src/pages/Audit.tsx`
**Wired Endpoints:**
- `GET /api/v1/audit/events?event_type=&exam_id=&actor_id=&page=&page_size=` — list audit events
- `POST /api/v1/audit/verify?exam_id=` — verify full chain integrity
- `GET /api/v1/audit/export/{exam_id}?fmt=json|csv` — download audit chain export
- `GET /api/v1/audit/stats?exam_id=` — chain statistics

**What to test:**

| Test ID | Test | Expected |
|---|---|---|
| AU-01 | Navigate to `/audit` | Page loads — 4 stat cards + event table visible (no white screen) |
| AU-02 | Events table has data | 7 demo events visible (or real events if backend running) |
| AU-03 | Click a table row | Row expands showing full hash values, payload JSON, and timestamp |
| AU-04 | Click again to collapse row | Row collapses back |
| AU-05 | Event Type filter dropdown | Select "ANOMALY_DETECTED" → table filters to only those events |
| AU-06 | Search box works | Type "CANDIDATE" → matching rows shown |
| AU-07 | Clear button resets filters | All events show again |
| AU-08 | Switch to "Chain Verification" tab | Verification panel renders with description |
| AU-09 | Click "Verify Chain" button | Result card appears: green ✅ Valid OR red ❌ Broken with details |
| AU-10 | Verification shows: total events, verified count | Two/three stat boxes inside result card |
| AU-11 | Hash chain visualization below verify | Last 5 events shown as chain nodes connected by vertical line |
| AU-12 | Switch to "Export" tab | Export form renders with Exam ID field + format radios |
| AU-13 | Enter exam ID + click Download | File download triggers (.json or .csv) |
| AU-14 | Demo banner shows if backend down | Yellow "Demo Mode" banner at top of page |

---

## 10. Live Monitoring (`/monitoring`) — Phase 4 ✅ NEW
**Status:** ✅ Complete — Reads from audit chain (cloud-accessible) with demo fallback
**Frontend File:** `web/src/pages/Monitoring.tsx`
**Wired Endpoints:**
- `GET /api/v1/audit/events?event_type=ANOMALY_DETECTED` — security events feed (via cloud audit chain)
- `PATCH /api/v1/monitoring/events/{id}/acknowledge` — ⚠️ GAP-5 (optimistic UI only — backend route not yet built)

**What to test:**

| Test ID | Test | Expected |
|---|---|---|
| MO-01 | Navigate to `/monitoring` | Page loads — 4 stat cards + event feed visible (no white screen) |
| MO-02 | Stat cards show counts | Active Sessions / Total Alerts / Unacknowledged / Critical+High |
| MO-03 | Event feed shows demo events | Cards with severity badge (colored), alert type icon, candidate info |
| MO-04 | Severity tabs visible | All / Critical / High / Medium / Low with counts in badges |
| MO-05 | Click "Critical" tab | Feed filters to only CRITICAL severity events |
| MO-06 | Click "Acknowledge" on an event | Button disappears, "Acknowledged ✓" label appears instantly |
| MO-07 | Active Sessions panel on right | 5 session buttons with initial avatar circles, red alert count badges |
| MO-08 | Click a session button | Event feed filters to only that session's events |
| MO-09 | "Clear Session Filter" button appears | Click removes session filter, all events show |
| MO-10 | Alert Breakdown by Severity card | 4 progress bars (CRITICAL/HIGH/MEDIUM/LOW) with percentages |
| MO-11 | By Alert Type card | Icons + counts for each alert type (Multiple Faces, No Face, etc.) |
| MO-12 | Auto-refresh toggle button works | Toggle: "Auto (15s)" ↔ "Manual" — button appearance changes |
| MO-13 | Last refresh timestamp visible | "HH:MM:SS" shown next to page header |
| MO-14 | Demo banner shows when no real events | Yellow "Demo Mode" banner at top |
| MO-15 | Click "Details" on any event card | Side drawer slides in from right with full event context |
| MO-16 | Drawer: severity badge + acknowledged status visible | Correct color badge + "Acknowledged ✓" or "Unacknowledged" |
| MO-17 | Drawer: Detection Details grid visible | Key-value pairs from event.details object shown |
| MO-18 | Drawer: "Acknowledge Alert" button in drawer works | Button disappears, label changes to "Acknowledged ✓" |
| MO-19 | Drawer: "Supervisor Override" button opens modal | Modal opens with Invigilator ID, Candidate, Reason fields |
| MO-20 | Supervisor Override Modal: fill & submit | "Override Submitted" success screen appears with check icon |
| MO-21 | "Supervisor Override" header button opens empty modal | Modal opens without pre-filled candidate or session |

---

## 11. Tamper Detection Demo (`/tamper`) — Phase 4 ✅ NEW
**Status:** ✅ Complete — Real API + demo fallback (step-through interactive demo)
**Frontend File:** `web/src/pages/TamperDemo.tsx`
**Wired Endpoints:**
- `POST /api/v1/audit/log` — log a real event to chain
- `POST /api/v1/audit/verify` — verify chain integrity

**What to test:**

| Test ID | Test | Expected |
|---|---|---|
| TD-01 | Navigate to `/tamper` | Page loads — 4 stat cards + 4-step visual stepper visible |
| TD-02 | Stat cards: Security Property / SHA-256 / Detection Rate / Alert Breakdown | All 4 visible |
| TD-03 | Step 1: Configure Event form visible | Actor ID / Exam ID / Question Content fields |
| TD-04 | Click "Log Event to Chain" | Step advances to 2 — success alert shows "Event logged! Sequence #X" |
| TD-05 | Step 2: Tampering scenario visible | Red "Adversary Attack Simulation" box with diff (old/new payload) |
| TD-06 | Click "Verify Chain Integrity" | Loading spinner, then result appears |
| TD-07 | Result shows broken chain (demo) | ❌ Red "Tampering Detected!" card with sequence number, verified count, failure reason |
| TD-08 | "Reset Demo" button works | All steps reset to Step 1 |
| TD-09 | "How Hash Chaining Works" sidebar | 4 explanation cards: 📝 Event Logged / 🔗 Chain Linked / 🔍 Verification / 🚨 Tamper Alert |

---

## 📋 Known Issues & Notes (Phase 4)

| # | Page | Issue | Severity | Status |
|---|---|---|---|---|
| KI-1 | Exams | `POST /exams/` returns `None` (stub) | Medium | Known — backend stub |
| KI-2 | Packages | Verify fires but may 404 for demo package IDs | Low | Expected (demo IDs) |
| KI-3 | Centers | All CRUD fires to GAP-1/2/3 endpoints that don't exist yet | Medium | Known — GAP pending |
| KI-4 | Monitoring | Acknowledge button calls GAP-5 (not yet in backend) — optimistic only | Low | By design — UI updates correctly |
| KI-5 | Monitoring | Active Sessions list is demo (GAP-4 `GET /exam/sessions` not built) | Medium | By design |
| KI-6 | All Phase 4 | Yellow "Demo Mode" banner when backend is down | Info | Expected behaviour |

---

## 📋 Teammate Action Items

### Tester 1 — Focus: Phase 1 + 2a + 2b regression
Test categories: **Infra (I-xx), Auth (A-xx), Navigation (N-xx), Dashboard (D-xx), Question Bank (Q-xx), Question Editor (E-xx), Exams (EX-xx), Packages (PK-xx), Distribution (DI-xx), Centers (CE-xx), Users (U-xx)**

### Tester 2 — Focus: Phase 4 new security pages
Test categories: **Audit Explorer (AU-xx), Live Monitoring (MO-xx), Tamper Demo (TD-xx)**

After each session, use the **📋 Copy Report** button in the HTML checklist to copy results and paste into the team chat.

---

## 🐛 Reporting a Bug

When you find a real failure (not a known issue), add it to `vault/06_Testing/BugTracker.md` using the template:

```
### BUG-XXX: [Short title]
- **Page:** /route
- **Test ID:** XX-00
- **Steps:** What you did
- **Expected:** What should happen
- **Actual:** What happened instead
- **Severity:** Critical / High / Medium / Low
- **Screenshot/Note:** Optional
```