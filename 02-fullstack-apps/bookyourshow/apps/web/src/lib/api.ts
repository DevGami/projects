// ═══════════════════════════════════════════════════════════════════════════
// BookYourShow — API Client
// Centralized fetch wrapper with auth, error handling, and type safety
// ═══════════════════════════════════════════════════════════════════════════

import { API_BASE_URL } from './constants';

// ── Types ───────────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// ── Token Management ────────────────────────────────────────────────────────
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('bys_access_token');
}

// ── Core Fetch ──────────────────────────────────────────────────────────────
interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | undefined>;
  auth?: boolean; // default true
}

export async function fetchAPI<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const { body, params, auth = true, headers: customHeaders, ...rest } = options;

  // Build URL with query params
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        searchParams.set(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) url += `?${queryString}`;
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (auth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Make request
  const response = await fetch(url, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Parse response
  const data: ApiResponse<T> = await response.json();

  // Handle errors
  if (!response.ok || !data.success) {
    throw new ApiError(
      data.error?.message || `Request failed with status ${response.status}`,
      data.error?.code || 'UNKNOWN_ERROR',
      response.status,
      data.error?.details
    );
  }

  return data;
}

// ── Convenience Methods ─────────────────────────────────────────────────────
export const api = {
  get: <T = unknown>(endpoint: string, params?: Record<string, string | number | undefined>) =>
    fetchAPI<T>(endpoint, { method: 'GET', params }),

  post: <T = unknown>(endpoint: string, body?: unknown) =>
    fetchAPI<T>(endpoint, { method: 'POST', body }),

  put: <T = unknown>(endpoint: string, body?: unknown) =>
    fetchAPI<T>(endpoint, { method: 'PUT', body }),

  patch: <T = unknown>(endpoint: string, body?: unknown) =>
    fetchAPI<T>(endpoint, { method: 'PATCH', body }),

  delete: <T = unknown>(endpoint: string) =>
    fetchAPI<T>(endpoint, { method: 'DELETE' }),
};
