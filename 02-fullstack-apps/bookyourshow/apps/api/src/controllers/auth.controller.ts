import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { logger } from '../middleware/logger.js';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  verifyRefreshToken,
  checkAccountLocked,
  recordFailedLogin,
  clearFailedLogins,
  createVerificationToken,
  validateVerificationToken,
} from '../services/auth.service.js';
import { redis } from '../config/redis.js';
import crypto from 'crypto';
import { createAndSendOTP, verifyOTP } from '../services/otp.service.js';
import { getGoogleAuthUrl, handleGoogleCallback } from '../services/google-auth.service.js';
import { verifyRecaptcha } from '../services/recaptcha.service.js';
import { env } from '../config/env.js';
import { emitUserSignup, emitPasswordResetRequested } from '../events/producers.js';
import type { SignupInput, LoginInput, UpdateProfileInput } from '../schemas/auth.schemas.js';

// Cookie options for refresh token
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth',
};

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/auth/signup
// ═══════════════════════════════════════════════════════════════════════════
export async function signup(req: Request, res: Response): Promise<void> {
  const { name, email, password, captchaToken } = req.body as SignupInput & { captchaToken?: string };

  // Bot detection
  const captchaOk = await verifyRecaptcha(captchaToken, 'signup', 0.5);
  if (!captchaOk) {
    res.status(403).json({
      success: false,
      error: { code: 'CAPTCHA_FAILED', message: 'Bot detection failed. Please try again.' },
    });
    return;
  }

  // Check if user exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({
      success: false,
      error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' },
    });
    return;
  }

  // Create user with Argon2id hash
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  // ── Generate tokens so user is immediately logged in after signup ──────
  const tokenPayload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  await storeRefreshToken(user.id, refreshToken);

  // Send OTP email for verification
  try {
    await createAndSendOTP(email, name);
    logger.info(`OTP sent to ${email}`);
  } catch (otpErr) {
    logger.warn(`OTP send failed for ${email}: ${otpErr}`);
  }

  logger.info(`New user registered: ${email}`);

  // Emit Kafka event (fire-and-forget)
  emitUserSignup({ id: user.id, name: user.name, email: user.email });

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: false,
      },
      accessToken,
      refreshToken,
      requiresVerification: true,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/auth/login
// ═══════════════════════════════════════════════════════════════════════════
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password, captchaToken } = req.body as LoginInput & { captchaToken?: string };

  // Bot detection (more lenient score for login)
  const captchaOk = await verifyRecaptcha(captchaToken, 'login', 0.3);
  if (!captchaOk) {
    res.status(403).json({
      success: false,
      error: { code: 'CAPTCHA_FAILED', message: 'Bot detection failed. Please try again.' },
    });
    return;
  }

  // Check account lockout
  await checkAccountLocked(email);

  // Find user
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await recordFailedLogin(email);
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
    return;
  }

  // Verify password (OAuth users have empty passwordHash)
  if (!user.passwordHash) {
    res.status(401).json({
      success: false,
      error: { code: 'USE_GOOGLE', message: 'This account uses Google Sign-In. Please sign in with Google.' },
    });
    return;
  }

  const validPassword = await verifyPassword(user.passwordHash, password);
  if (!validPassword) {
    await recordFailedLogin(email);
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
    return;
  }

  // Check email verification
  if (!user.emailVerified) {
    // Resend OTP
    try { await createAndSendOTP(email, user.name); } catch { /* ignore cooldown */ }
    res.status(403).json({
      success: false,
      error: {
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email first. A new OTP has been sent.',
        email: user.email,
      },
    });
    return;
  }

  // Clear failed login attempts
  await clearFailedLogins(email);

  // Update last login
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ip },
  });

  // Generate tokens
  const payload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  await storeRefreshToken(user.id, refreshToken);

  // Set refresh token cookie
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

  logger.info(`User logged in: ${email}`);

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      accessToken,
      refreshToken,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/auth/refresh
