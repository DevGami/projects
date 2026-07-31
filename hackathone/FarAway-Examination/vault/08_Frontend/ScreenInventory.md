# FortisExam — Screen Inventory
# (From Stitch designs — June 2026)

> **Source:** 7 Stitch projects, 39 total screens
> **Extracted:** 2026-06-11 via Stitch MCP API

---

## Admin Portal (`web/`) — FortisExam Admin Dashboard project

| Screen ID | Stitch Name | File | Phase | Status |
|---|---|---|---|---|
| A1 | Main Overview Dashboard | `pages/Dashboard.tsx` | Phase 1 | ✅ Implemented |
| A2 | Question Bank List | `pages/Questions.tsx` | Phase 2a | 🟡 Placeholder |
| A3 | Question Editor | `components/QuestionEditor.tsx` | Phase 2a | 🔴 Not started |
| A4 | Exam Blueprint Configurator | `pages/Exams.tsx` | Phase 2b | 🟡 Placeholder |
| A5 | Exam Package Manifest | `pages/Packages.tsx` | Phase 2b | 🟡 Placeholder |
| A5b | Exam List Dashboard | (part of Exams.tsx) | Phase 2b | 🟡 Placeholder |
| A5c | Exam Status Timeline Modal | (modal in Exams.tsx) | Phase 2b | 🔴 Not started |
| A6 | Distribution & Key Release | `pages/Distribution.tsx` | Phase 2b | 🟡 Placeholder |
| A8 | AI Normalization Report | (part of Questions.tsx) | Phase 2a | 🔴 Not started |

## Center Management Portal — FortisExam Center Management Platform project

| Screen ID | Stitch Name | File | Phase | Status |
|---|---|---|---|---|
| A7a | Center Management List | `pages/Centers.tsx` | Phase 2b | 🟡 Placeholder |
| A7b | Center Detail & Seating Builder | (modal in Centers.tsx) | Phase 2b | 🔴 Not started |
| A7c | Center Drill-Down - Live View | `pages/Monitoring.tsx` | Phase 4 | 🟡 Placeholder |
| A7d | Center Risk Report | (part of Centers.tsx) | Phase 2b | 🔴 Not started |
| A7e | Live Monitoring - National Overview | `pages/Monitoring.tsx` | Phase 4 | 🟡 Placeholder |
| A7f | Anomaly Detail Drawer | (drawer in Monitoring.tsx) | Phase 4 | 🔴 Not started |

## Expert / Secure Portal — FortisExam Secure Portal project

| Screen ID | Stitch Name | File | Phase | Status |
|---|---|---|---|---|
| A3b | Expert - My Questions | `pages/Questions.tsx` | Phase 2a | 🔴 Not started |
| A3c | Expert - Question Editor & AI Normalizer | `components/QuestionEditor.tsx` | Phase 2a | 🔴 Not started |
| D1b | Center Admin - Overview | `pages/Monitoring.tsx` | Phase 4 | 🔴 Not started |
| D2b | Center Admin - Live Monitoring | `pages/Monitoring.tsx` | Phase 4 | 🔴 Not started |

## Security Operations Console — FortisExam Security Operations Console project

| Screen ID | Stitch Name | File | Phase | Status |
|---|---|---|---|---|
| B1 | Audit Explorer - Auditor | `pages/Audit.tsx` | Phase 4 | 🟡 Placeholder |
| B1b | Audit Explorer - FortisExam | `pages/Audit.tsx` | Phase 4 | 🟡 Placeholder |
| B2 | Tamper Detection Alert | `pages/TamperDemo.tsx` | Phase 5 | 🟡 Placeholder |
| B4 | Export Report - Auditor | (part of Audit.tsx) | Phase 4 | 🔴 Not started |
| D2 | Auth Station - Invigilator | `pages/Monitoring.tsx` | Phase 4 | 🔴 Not started |
| D3 | Supervisor Override Form | `pages/Monitoring.tsx` | Phase 4 | 🔴 Not started |
| B3 | Leak Monitor | `pages/TamperDemo.tsx` | Phase 5 | 🟡 Placeholder |

## Candidate Kiosk (`desktop/`) — FortisExam Candidate Kiosk project

