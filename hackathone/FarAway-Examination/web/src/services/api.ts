/**
 * API Client — Authenticated HTTP calls to cloud and edge servers.
 *
 * All endpoints verified against actual backend route files (2026-06-11):
 *   cloud: questions.py, exams.py, packages.py, distribution.py, users.py
 *   common: audit.py
 *   edge:   monitoring.py (edge-only, RSA JWT — accessed via Monitoring page)
 *
 * Base URL: VITE_API_BASE_URL env var, defaults to /api/v1 (proxied by Vite)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

type Params = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, params?: Params): string {
  // path may already start with /api/v1 if called with full path,
  // or a relative path like /questions that we prefix.
  const base = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const url = new URL(base, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

async function request(
  path: string,
  init: RequestInit & { params?: Params } = {},
  token?: string | null,
): Promise<Response> {
  const { params, ...fetchInit } = init;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((fetchInit.headers as Record<string, string>) ?? {}),
  };
  return fetch(buildUrl(path, params), { ...fetchInit, headers });
}

/** Typed helper — throws on non-2xx with backend detail message. */
async function json<T>(
  path: string,
  init: RequestInit & { params?: Params } = {},
  token?: string | null,
): Promise<T> {
  const res = await request(path, init, token);
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const body = await res.json();
      msg = body?.detail ?? body?.message ?? msg;
    } catch (_) { /* ignore parse errors */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────
// QUESTIONS   GET/POST /questions   PUT/DELETE /questions/:id
// Backend: cloud/questions.py
// list_questions() returns { items, total } (page/page_size query params)
// create_question() → { id, status }
// update_question() → question object
// delete_question() → { id, status }
// ─────────────────────────────────────────────────────────────

export const questionsApi = {
  /** GET /questions?page=&page_size=&subject=&difficulty= */
  list: (token: string, params?: { page?: number; page_size?: number; subject?: string; difficulty?: string }) =>
    json<QuestionListResponse>('/questions', { params }, token),

  /** GET /questions/:id — returns decrypted content */
  get: (token: string, id: string) =>
    json<QuestionDetail>(`/questions/${id}`, {}, token),

  /** POST /questions — returns { id, status } */
  create: (token: string, body: QuestionCreateRequest) =>
    json<{ id: string; status: string }>('/questions', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),

  /** PUT /questions/:id — re-encrypts on save */
  update: (token: string, id: string, body: QuestionCreateRequest) =>
    json<QuestionDetail>(`/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }, token),

  /** DELETE /questions/:id — soft delete, returns { id, status } */
  delete: (token: string, id: string) =>
    request(`/questions/${id}`, { method: 'DELETE' }, token),
};

// ─────────────────────────────────────────────────────────────
// EXAMS   GET/POST /exams   POST /exams/:id/compile  POST /exams/:id/release-key
// Backend: cloud/exams.py
// NOTE: create/list/get/compile are TODO stubs returning None — they will
//       return 200 with empty body until fully implemented.
// release-key is FULLY implemented — requires center_public_key_pem in body.
// ─────────────────────────────────────────────────────────────

export const examsApi = {
  /** GET /exams — list all exams (stub, returns None currently) */
  list: (token: string) =>
    json<ExamListResponse>('/exams', {}, token),

  /** GET /exams/:id — get exam details (stub) */
  get: (token: string, id: string) =>
    json<Exam>(`/exams/${id}`, {}, token),

  /** POST /exams — create exam (stub) */
  create: (token: string, body: ExamCreateRequest) =>
    json<{ id: string; status: string }>('/exams', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),

  /** POST /exams/:id/compile — compile exam into package (stub) */
  compile: (token: string, id: string) =>
    json<{ id: string; status: string }>(`/exams/${id}/compile`, { method: 'POST' }, token),

  /**
   * POST /exams/:id/release-key — FULLY IMPLEMENTED (D-012)
   * Wraps the exam AES key with the center's RSA public key.
   * Body: { center_public_key_pem: string }
   * Returns: { exam_id, package_id, wrapped_key_b64, released_at }
   */
  releaseKey: (token: string, id: string, centerPublicKeyPem: string) =>
    json<KeyReleaseResponse>(`/exams/${id}/release-key`, {
      method: 'POST',
      body: JSON.stringify({ center_public_key_pem: centerPublicKeyPem }),
    }, token),
};

// ─────────────────────────────────────────────────────────────
// PACKAGES
// Backend: cloud/packages.py
// POST /packages/generate  — generate encrypted+signed package
// GET  /packages/:id       — get package metadata
// GET  /packages/:id/download — download encrypted payload
// POST /packages/:id/verify   — verify RSA signature
// NOTE: No GET /packages list endpoint exists — use distribution for listing.
// ─────────────────────────────────────────────────────────────

export const packagesApi = {
  /** POST /packages/generate — requires { exam_id } in body */
  generate: (token: string, examId: string) =>
    json<PackageResponse>('/packages/generate', {
      method: 'POST',
      body: JSON.stringify({ exam_id: examId }),
    }, token),

  /** GET /packages/:id — package metadata */
  get: (token: string, id: string) =>
    json<PackageResponse>(`/packages/${id}`, {}, token),

  /** GET /packages/:id/download — encrypted payload (raw Response for blob handling) */
  download: (token: string, id: string) =>
    request(`/packages/${id}/download`, {}, token),

  /** POST /packages/:id/verify — verify RSA-2048 PSS signature */
  verify: (token: string, id: string) =>
    json<PackageVerifyResponse>(`/packages/${id}/verify`, { method: 'POST' }, token),
};

// ─────────────────────────────────────────────────────────────
// DISTRIBUTION
// Backend: cloud/distribution.py
// GET /distribution/packages          — list all packages with status
// GET /distribution/status/:package_id — single package delivery status
// NOTE: Response shape is PackageListResponse / PackageStatusResponse (not DistributionStatus)
// ─────────────────────────────────────────────────────────────

export const distributionApi = {
  /** GET /distribution/packages → { packages: PackageStatus[], total: number } */
  listPackages: (token: string) =>
    json<PackageListResponse>('/distribution/packages', {}, token),

  /** GET /distribution/status/:package_id → PackageStatus */
  getStatus: (token: string, packageId: string) =>
    json<PackageStatus>(`/distribution/status/${packageId}`, {}, token),
};

// ─────────────────────────────────────────────────────────────
// USERS
// Backend: cloud/users.py
// GET  /users/me   — current user profile (Clerk JWT required)
// POST /users/sync — upsert user+role into local DB (admin only)
// NOTE: No GET /users list endpoint — list comes from Clerk dashboard.
// ─────────────────────────────────────────────────────────────

export const usersApi = {
  /** GET /users/me — current user's profile + local DB role */
  me: (token: string) =>
    json<UserMeResponse>('/users/me', {}, token),

  /**
   * POST /users/sync — sync Clerk user into local DB with a role.
   * Body: { clerk_user_id, name, role }
   */
  sync: (token: string, body: UserSyncRequest) =>
    json<UserSyncResponse>('/users/sync', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),
};

// ─────────────────────────────────────────────────────────────
// AUDIT  (common/audit.py — available in BOTH cloud and edge mode)
// GET  /audit/chain            — full paginated chain
// GET  /audit/chain/:exam_id   — exam-scoped chain
// POST /audit/verify           — verify full chain (?exam_id=)
// POST /audit/verify/:exam_id  — verify exam chain
// GET  /audit/events           — filtered event list
// GET  /audit/export/:exam_id  — JSON or CSV export (?fmt=json|csv)
// GET  /audit/stats            — summary stats
// POST /audit/log              — append event (internal use)
// ─────────────────────────────────────────────────────────────

export const auditApi = {
  /** GET /audit/chain?exam_id=&page=&page_size= */
  getChain: (token: string, params?: { exam_id?: string; page?: number; page_size?: number }) =>
    json<AuditChainResponse>('/audit/chain', { params }, token),

  /** GET /audit/chain/:exam_id */
  getExamChain: (token: string, examId: string, params?: { page?: number; page_size?: number }) =>
    json<AuditChainResponse>(`/audit/chain/${examId}`, { params }, token),

  /** POST /audit/verify?exam_id= */
  verify: (token: string, examId?: string) =>
    json<ChainVerificationResult>('/audit/verify', {
      method: 'POST',
      params: examId ? { exam_id: examId } : undefined,
    }, token),

  /** GET /audit/events?event_type=&exam_id=&actor_id=&page=&page_size= */
  listEvents: (token: string, params?: { event_type?: string; exam_id?: string; actor_id?: string; page?: number; page_size?: number }) =>
    json<AuditListResponse>('/audit/events', { params }, token),

  /** GET /audit/export/:exam_id?fmt=json|csv — returns raw Response for file download */
  export: (token: string, examId: string, fmt: 'json' | 'csv' = 'json') =>
    request(`/audit/export/${examId}`, { params: { fmt } }, token),

  /** GET /audit/stats?exam_id= */
  stats: (token: string, examId?: string) =>
    json<AuditStats>('/audit/stats', { params: examId ? { exam_id: examId } : undefined }, token),

  /** POST /audit/log — internal event ingestion */
  log: (token: string, body: LogEventRequest) =>
    json<LogEventResponse>('/audit/log', { method: 'POST', body: JSON.stringify(body) }, token),

  /** POST /audit/tamper?exam_id= — simulate database tampering */
  tamper: (token: string, examId?: string) =>
    json<{status: string, sequence: number}>('/audit/tamper', { 
      method: 'POST',
      params: examId ? { exam_id: examId } : undefined,
    }, token),
};

// ─────────────────────────────────────────────────────────────
// MONITORING  (edge/monitoring.py — edge server only, RSA JWT auth)
// NOTE: The cloud admin portal reads monitoring events via the audit chain.
//       Direct monitoring API calls go to the edge server (different base URL).
//       Use VITE_EDGE_API_BASE_URL env var to point to the edge server.
//
// POST  /monitoring/event                            — report security frame (from kiosk)
// GET   /monitoring/events                           — list events (proctor dashboard)
// GET   /monitoring/events/detail/{id}               — single event detail (A7f drawer)    ← NEW
// GET   /monitoring/events/:session_id/summary       — session anomaly summary
// PATCH /monitoring/events/:id/acknowledge           — proctor acknowledge (GAP-5)          ← NEW
// GET   /exam/sessions                               — list all sessions (GAP-4)            ← NEW
// ─────────────────────────────────────────────────────────────

const EDGE_BASE = import.meta.env.VITE_EDGE_API_BASE_URL ?? '/edge/api/v1';

function edgeFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  return fetch(`${EDGE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  }).then(async r => {
    if (!r.ok) throw new Error(`Edge API error ${r.status}: ${await r.text()}`);
    return r.json() as Promise<T>;
  });
}

/** Build a query string path for edge API calls (e.g. /monitoring/events?page=1&severity=HIGH) */
function edgeQs(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return path;
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
  const str = qs.toString();
  return str ? `${path}?${str}` : path;
}

export const monitoringApi = {
  /** GET /monitoring/events?session_id=&severity=&event_type=&acknowledged=&page=&page_size= */
  listEvents: (edgeToken: string, params?: {
    session_id?: string;
    severity?: string;
    event_type?: string;
    acknowledged?: boolean;
    page?: number;
    page_size?: number;
  }) =>
    edgeFetch<EventListResponse>(edgeToken, edgeQs('/monitoring/events', params)),

  /** GET /monitoring/events/detail/{id} — full event detail for A7f Anomaly Detail Drawer */
  getEvent: (edgeToken: string, eventId: string) =>
    edgeFetch<SecurityEventDetail>(edgeToken, `/monitoring/events/detail/${eventId}`),

  /** GET /monitoring/events/:session_id/summary */
  getSessionSummary: (edgeToken: string, sessionId: string) =>
    edgeFetch<SessionSummaryResponse>(edgeToken, `/monitoring/events/${sessionId}/summary`),

  /**
   * PATCH /monitoring/events/:id/acknowledge — GAP-5 (now implemented!)
   * Marks a proctor alert as acknowledged. Returns { id, acknowledged, message }.
   */
  acknowledge: (edgeToken: string, eventId: string) =>
    edgeFetch<AcknowledgeResponse>(edgeToken, `/monitoring/events/${eventId}/acknowledge`, {
      method: 'PATCH',
    }),

  /**
   * GET /exam/sessions — GAP-4 (now implemented!)
   * List all exam sessions on the edge node for the Proctor Dashboard (D1).
   */
  listSessions: (edgeToken: string, params?: {
    status?: 'active' | 'submitted' | 'recovered';
    exam_id?: string;
    page?: number;
    page_size?: number;
  }) =>
    edgeFetch<SessionListResponse>(edgeToken, edgeQs('/exam/sessions', params)),
};


// ─────────────────────────────────────────────────────────────
// DASHBOARD  (NOT YET IMPLEMENTED — GAP-6)
// The backend does NOT have a /dashboard/stats endpoint yet.
// The Dashboard page falls back to demo data when this throws.
// TODO: Add server/app/api/cloud/dashboard.py in Phase 2a backend gap work.
// ─────────────────────────────────────────────────────────────

export const dashboardApi = {
  /**
   * GET /dashboard/stats
   * ⚠️ BACKEND GAP-6: This endpoint does not exist yet.
   * Dashboard.tsx catches the error and uses DEMO_STATS fallback.
   */
  getStats: (token: string) =>
    json<DashboardStats>('/dashboard/stats', {}, token),
};

// ─────────────────────────────────────────────────────────────
// CENTERS  (NOT YET IMPLEMENTED — GAP-1, GAP-2, GAP-3)
// The backend has NO center endpoints yet.
// Centers.tsx will use placeholder data until these are added.
// TODO: Add server/app/api/cloud/centers.py in Phase 2b backend gap work.
// ─────────────────────────────────────────────────────────────

export const centersApi = {
  /**
   * GET /centers
   * ⚠️ BACKEND GAP-1: Endpoint does not exist yet.
   */
  list: (token: string) =>
    json<CenterListResponse>('/centers', {}, token),

  /**
   * POST /centers
   * ⚠️ BACKEND GAP-2: Endpoint does not exist yet.
   */
  create: (token: string, body: CenterCreateRequest) =>
    json<Center>('/centers', { method: 'POST', body: JSON.stringify(body) }, token),

  /**
   * PUT /centers/:id
   * ⚠️ BACKEND GAP-3: Endpoint does not exist yet.
   */
  update: (token: string, id: string, body: Partial<CenterCreateRequest>) =>
    json<Center>(`/centers/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token),

  /**
   * DELETE /centers/:id
   */
  delete: (token: string, id: string) =>
    json<void>(`/centers/${id}`, { method: 'DELETE' }, token),
};

// =============================================================
// TypeScript Types — matching actual backend Pydantic schemas
// =============================================================

// ── Questions ──────────────────────────────────────────────

export interface QuestionListResponse {
  items: QuestionMeta[];
  total: number;
  page: number;
  page_size: number;
}

/** Metadata returned by list_questions — no encrypted content */
export interface QuestionMeta {
  id: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  is_encrypted: boolean;
  created_at: string;
  updated_at: string;
}

/** Full question with decrypted content — returned by get_question */
export interface QuestionDetail extends QuestionMeta {
  content: string;
  options: { A: string; B: string; C: string; D: string };
  correct_option: 'A' | 'B' | 'C' | 'D';
  author_id: string;
}

export interface QuestionCreateRequest {
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  content: string;
  options: { A: string; B: string; C: string; D: string };
  correct_option: 'A' | 'B' | 'C' | 'D';
}

// ── Exams ──────────────────────────────────────────────────

export interface Exam {
  id: string;
  name: string;
  status: 'DRAFT' | 'COMPILED' | 'DISTRIBUTED' | 'KEY_RELEASED' | 'ACTIVE' | 'COMPLETED';
  question_count: number;
  exam_date: string;
  created_at: string;
}

export interface ExamListResponse {
  items: Exam[];
  total: number;
}

export interface ExamCreateRequest {
  name: string;
  exam_date: string;
  duration_minutes: number;
  blueprint: BlueprintItem[];
}

export interface BlueprintItem {
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
}

export interface KeyReleaseResponse {
  exam_id: string;
  package_id: string;
  wrapped_key_b64: string;
  released_at: string;
}

// ── Packages ───────────────────────────────────────────────

/** Matches cloud/packages.py PackageResponse schema */
export interface PackageResponse {
  id: string;
  exam_id: string;
  package_hash: string;
  status: 'generated' | 'distributed' | 'activated';
  created_at: string;
  // signature_b64 only on generate response
  signature_b64?: string;
}

export interface PackageVerifyResponse {
  package_id: string;
  valid: boolean;
  package_hash: string;
  checked_at: string;
}

// ── Distribution ───────────────────────────────────────────

/** Matches cloud/distribution.py PackageListResponse */
export interface PackageListResponse {
  packages: PackageStatus[];
  total: number;
}

export interface PackageStatus {
  package_id: string;
  exam_id: string;
  status: 'generated' | 'distributed' | 'activated';
  created_at: string;
}

// ── Users ──────────────────────────────────────────────────

export type UserRole = 'admin' | 'expert' | 'center_admin' | 'invigilator' | 'auditor';

/** Matches cloud/users.py UserMeResponse */
export interface UserMeResponse {
  clerk_user_id: string;
  name: string;
  role: UserRole;
  email: string;
}

/** Matches cloud/users.py UserSyncRequest */
export interface UserSyncRequest {
  clerk_user_id: string;
  name: string;
  role: UserRole;
}

/** Matches cloud/users.py UserSyncResponse */
export interface UserSyncResponse extends UserMeResponse {
  created: boolean;
}

// ── Audit ──────────────────────────────────────────────────

/** Matches common/audit.py AuditChainResponse */
export interface AuditChainResponse {
  events: AuditEvent[];
  total: number;
  page: number;
  page_size: number;
  chain_valid?: boolean;
}

export interface AuditEvent {
  id: string;                   // UUID string from backend
  sequence: number;
  event_type: string;
  actor_id: string;
  actor_role?: string;
  target_id?: string;
  exam_id?: string;
  payload: string;              // JSON string from backend (serialized)
  payload_hash: string;
  previous_hash: string;
  event_hash: string;
  created_at: string;
  synced?: boolean;
}

/** Matches common/audit.py AuditListResponse */
export interface AuditListResponse {
  events: AuditEvent[];
  total: number;
  page: number;
  page_size: number;
  filter_event_type?: string;
  filter_exam_id?: string;
}

/** Matches common/audit.py ChainVerificationResult exactly */
export interface ChainVerificationResult {
  is_valid: boolean;            // backend field is is_valid (not valid)
  total_events: number;
  verified_events: number;
  first_broken_at_sequence?: number | null;
  broken_event_id?: string | null;
  failure_reason?: string | null;
  message: string;
}

export interface AuditStats {
  total_events: number;
  latest_sequence: number;
  latest_event_hash: string | null;
  exam_id: string | null;
}

export interface LogEventRequest {
  event_type: string;
  actor_id: string;
  payload: Record<string, unknown>;
  exam_id?: string;
  actor_role?: string;
  target_id?: string;
}

export interface LogEventResponse {
  sequence: number;
  event_hash: string;
  event_type: string;
  created_at: string;
}

// ── Monitoring (edge) ──────────────────────────────────────

/** Matches edge/monitoring.py EventListResponse */
export interface EventListResponse {
  events: SecurityEvent[];
  total: number;
  page: number;
  page_size: number;
}

export interface SecurityEvent {
  id: string;
  session_id: string;
  candidate_id: string;
  event_type: string;           // backend field name: event_type (not alert_type)
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: string;              // JSON string from backend
  evidence_hash: string;
  acknowledged: boolean;
  created_at: string;
}

/** Full event detail — same shape as SecurityEvent (alias for A7f drawer) */
export type SecurityEventDetail = SecurityEvent;

/** Matches edge/monitoring.py SessionSummaryResponse */
export interface SessionSummaryResponse {
  session_id: string;
  total_events: number;
  high_count: number;           // backend uses high_count (not by_severity)
  medium_count: number;
  low_count: number;
  event_types: Record<string, number>;  // { MULTIPLE_FACES: 3, ... }
}

/** Matches edge/monitoring.py AcknowledgeResponse (GAP-5) */
export interface AcknowledgeResponse {
  id: string;
  acknowledged: boolean;
  message: string;
}

/** Matches server/app/schemas/session.py SessionResponse (GAP-4) */
export interface SessionResponse {
  id: string;
  candidate_id: string;
  exam_id: string;
  variant_id: number;
  status: 'active' | 'submitted' | 'recovered';
  current_question_index: number;
  started_at: string;
  submitted_at: string | null;
}

/** Matches server/app/schemas/session.py SessionListResponse (GAP-4) */
export interface SessionListResponse {
  sessions: SessionResponse[];
  total: number;
  page: number;
  page_size: number;
  filter_status: string | null;
  filter_exam_id: string | null;
}

// ── Dashboard (GAP-6, not yet in backend) ──────────────────

export interface DashboardStats {
  total_questions: number;
  total_exams: number;
  total_centers: number;
  total_audit_events: number;
  active_sessions: number;
  critical_alerts: number;
  recent_activity: ActivityItem[];
  package_distribution_status: PackageDistStatus[];
}

export interface ActivityItem {
  id: string;
  type: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO' | 'CRYPTO';
  message: string;
  actor: string;
  timestamp: string;
}

export interface PackageDistStatus {
  exam_name: string;
  distributed: number;
  total: number;
}

// ── Centers (GAP-1/2/3, not yet in backend) ────────────────

export interface Center {
  id: string;
  name: string;
  city: string;
  state: string;
  seat_count: number;
  assigned_exam?: string;
  risk_score?: number;
  status: 'active' | 'inactive';
}

export interface CenterListResponse {
  items: Center[];
  total: number;
}

export interface CenterCreateRequest {
  name: string;
  city: string;
  state: string;
  address: string;
  seat_count: number;
}
