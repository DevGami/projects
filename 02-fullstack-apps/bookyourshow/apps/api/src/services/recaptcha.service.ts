import { env } from '../config/env.js';
import { logger } from '../middleware/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// Google reCAPTCHA v3 — Server-Side Verification
// Free, invisible, score-based bot detection
// ═══════════════════════════════════════════════════════════════════════════

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

interface RecaptchaResponse {
  success: boolean;
  score: number;         // 0.0 (bot) → 1.0 (human)
  action: string;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Verify a reCAPTCHA v3 token against Google's API.
 *
 * @param token  - The reCAPTCHA token from the frontend
 * @param action - Expected action name (e.g. 'login', 'signup')
 * @param minScore - Minimum acceptable score (default 0.5)
 * @returns true if the request passes bot detection
 *
 * Behavior:
 * - If RECAPTCHA_SECRET_KEY is not configured, **always returns true** (dev-friendly)
 * - If the token is missing/empty and reCAPTCHA is configured, returns false
 */
export async function verifyRecaptcha(
  token: string | undefined,
  action: string,
  minScore = 0.5,
): Promise<{ success: boolean; reason?: string; errorCodes?: string[] }> {
  const secretKey = env.RECAPTCHA_SECRET_KEY;

  if (!secretKey || env.NODE_ENV === 'development') {
    return { success: true };
  }

  if (!token) {
    return { success: false, reason: 'missing_token' };
  }

  if (token.startsWith('FRONTEND_ERROR:')) {
    return { success: false, reason: token };
  }

  try {
    const res = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const data = (await res.json()) as RecaptchaResponse;

    if (!data.success) {
      return { success: false, reason: 'google_rejected', errorCodes: data['error-codes'] };
    }

    if (data.action && data.action !== action) {
      return { success: false, reason: 'action_mismatch' };
    }

    if (data.score < minScore) {
      return { success: false, reason: 'score_too_low', errorCodes: [data.score.toString()] };
    }

    return { success: true };
  } catch (err) {
    return { success: true }; // network error fallback
  }
}