// ═══════════════════════════════════════════════════════════════════════════
export async function refresh(req: Request, res: Response): Promise<void> {
  // Accept refresh token from body (SPA localStorage) OR cookie
  const oldRefreshToken = req.body?.refreshToken || req.cookies?.refreshToken;

  if (!oldRefreshToken) {
    res.status(401).json({
      success: false,
      error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token not found' },
    });
    return;
  }

  // Verify the old refresh token JWT
  const payload = verifyRefreshToken(oldRefreshToken);

  // Fetch latest user data (role might have changed)
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User no longer exists' },
    });
    return;
  }

  // Rotate tokens
  const newPayload = { userId: user.id, email: user.email, role: user.role };
  const { accessToken, refreshToken: newRefreshToken } = await rotateRefreshToken(
    oldRefreshToken,
    user.id,
    newPayload
  );

  // Set new refresh token cookie + return in body for SPA
  res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);

  res.json({
    success: true,
    data: { accessToken, refreshToken: newRefreshToken },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/auth/logout
// ═══════════════════════════════════════════════════════════════════════════
export async function logout(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.refreshToken;

  if (refreshToken && req.user) {
    await revokeRefreshToken(refreshToken, req.user.userId);
  }

  res.clearCookie('refreshToken', { path: '/api/v1/auth' });

  res.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/auth/me
// ═══════════════════════════════════════════════════════════════════════════
export async function getProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const cacheKey = `bys:user:profile:${userId}`;

  // Serve from cache if available (5-minute TTL)
  const cached = await redis.get(cacheKey);
  if (cached) {
    res.json({ success: true, data: { user: JSON.parse(cached) } });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      phone: true,
      avatarUrl: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
    });
    return;
  }

  // Cache for 5 minutes
  await redis.set(cacheKey, JSON.stringify(user), 'EX', 300);

  res.json({ success: true, data: { user } });
}

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/v1/auth/me
// ═══════════════════════════════════════════════════════════════════════════
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const updates = req.body as UpdateProfileInput;
  const userId = req.user!.userId;

  const user = await prisma.user.update({
    where: { id: userId },
    data: updates,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      phone: true,
      avatarUrl: true,
    },
  });

  // Invalidate the user profile cache so next /me fetch gets fresh data
  await redis.del(`bys:user:profile:${userId}`);

  res.json({ success: true, data: { user } });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/auth/verify-email
