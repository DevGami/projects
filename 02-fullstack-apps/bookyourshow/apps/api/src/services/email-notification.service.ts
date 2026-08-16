// ===============================================================================
// BookYourShow - Email Notification Service
// Direct Nodemailer implementation (bypasses Kafka + Java notification service)
// This ensures emails are delivered reliably even if Kafka/Java are down.
// ===============================================================================

import nodemailer from 'nodemailer';
import { logger } from '../middleware/logger.js';

const isDev = process.env.NODE_ENV !== 'production';

const transporter = nodemailer.createTransport(
  isDev
    ? {
        host: 'localhost',
        port: 1025,
        secure: false,
      }
    : {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }
);

const FROM = '"BookYourShow" <noreply@bookyourshow.com>';

// ── Shared Header/Footer Templates ─────────────────────────────────────────────
function emailHeader(title: string, subtitle: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#111827;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden">
    <div style="background:linear-gradient(135deg,#6d28d9,#db2777);padding:28px 24px;text-align:center">
      <h1 style="color:#fff;font-size:20px;margin:0;font-weight:800">🎬 BookYourShow</h1>
      <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:6px 0 0;font-weight:600">${title}</p>
      ${subtitle ? `<p style="color:rgba(255,255,255,0.65);font-size:12px;margin:4px 0 0">${subtitle}</p>` : ''}
    </div>`;
}

function emailFooter(): string {
  return `
    <div style="border-top:1px solid rgba(255,255,255,0.06);padding:16px 24px;text-align:center">
      <p style="color:#475569;font-size:11px;margin:0">
        © ${new Date().getFullYear()} BookYourShow. Need help?
        <a href="mailto:support@bookyourshow.com" style="color:#7c3aed;text-decoration:none">support@bookyourshow.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="color:#94a3b8;font-size:12px;padding:6px 0;width:120px;vertical-align:top">${label}</td>
    <td style="color:#e2e8f0;font-size:13px;padding:6px 0;font-weight:500">${value}</td>
  </tr>`;
}

// ── Booking Confirmation Email ─────────────────────────────────────────────────
export interface BookingConfirmationPayload {
  userName: string;
  userEmail: string;
  bookingId: string;
  movieTitle: string;
  showDate: string | Date;
  showTime: string;
  theaterName: string;
  theaterCity: string;
  screenName: string;
  seats: Array<{ id: string; tier: string; price: number }>;
  totalAmount: number;
}

export async function sendBookingConfirmationEmail(payload: BookingConfirmationPayload): Promise<void> {
  const seatList = payload.seats.map(s => `${s.id} (${s.tier})`).join(', ');
  const showDateStr = payload.showDate instanceof Date
    ? payload.showDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' })
    : String(payload.showDate);
  const amountStr = `₹${Number(payload.totalAmount).toFixed(2)}`;

  const html = `
${emailHeader('Booking Confirmed!', 'Your tickets are booked')}
    <div style="padding:28px 24px">
      <p style="color:#e2e8f0;font-size:15px;margin:0 0 6px">Hey ${payload.userName}!</p>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 24px">
        Your booking is confirmed. Here are your ticket details:
      </p>

      <!-- Booking ID badge -->
      <div style="background:#1e293b;border:1px solid #6d28d9;border-radius:10px;padding:14px 18px;margin-bottom:20px;text-align:center">
        <p style="color:#94a3b8;font-size:11px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px">Booking ID</p>
        <p style="color:#a78bfa;font-size:18px;font-weight:800;font-family:monospace;margin:0;letter-spacing:2px">${payload.bookingId}</p>
      </div>

      <!-- Details table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow('Movie', payload.movieTitle)}
        ${infoRow('Date', showDateStr)}
        ${infoRow('Time', payload.showTime)}
        ${infoRow('Theater', `${payload.theaterName}, ${payload.theaterCity}`)}
        ${infoRow('Screen', payload.screenName)}
        ${infoRow('Seats', seatList)}
        ${infoRow('Total Paid', amountStr)}
      </table>

      <div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:12px 16px;margin-top:4px">
        <p style="color:#4ade80;font-size:12px;margin:0">
          ✅ Show this booking ID at the theater to collect your tickets.
        </p>
      </div>

      <p style="color:#64748b;font-size:11px;margin:20px 0 0;text-align:center">
        Doors open 15 minutes before the show. Enjoy the movie!
      </p>
    </div>
${emailFooter()}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to: payload.userEmail,
      subject: `Booking Confirmed — ${payload.movieTitle} [${payload.bookingId}]`,
      html,
    });
    logger.info(`Booking confirmation email sent to ${payload.userEmail} for ${payload.bookingId}`);
  } catch (err) {
    logger.error(`Failed to send booking confirmation email to ${payload.userEmail}: ${err}`);
  }
}

// ── Booking Cancellation Email ─────────────────────────────────────────────────
export interface BookingCancellationPayload {
  userName: string;
  userEmail: string;
  bookingId: string;
  movieTitle: string;
  totalAmount: number;
  refundId?: string;
}

export async function sendBookingCancellationEmail(payload: BookingCancellationPayload): Promise<void> {
  const amountStr = `₹${Number(payload.totalAmount).toFixed(2)}`;

  const html = `
${emailHeader('Booking Cancelled', payload.refundId ? 'Your refund is being processed' : 'Your booking has been cancelled')}
    <div style="padding:28px 24px">
      <p style="color:#e2e8f0;font-size:15px;margin:0 0 6px">Hi ${payload.userName},</p>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 24px">
        Your booking has been successfully cancelled.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow('Booking ID', payload.bookingId)}
        ${infoRow('Movie', payload.movieTitle)}
        ${infoRow('Amount', amountStr)}
        ${payload.refundId ? infoRow('Refund ID', payload.refundId) : ''}
      </table>

      ${payload.refundId ? `
      <div style="background:#1c1400;border:1px solid #854d0e;border-radius:8px;padding:12px 16px">
        <p style="color:#fbbf24;font-size:12px;margin:0">
          💰 Your refund of ${amountStr} has been initiated. It will reflect in 3-5 business days.
        </p>
      </div>` : ''}

      <p style="color:#64748b;font-size:11px;margin:20px 0 0;text-align:center">
        We hope to see you at the movies again soon!
      </p>
    </div>
${emailFooter()}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to: payload.userEmail,
      subject: `Booking Cancelled — ${payload.movieTitle} [${payload.bookingId}]`,
      html,
    });
    logger.info(`Cancellation email sent to ${payload.userEmail} for ${payload.bookingId}`);
  } catch (err) {
    logger.error(`Failed to send cancellation email to ${payload.userEmail}: ${err}`);
  }
}

// ── Password Reset Email ──────────────────────────────────────────────────────
export async function sendPasswordResetEmail(email: string, userName: string, resetToken: string): Promise<void> {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  const html = `
${emailHeader('Reset Your Password', '')}
    <div style="padding:28px 24px;text-align:center">
      <p style="color:#e2e8f0;font-size:15px;margin:0 0 8px">Hey ${userName},</p>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 24px">
        Click the button below to reset your password. This link expires in 1 hour.
      </p>
      <a href="${resetUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#6d28d9,#db2777);color:#fff;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;margin-bottom:20px">
        Reset Password
      </a>
      <p style="color:#64748b;font-size:11px;margin:16px 0 0">
        If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
${emailFooter()}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to: email,
      subject: 'Reset your BookYourShow password',
      html,
    });
    logger.info(`Password reset email sent to ${email}`);
  } catch (err) {
    logger.error(`Failed to send password reset email to ${email}: ${err}`);
  }
}
