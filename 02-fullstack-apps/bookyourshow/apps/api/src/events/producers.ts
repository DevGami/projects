import { publishEvent } from '../config/kafka.js';
import { TOPICS } from './topics.js';

// ═══════════════════════════════════════════════════════════════════════════
// Type-Safe Event Producers
// Each function formats the event payload and publishes to the correct topic.
// All functions are fire-and-forget (never throw).
// ═══════════════════════════════════════════════════════════════════════════

// ── Booking Events ──────────────────────────────────────────────────────────

export async function emitBookingConfirmed(booking: {
  id: string;
  userId: string;
  userEmail: string;
  movieTitle: string;
  seats: unknown;
  totalAmount: unknown;
  showtime: {
    showDate: Date | string;
    showTime: string;
    screen: {
      name: string;
      theater: { name: string; city: string; address?: string | null };
    };
  };
}): Promise<void> {
  await publishEvent(TOPICS.BOOKING_CONFIRMED, booking.id, {
    bookingId: booking.id,
    userId: booking.userId,
    userEmail: booking.userEmail,
    movieTitle: booking.movieTitle,
    seats: booking.seats,
    totalAmount: booking.totalAmount,
    showDate: booking.showtime.showDate,
    showTime: booking.showtime.showTime,
    screen: booking.showtime.screen.name,
    theater: booking.showtime.screen.theater.name,
    city: booking.showtime.screen.theater.city,
    address: booking.showtime.screen.theater.address,
  });
}

export async function emitBookingCancelled(booking: {
  id: string;
  userId: string;
  userEmail: string;
  movieTitle: string;
  seats: unknown;
  totalAmount: unknown;
}): Promise<void> {
  await publishEvent(TOPICS.BOOKING_CANCELLED, booking.id, {
    bookingId: booking.id,
    userId: booking.userId,
    userEmail: booking.userEmail,
    movieTitle: booking.movieTitle,
    seats: booking.seats,
    totalAmount: booking.totalAmount,
  });
}

// ── Payment Events ──────────────────────────────────────────────────────────

export async function emitPaymentVerified(data: {
  paymentId: string;
  bookingId: string;
  userId: string;
  amount: number;
  razorpayPaymentId: string;
}): Promise<void> {
  await publishEvent(TOPICS.PAYMENT_VERIFIED, data.paymentId, {
    paymentId: data.paymentId,
    bookingId: data.bookingId,
    userId: data.userId,
    amount: data.amount,
    razorpayPaymentId: data.razorpayPaymentId,
  });
}

export async function emitPaymentRefunded(data: {
  paymentId: string;
  bookingId: string;
  userId: string;
  amount: number;
  refundId: string;
}): Promise<void> {
  await publishEvent(TOPICS.PAYMENT_REFUNDED, data.paymentId, {
    paymentId: data.paymentId,
    bookingId: data.bookingId,
    userId: data.userId,
    amount: data.amount,
    refundId: data.refundId,
  });
}

// ── User Events ─────────────────────────────────────────────────────────────

export async function emitUserSignup(user: {
  id: string;
  name: string;
  email: string;
}): Promise<void> {
  await publishEvent(TOPICS.USER_SIGNUP, user.id, {
    userId: user.id,
    name: user.name,
    email: user.email,
  });
}

export async function emitPasswordResetRequested(data: {
  userId: string;
  email: string;
  resetToken: string;
}): Promise<void> {
  await publishEvent(TOPICS.USER_PASSWORD_RESET, data.userId, {
    userId: data.userId,
    email: data.email,
    resetToken: data.resetToken,
  });
}