// ═══════════════════════════════════════════════════════════════════════════
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token } = req.body as { token: string };

  const userId = await validateVerificationToken(token, 'EMAIL_VERIFY');

  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true },
  });

  logger.info(`Email verified for user ${userId}`);

  res.json({
    success: true,
    data: { message: 'Email verified successfully' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/auth/forgot-password
// ═══════════════════════════════════════════════════════════════════════════
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email, captchaToken } = req.body as { email: string; captchaToken?: string };

  // Bot detection
  const captchaOk = await verifyRecaptcha(captchaToken, 'forgot_password', 0.5);
  if (!captchaOk) {
    res.status(403).json({
      success: false,
      error: { code: 'CAPTCHA_FAILED', message: 'Bot detection failed. Please try again.' },
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success (don't reveal if email exists)
  if (user) {
    const resetToken = await createVerificationToken(user.id, 'PASSWORD_RESET');
    // In production, this token would be sent via email (M07)
    // For dev, we return it in the response
    logger.info(`Password reset requested for ${email}, token: ${resetToken}`);

    // Emit Kafka event so notification service can send the email
    emitPasswordResetRequested({ userId: user.id, email, resetToken });
  }

  res.json({
    success: true,
    data: { message: 'If the email exists, a password reset link has been sent.' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/auth/reset-password
// ═══════════════════════════════════════════════════════════════════════════
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as { token: string; password: string };

  const userId = await validateVerificationToken(token, 'PASSWORD_RESET');

  const passwordHash = await hashPassword(password);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
    },
  });

  // Revoke all refresh tokens for this user (force re-login)
  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });

  logger.info(`Password reset completed for user ${userId}`);

  res.json({
    success: true,
    data: { message: 'Password reset successfully. Please log in with your new password.' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/auth/verify-otp
// ═══════════════════════════════════════════════════════════════════════════
export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const { email, otp } = req.body as { email: string; otp: string };

  let valid: boolean;
  try {
    valid = await verifyOTP(email, otp);
  } catch (err: any) {
    // OTP lockout after too many failed attempts
    res.status(429).json({
      success: false,
      error: { code: 'OTP_LOCKED', message: err.message || 'Too many failed attempts. Please try again later.' },
    });
    return;
  }

  if (!valid) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_OTP', message: 'Invalid or expired OTP. Please try again.' },
    });
    return;
  }


  // Mark email as verified
  const user = await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
  });

  // Generate tokens so user is auto-logged-in after verification
  const payload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  await storeRefreshToken(user.id, refreshToken);

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

  logger.info(`Email verified via OTP for ${email}`);

  res.json({
    success: true,
    data: {
      message: 'Email verified successfully!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: true,
      },
      accessToken,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/auth/resend-otp
// ═══════════════════════════════════════════════════════════════════════════
export async function resendOtp(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Don't reveal if email exists
    res.json({ success: true, data: { message: 'If the email exists, a new OTP has been sent.' } });
    return;
  }

  if (user.emailVerified) {
    res.json({ success: true, data: { message: 'Email is already verified.' } });
    return;
  }

  try {
    await createAndSendOTP(email, user.name);
    res.json({ success: true, data: { message: 'OTP sent! Check your email.' } });
  } catch (err) {
    res.status(429).json({
      success: false,
      error: { code: 'OTP_COOLDOWN', message: 'Please wait before requesting another OTP.' },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/auth/google — Redirect to Google consent screen
// ═══════════════════════════════════════════════════════════════════════════
export async function googleRedirect(_req: Request, res: Response): Promise<void> {
  const url = getGoogleAuthUrl();
  res.redirect(url);
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/auth/google/callback — Handle Google OAuth callback
// ═══════════════════════════════════════════════════════════════════════════
export async function googleCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string;

  if (!code) {
    res.redirect(`${env.FRONTEND_URL}/auth/login?error=no_code`);
    return;
  }

  try {
    const result = await handleGoogleCallback(code);

    // ✅ SECURE: Store tokens in Redis with a short-lived one-time code.
    // The frontend receives ONLY the code (not the tokens) in the URL.
    // It then POSTs the code to /api/v1/auth/google/exchange to get tokens.
    const authCode = crypto.randomBytes(32).toString('hex');
    const authCodeKey = `bys:oauth:code:${authCode}`;

    // Store full auth result in Redis — TTL 60 seconds (single use)
    await redis.set(
      authCodeKey,
      JSON.stringify({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      }),
      'EX',
      60
    );

    // Only pass the short-lived code in the URL
    res.redirect(`${env.FRONTEND_URL}/auth/google/callback?code=${authCode}`);
  } catch (err) {
    logger.error(`Google OAuth failed: ${err}`);
    res.redirect(`${env.FRONTEND_URL}/auth/login?error=google_failed`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/auth/google/exchange — Exchange one-time code for tokens
// Called by the frontend after Google OAuth redirect
// ═══════════════════════════════════════════════════════════════════════════
export async function googleExchangeCode(req: Request, res: Response): Promise<void> {
  const { code } = req.body as { code?: string };

  if (!code || typeof code !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_CODE', message: 'Authorization code is required' },
    });
    return;
  }

  const authCodeKey = `bys:oauth:code:${code}`;

  // Retrieve and immediately delete (single-use)
  const stored = await redis.get(authCodeKey);
  if (!stored) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_CODE', message: 'Invalid or expired authorization code' },
    });
    return;
  }

  // Delete immediately — one-time use
  await redis.del(authCodeKey);

  const { accessToken, refreshToken, user } = JSON.parse(stored);

  // Set refresh token in HttpOnly cookie (browsers that support it)
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

  // Also return refreshToken in body so the SPA can store it in
  // localStorage for the standard silent-refresh flow on page load.
  res.json({
    success: true,
    data: { accessToken, refreshToken, user },
  });
}
