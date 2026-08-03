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
): Promise<boolean> {
  const secretKey = env.RECAPTCHA_SECRET_KEY;

  // If reCAPTCHA is not configured, skip verification (dev mode)
  if (!secretKey) {
    logger.debug('reCAPTCHA not configured — skipping verification');
    return true;
  }

  // If reCAPTCHA IS configured but no token was sent, reject
  if (!token) {
    logger.warn(`reCAPTCHA: missing token for action "${action}"`);
    return false;
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
      logger.warn(`reCAPTCHA verification failed for action "${action}": ${data['error-codes']?.join(', ')}`);
      return false;
    }

    // Check action matches (prevents token replay across endpoints)
    if (data.action && data.action !== action) {
      logger.warn(`reCAPTCHA action mismatch: expected "${action}", got "${data.action}"`);
      return false;
    }

    // Check score
    if (data.score < minScore) {
      logger.warn(`reCAPTCHA low score for action "${action}": ${data.score} (min ${minScore})`);
      return false;
    }

    logger.debug(`reCAPTCHA passed for action "${action}" — score ${data.score}`);
    return true;
  } catch (err) {
    logger.error(`reCAPTCHA verification error: ${err}`);
    // Fail open in case of network issues (don't block legitimate users)
    return true;
  }
}