| Screen ID | Stitch Name | File | Phase | Status |
|---|---|---|---|---|
| C4a | Active Exam - MCQ Question | `desktop/src/pages/ExamPage.tsx` | Phase 3b | 🔴 Not started |
| C4b | Active Exam - Numerical Question | `desktop/src/pages/ExamPage.tsx` | Phase 3b | 🔴 Not started |
| C3a | General Instructions | `desktop/src/pages/WaitingRoom.tsx` | Phase 3a | 🔴 Not started |
| C4c | Section Transition | `desktop/src/pages/ExamPage.tsx` | Phase 3b | 🔴 Not started |

## Kiosk Auth Flow — FortisExam Kiosk Design System project

| Screen ID | Stitch Name | File | Phase | Status |
|---|---|---|---|---|
| C1 | Step 1: QR Verification | `desktop/src/pages/AuthPage.tsx` | Phase 3a | 🔴 Not started |
| C2 | Step 2: Face Verification | `desktop/src/pages/FaceVerify.tsx` | Phase 3a | 🔴 Not started |
| C3b | Step 3: Seat Confirmation | `desktop/src/pages/WaitingRoom.tsx` | Phase 3a | 🔴 Not started |
| C3c | System Ready Splash | `desktop/src/pages/WaitingRoom.tsx` | Phase 3a | 🔴 Not started |
| C6 | Submission Confirmed | `desktop/src/pages/CompletePage.tsx` | Phase 3b | 🔴 Not started |
| C6b | Official Submission Confirmed | `desktop/src/pages/CompletePage.tsx` | Phase 3b | 🔴 Not started |
| C6c | Auto-Submit Transition | `desktop/src/pages/CompletePage.tsx` | Phase 3b | 🔴 Not started |
| C7 | Session Crash Recovery | `desktop/src/pages/RecoveryPage.tsx` | Phase 3b | 🔴 Not started |
| C5 | Candidate Feedback Form | `desktop/src/pages/SummaryPage.tsx` | Phase 3b | 🔴 Not started |

---

## Design System Reference

### Admin Portal Colors
| Token | Hex | Usage |
|---|---|---|
| Sidebar | `#1a237e` | Navigation background |
| Primary | `#1565c0` | Buttons, links, active states |
| Content BG | `#f0f2f5` | Page background |
| Surface | `#ffffff` | Cards, modals |
| Success | `#43a047` | Status indicators, answered questions |
| Warning | `#f59e0b` | Alerts, pending states |
| Danger | `#ef4444` | Errors, critical alerts |
| Purple | `#7b1fa2` | Encrypted badges, marked for review |
| Text Primary | `#1a1f2e` | Body text |
| Text Muted | `#94a3b8` | Labels, captions |

### Candidate Kiosk Colors (from Stitch Kiosk Design System)
| Token | Hex | Usage |
|---|---|---|
| Primary | `#1a237e` | Top bar, section tabs |
| Secondary | `#1565c0` | Save & Next button |
| Danger | `#c62828` | Submit button |
| Answered | `#43a047` | Question palette green |
| Not Answered | `#ef5350` | Question palette red |
| Marked Review | `#7b1fa2` | Question palette purple |
| Not Visited | `#ffffff` + grey border | Question palette default |
| BG | `#f0f2f5` | Content area |

### Fonts
| Context | Family | Weights |
|---|---|---|
| Admin Portal | Inter | 300, 400, 500, 600, 700, 800 |
| Candidate Kiosk | Arimo | 400, 700 |

---

## Stitch Project IDs (for MCP API access)

| Project | Stitch ID |
|---|---|
| FortisExam Admin Dashboard | `projects/3566420274227547466` |
| FortisExam Center Management Platform | `projects/7086732234025588543` |
| FortisExam Secure Portal | `projects/14992230594034836227` |
| FortisExam Security Operations Console | `projects/11845015599535963287` |
| FortisExam Candidate Kiosk | `projects/17817604031732273398` |
| FortisExam Kiosk Design System (1) | `projects/18220513383148636895` |
| FortisExam Kiosk Design System (2) | `projects/8444012187030138194` |
