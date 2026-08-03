import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { redis } from '../config/redis.js';
import { logger } from '../middleware/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// OTP Service — Generate, store (Redis), and send 6-digit OTPs via email
// ═══════════════════════════════════════════════════════════════════════════

const OTP_EXPIRY = 10 * 60; // 10 minutes
const OTP_COOLDOWN = 60;    // 1 minute between resends
const OTP_MAX_ATTEMPTS = 5; // Lock after 5 wrong guesses
const OTP_LOCK_DURATION = 15 * 60; // 15 minute lockout
const OTP_PREFIX = 'bys:otp:';
const OTP_COOLDOWN_PREFIX = 'bys:otp:cooldown:';
const OTP_ATTEMPTS_PREFIX = 'bys:otp:attempts:';

// ── SMTP Transport (MailHog for dev, real SMTP for prod) ─────────────────
const isDev = process.env.NODE_ENV !== 'production';

const transporter = nodemailer.createTransport(
  isDev
    ? {
        host: 'localhost',
        port: 1025,
        secure: false,
        // MailHog doesn't need auth
      }
    : {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }
);

/**
 * Generate a 6-digit numeric OTP
 */
function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Store OTP in Redis with expiry
 */
export async function createAndSendOTP(email: string, userName: string): Promise<void> {
  // Check cooldown
  const cooldownKey = `${OTP_COOLDOWN_PREFIX}${email}`;
  const onCooldown = await redis.exists(cooldownKey);
  if (onCooldown) {
    throw new Error('Please wait before requesting another OTP');
  }

  const otp = generateOTP();
  const otpKey = `${OTP_PREFIX}${email}`;

  // Store OTP hash in Redis (not plain text)
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  await redis.set(otpKey, otpHash, 'EX', OTP_EXPIRY);

  // Set cooldown
  await redis.set(cooldownKey, '1', 'EX', OTP_COOLDOWN);

  // Send email
  try {
    await transporter.sendMail({
      from: '"BookYourShow" <noreply@bookyourshow.com>',
      to: email,
      subject: `${otp} — Your BookYourShow verification code`,
      html: buildOtpEmailHtml(otp, userName),
    });
    logger.info(`OTP email sent to ${email}`);
  } catch (err) {
    logger.error(`Failed to send OTP email to ${email}: ${err}`);
    // Don't throw — the OTP is stored, user can resend
  }
}

/**
 * Verify OTP against stored hash — with brute-force protection
 */
export async function verifyOTP(email: string, otp: string): Promise<boolean> {
  const otpKey = `${OTP_PREFIX}${email}`;
  const attemptsKey = `${OTP_ATTEMPTS_PREFIX}${email}`;

  // Check if locked
  const attempts = await redis.get(attemptsKey);
  if (attempts && parseInt(attempts) >= OTP_MAX_ATTEMPTS) {
    const ttl = await redis.ttl(attemptsKey);
    throw new Error(
      `Too many failed OTP attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`
    );
  }

  const stored = await redis.get(otpKey);
  if (!stored) return false;

  const inputHash = crypto.createHash('sha256').update(otp).digest('hex');
  if (inputHash !== stored) {
    // Increment failed attempts
    const newCount = await redis.incr(attemptsKey);
    if (newCount === 1) {
      // Set lockout expiry on first failure
      await redis.expire(attemptsKey, OTP_LOCK_DURATION);
    }
    logger.warn(`OTP verification failed for ${email} — attempt ${newCount}/${OTP_MAX_ATTEMPTS}`);
    return false;
  }

  // OTP is correct — single-use, clear attempts
  await redis.del(otpKey);
  await redis.del(attemptsKey);
  return true;
}

/**
 * HTML email template for OTP
 */
function buildOtpEmailHtml(otp: string, name: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:system-ui,sans-serif">
  <div style="max-width:480px;margin:40px auto;background:#111827;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6d28d9,#db2777);padding:32px 24px;text-align:center">
      <h1 style="color:#fff;font-size:22px;margin:0">🎬 BookYourShow</h1>
      <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:6px 0 0">Email Verification</p>
    </div>
    <!-- Body -->
    <div style="padding:32px 24px;text-align:center">
      <p style="color:#e2e8f0;font-size:15px;margin:0 0 8px">Hey ${name},</p>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 28px">Use this code to verify your email address:</p>
      
      <!-- OTP Code -->
      <div style="background:#1e293b;border:2px solid #6d28d9;border-radius:12px;padding:20px;display:inline-block;margin:0 auto">
        <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#a78bfa;font-family:monospace">${otp}</span>
      </div>
      
      <p style="color:#64748b;font-size:12px;margin:24px 0 0">This code expires in <strong style="color:#94a3b8">10 minutes</strong>.</p>
      <p style="color:#64748b;font-size:12px;margin:4px 0 0">If you didn't request this, ignore this email.</p>
    </div>
    <!-- Footer -->
    <div style="border-top:1px solid rgba(255,255,255,0.06);padding:16px 24px;text-align:center">
      <p style="color:#475569;font-size:11px;margin:0">© 2026 BookYourShow. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}
