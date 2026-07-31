# FortisExam — Backend Gaps for Frontend Integration

> **Created:** 2026-06-12
> **Author:** AI Agent (Post Phase 1 audit)
> **Priority:** Must be resolved before Phase 2a/2b frontend can be functional

---

## What This Doc Is

After Phase 1 frontend was built, every backend route was cross-checked against the actual files. This doc tracks what's **missing or stubbed** that the frontend is already calling.

---

## GAP-1 — Exam Routes Not Implemented

**Affects:** `/exams` page (Phase 2b)

The `cloud/exams.py` route file has handlers written but all are `...` (Python Ellipsis stubs):

| Endpoint | Handler Status | Service Status |
|---|---|---|
| `POST /exams/` | `...` stub | `ExamService.create()` → `# TODO` |
| `GET /exams/` | `...` stub | `ExamService.list_all()` → `# TODO` |
| `GET /exams/{exam_id}` | `...` stub | `ExamService.get()` → `# TODO` |
| `POST /exams/{exam_id}/compile` | `...` stub | `ExamService.compile()` → `# TODO` |
| `POST /exams/{exam_id}/release-key` | ✅ **Fully implemented** | `DistributionService.release_key()` ✅ |

**Files to complete:**
- `server/app/services/exam_service.py` — implement `create()`, `list_all()`, `get()`, `compile()`
- `server/app/api/cloud/exams.py` — wire service into `create_exam()`, `list_exams()`, `get_exam()`, `compile_exam()`

**DB model exists:** `server/app/models/exam.py` ✅  
**Schema exists:** `server/app/schemas/exam.py` ✅

---

## GAP-2 — Centers Endpoints Missing Entirely

**Affects:** `/centers` page (Phase 2b)

There is **no** centers router at all. The DB model and no schema exist yet.

| What's Needed | Status |
|---|---|
| `GET /centers/` | ❌ Not created |
| `POST /centers/` | ❌ Not created |
| `PUT /centers/{id}` | ❌ Not created |
| `GET /centers/{id}` | ❌ Not created |
| `server/app/schemas/center.py` | ❌ Not created |
| `server/app/services/center_service.py` | ❌ Not created |
| `server/app/api/cloud/centers.py` | ❌ Not created |

**DB model exists:** `server/app/models/center.py` ✅ (has: `id`, `name`, `code`, `seating_layout`, `seat_count`, `rsa_public_key`, `created_at`)

**What needs to be done:**
1. Create `server/app/schemas/center.py` — `CenterCreate`, `CenterResponse`, `CenterListResponse`
2. Create `server/app/services/center_service.py` — CRUD operations
3. Create `server/app/api/cloud/centers.py` — mount routes
4. Register router in `server/app/main.py` under `_mount_cloud_routes()`

---

## GAP-3 — Dashboard Stats Endpoint Missing

**Affects:** `/` Dashboard page (Phase 1 — currently showing demo data)

There is no `GET /dashboard/stats` endpoint anywhere.

**What the frontend expects (from `api.ts` `DashboardStats` type):**
```json
{
  "total_questions": 3847,
  "total_exams": 14,
  "total_centers": 312,
  "total_audit_events": 10000,
  "active_sessions": 2270000,
  "critical_alerts": 3,
  "recent_activity": [ ... ],
  "package_distribution_status": [ ... ]
}
```

**What needs to be done:**
1. Create `server/app/api/cloud/dashboard.py`
2. Aggregate counts from `questions`, `exams`, `centers`, `audit_events`, `security_events` tables
3. Return last 10 audit events as `recent_activity`
4. Return package distribution from `packages` table grouped by exam
5. Register router in `server/app/main.py` under `_mount_cloud_routes()`

---

## What Is Already Working ✅

These are fully wired end-to-end (model → schema → service → route → api.ts):

| Frontend Page | Backend Endpoints | Status |
|---|---|---|
| `/questions` | `GET/POST /questions`, `GET/PUT/DELETE /questions/:id` | ✅ Full CRUD |
| `/distribution` | `GET /distribution/packages`, `GET /distribution/status/:id` | ✅ Working |
| `/packages` | `POST /packages/generate`, `GET /packages/:id`, `/download`, `/verify` | ✅ Working |
| `/users` | `GET /users/me`, `POST /users/sync` | ✅ Working |
| `/audit` | All 8 audit routes | ✅ Working |
| `/monitoring` | `GET /monitoring/events`, `GET /monitoring/events/:id/summary` | ✅ Working (edge) |
| `/exams` → release-key | `POST /exams/:id/release-key` | ✅ Working |

---

## Who Needs to Do What

| Gap | Who | Priority |
|---|---|---|
| GAP-1: Exam service stubs | Backend dev (your friend) | High — needed for Phase 2b |
| GAP-2: Centers CRUD | Backend dev (your friend) | High — needed for Phase 2b |
| GAP-3: Dashboard stats endpoint | Backend dev (your friend) | Medium — dashboard works with demo data |

---

## Note on Frontend

The frontend `api.ts` is **already written** with the correct endpoint paths, request/response types for all 3 gaps. Once the backend fills these in, the frontend will work with zero changes needed.
