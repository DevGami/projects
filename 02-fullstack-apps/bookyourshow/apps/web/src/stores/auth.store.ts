// ═══════════════════════════════════════════════════════════════════════════
// BookYourShow — Auth Store (Zustand)
// Manages JWT tokens, user state, login/logout/refresh actions
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { api, ApiError } from '@/lib/api';

// ── Types ───────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  avatarUrl?: string | null;
  phone?: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;

  // Actions
  login: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signup: (name: string, email: string, password: string, captchaToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  hydrate: () => Promise<void>;
  setUser: (user: User | null) => void;
}

// ── Token Helpers ───────────────────────────────────────────────────────────
function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('bys_access_token', accessToken);
  localStorage.setItem('bys_refresh_token', refreshToken);
}

function clearTokens() {
  localStorage.removeItem('bys_access_token');
  localStorage.removeItem('bys_refresh_token');
}

function getRefreshToken(): string | null {
  return localStorage.getItem('bys_refresh_token');
}

// ── Refresh Token Deduplication ─────────────────────────────────────────────
// Prevents race condition when multiple rapid page loads (F5) all attempt
// refresh simultaneously. Without this, token rotation revokes the old token
// on the first call, and the second concurrent call triggers "token reuse"
// which revokes ALL tokens → full logout.
let inflightRefreshPromise: Promise<boolean> | null = null;

// ── Store ───────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isHydrated: false,

  login: async (email: string, password: string, captchaToken?: string) => {
    set({ isLoading: true });
    try {
      const res = await api.post<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>('/auth/login', { email, password, captchaToken });

      const { user, accessToken, refreshToken } = res.data!;
      saveTokens(accessToken, refreshToken);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signup: async (name: string, email: string, password: string, captchaToken?: string) => {
    set({ isLoading: true });
    try {
      const res = await api.post<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>('/auth/signup', { name, email, password });

      const { user, accessToken, refreshToken } = res.data!;
      saveTokens(accessToken, refreshToken);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }).catch(() => {});
      }
    } finally {
      clearTokens();
      set({ user: null, isAuthenticated: false });
    }
  },

  refreshToken: async () => {
    // Deduplication: if a refresh is already in-flight, piggyback on it
    if (inflightRefreshPromise) {
      return inflightRefreshPromise;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    inflightRefreshPromise = (async () => {
      try {
        const res = await api.post<{
          accessToken: string;
          refreshToken: string;
        }>('/auth/refresh', { refreshToken });

        const { accessToken, refreshToken: newRefreshToken } = res.data!;
        saveTokens(accessToken, newRefreshToken);
        return true;
      } catch (error) {
        // Only clear tokens if the refresh explicitly failed with an API error (e.g. 401 or 400).
        // For network errors/aborts, keep the tokens so a future request can try again.
        if (error instanceof ApiError) {
          clearTokens();
        }
        set({ user: null, isAuthenticated: false });
        return false;
      } finally {
        inflightRefreshPromise = null;
      }
    })();

    return inflightRefreshPromise;
  },

  hydrate: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('bys_access_token') : null;
    if (!token) {
      set({ isHydrated: true });
      return;
    }

    try {
      const res = await api.get<{ user: User }>('/auth/me');
      set({ user: res.data!.user, isAuthenticated: true, isHydrated: true });
    } catch (error) {
      // If the error is a 401, the access token is invalid or expired
      if (error instanceof ApiError && error.status === 401) {
        const refreshed = await get().refreshToken();
        if (refreshed) {
          try {
            const res = await api.get<{ user: User }>('/auth/me');
            set({ user: res.data!.user, isAuthenticated: true, isHydrated: true });
            return;
          } catch {
            // Second attempt failed, clear tokens
            clearTokens();
          }
        } else {
          // Refresh failed, clear tokens
          clearTokens();
        }
      }
      // On network errors or aborts (like during F5), we do NOT clear the tokens.
      // The user remains unauthenticated in memory for this session, but the
      // localStorage tokens are preserved for the next successful load.
      set({ user: null, isAuthenticated: false, isHydrated: true });
    }
  },

  setUser: (user: User | null) => {
    set({ user, isAuthenticated: !!user });
  },
}));
