// ═══════════════════════════════════════════════════════════════════════════
// Kafka Topic Constants
// Naming convention: bys.<domain>.<action>
// ═══════════════════════════════════════════════════════════════════════════

export const TOPICS = {
  // ── Booking Events ────────────────────────────────────────────────────────
  BOOKING_CONFIRMED: 'bys.booking.confirmed',
  BOOKING_CANCELLED: 'bys.booking.cancelled',

  // ── Payment Events ────────────────────────────────────────────────────────
  PAYMENT_VERIFIED: 'bys.payment.verified',
  PAYMENT_REFUNDED: 'bys.payment.refunded',

  // ── User Events ───────────────────────────────────────────────────────────
  USER_SIGNUP: 'bys.user.signup',
  USER_PASSWORD_RESET: 'bys.user.password-reset',
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];
