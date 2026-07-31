/**
 * FortisExam Desktop — Edge API Client
 *
 * All HTTP calls go to the local edge server (localhost:8001).
 * No Clerk. No internet required. Auth uses edge-local RSA JWTs.
 */

// @ts-ignore
const EDGE_SERVER_URL = import.meta.env.VITE_EDGE_API_BASE_URL ?? 'http://localhost:8001/api/v1';

// ─── Types ────────────────────────────────────────────────────────────────

export interface AuthResponse {
  session_id: string;
  candidate_id: string;
  candidate_name: string;
  exam_id: string;
  token: string;                     // edge-local RS256 JWT
  face_score?: number;               // cosine similarity 0-1
  auth_method: 'qr_face' | 'qr_only' | 'supervisor_override';
  expires_at: string;                // ISO timestamp
}

export interface ExamSession {
  session_id: string;
  candidate_id: string;
  candidate_name: string;
  exam_id: string;
  exam_title: string;
  variant_id: string;
  status: 'active' | 'completed' | 'submitted';
  current_question_index: number;
  total_questions: number;
  duration_seconds: number;
  remaining_seconds: number;
  started_at: string;
  questions: Question[];
}

export interface Question {
  id: string;
  index: number;
  content: string;
  options: { A: string; B: string; C: string; D: string };
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  selected_option?: 'A' | 'B' | 'C' | 'D';   // pre-filled if recovered
  is_flagged?: boolean;
}

export interface AnswerResponse {
  saved: boolean;
  answer_id: string;
  snapshot_saved: boolean;
  answer_hash: string;
}

export interface SubmitResponse {
  submission_id: string;
  total_answers: number;
  submission_hash: string;
  submitted_at: string;
}

export interface RecoverySnapshot {
  session_id: string;
  candidate_id: string;
  current_question_index: number;
  remaining_seconds: number;
  answers_count: number;
  created_at: string;
}

export interface MonitoringEvent {
  event_type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  details: Record<string, unknown>;
}

// ─── HTTP Helper ──────────────────────────────────────────────────────────

async function edgeRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${EDGE_SERVER_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────

/** Full QR + optional face authentication → returns session JWT */
export async function authenticate(
  qrData: string,
  faceImageBase64?: string,
): Promise<AuthResponse> {
  return edgeRequest<AuthResponse>('/auth/authenticate', {
    method: 'POST',
    body: JSON.stringify({ qr_data: qrData, face_image_base64: faceImageBase64 ?? null }),
  });
}

/** Supervisor override when QR/face fails (always audit-logged) */
export async function supervisorOverride(
  candidateId: string,
  examId: string,
  invigilatorId: string,
  reason: string,
): Promise<AuthResponse> {
  return edgeRequest<AuthResponse>('/auth/supervisor-override', {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId, exam_id: examId, invigilator_id: invigilatorId, reason }),
  });
}

/** List all candidates from Edge DB — used by supervisor override picker */
export interface CandidateInfo {
  id: string;
  name: string;
  roll_number: string;
  exam_id: string;
}
export async function getCandidates(): Promise<CandidateInfo[]> {
  return edgeRequest<CandidateInfo[]>('/auth/candidates');
}

/** Generate a server-signed demo QR token for a candidate (testing only) */
export async function getDemoQR(candidateId: string): Promise<{ qr_data: string; candidate_name: string }> {
  return edgeRequest<{ qr_data: string; candidate_name: string }>(`/auth/demo-qr/${candidateId}`);
}

// ─── Exam ─────────────────────────────────────────────────────────────────

/** Load exam session — includes decrypted questions for this candidate's variant */
export async function getSession(sessionId: string, token: string): Promise<ExamSession> {
  return edgeRequest<ExamSession>(`/exam/session/${sessionId}`, {}, token);
}

/** Submit a single answer + auto-snapshot */
export async function submitAnswer(
  sessionId: string,
  questionId: string,
  selectedOption: 'A' | 'B' | 'C' | 'D',
  currentQuestionIndex: number,
  remainingSeconds: number,
  token: string,
): Promise<AnswerResponse> {
  return edgeRequest<AnswerResponse>('/exam/answer', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      question_id: questionId,
      selected_option: selectedOption,
      current_question_index: currentQuestionIndex,
      remaining_seconds: remainingSeconds,
    }),
  }, token);
}

/** Final exam submission — freezes session, generates submission hash */
export async function submitExam(sessionId: string, token: string): Promise<SubmitResponse> {
  return edgeRequest<SubmitResponse>('/exam/submit', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  }, token);
}

// ─── Recovery ─────────────────────────────────────────────────────────────

/** Check if there's a recoverable snapshot for this candidate */
export async function checkSnapshot(candidateId: string): Promise<RecoverySnapshot | null> {
  try {
    return await edgeRequest<RecoverySnapshot>(`/recovery/${candidateId}`);
  } catch {
    return null;
  }
}

/** Restore session from snapshot — returns session with answers pre-filled */
export async function restoreSession(sessionId: string): Promise<ExamSession> {
  return edgeRequest<ExamSession>(`/recovery/restore/${sessionId}`, {
    method: 'POST',
  });
}

// ─── Monitoring ───────────────────────────────────────────────────────────

/** Report a monitoring event to the edge server (focus loss, tab switch, etc.) */
export async function reportMonitoringEvent(
  event: MonitoringEvent,
  token: string,
  sessionId?: string,
  candidateId?: string,
): Promise<void> {
  try {
    // The backend /monitoring/event expects a DetectionFrameRequest
    // We map our simple event into that format
    await edgeRequest<unknown>('/monitoring/event', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId ?? 'unknown',
        candidate_id: candidateId ?? 'unknown',
        face_count: event.event_type === 'FOCUS_LOST' ? 0 : 1,
        gaze_yaw: 0.0,
        gaze_pitch: 0.0,
        camera_active: event.event_type !== 'CAMERA_OFF',
        answer_changes_last_30s: 0,
        timestamp: new Date().toISOString(),
      }),
    }, token);
  } catch {
    // Monitoring failures must never crash the exam
    console.warn('[Monitoring] Failed to report event:', event.event_type);
  }
}

// ─── Health ───────────────────────────────────────────────────────────────

export async function checkEdgeHealth(): Promise<boolean> {
  try {
    const healthUrl = EDGE_SERVER_URL.includes('/api/v1') 
      ? EDGE_SERVER_URL.replace('/api/v1', '/health')
      : 'http://localhost:8001/health';
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(15000) });
    return res.ok;
  } catch (err) {
    console.error("Health check failed:", err);
    return false;
  }
}
