import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  signupSchema,
  loginSchema,
  updateProfileSchema,
  verifyEmailSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth.schemas.js';
import {
  signup,
  login,
  refresh,
  logout,
  getProfile,
  updateProfile,
  verifyEmail,
  forgotPassword,
  resetPassword,
  verifyOtp,
  resendOtp,
  googleRedirect,
  googleCallback,
  googleExchangeCode,
} from '../controllers/auth.controller.js';

const router = Router();

// ── Auth Rate Limiter (stricter) ────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,                 // 5 auth requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'AUTH_RATE_LIMIT', message: 'Too many auth attempts. Try again later.' },
  },
});

// ── Public Routes ───────────────────────────────────────────────────────────
router.post('/signup', authLimiter, validate({ body: signupSchema }), signup);
router.post('/login', authLimiter, validate({ body: loginSchema }), login);
router.post('/refresh', refresh);
router.post('/verify-email', authLimiter, validate({ body: verifyEmailSchema }), verifyEmail);
router.post('/verify-otp', authLimiter, validate({ body: verifyOtpSchema }), verifyOtp);
router.post('/resend-otp', authLimiter, validate({ body: resendOtpSchema }), resendOtp);
router.post('/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), forgotPassword);
router.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), resetPassword);

// ── Google OAuth ────────────────────────────────────────────────────────────
router.get('/google', googleRedirect);
router.get('/google/callback', googleCallback);
router.post('/google/exchange', googleExchangeCode);

// ── Authenticated Routes ────────────────────────────────────────────────────
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getProfile);
router.put('/me', authenticate, validate({ body: updateProfileSchema }), updateProfile);

export default router;
