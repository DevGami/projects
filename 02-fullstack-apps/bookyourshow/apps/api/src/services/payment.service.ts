import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../middleware/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { confirmBookingById, cancelBookingById } from './booking.service.js';
import { emitPaymentVerified, emitPaymentRefunded } from '../events/producers.js';
import type { VerifyPaymentInput } from '../schemas/payment.schemas.js';

// ═══════════════════════════════════════════════════════════════════════════
// Razorpay Client Initialization
// ═══════════════════════════════════════════════════════════════════════════
const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID || '',
  key_secret: env.RAZORPAY_KEY_SECRET || '',
});

// ── Generate Payment ID ─────────────────────────────────────────────────────
// Format: PAY-XXXXXXXXXXXX (12 alphanumeric chars)
function generatePaymentId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'PAY-';
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) {
    id += chars[bytes[i]! % chars.length];
  }
  return id;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Create Razorpay Order
// Takes a PENDING booking, creates a Razorpay order, stores Payment record
// ═══════════════════════════════════════════════════════════════════════════
export async function createPaymentOrder(bookingId: string, userId: string) {
  // 1. Validate Razorpay keys are configured
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.', 500, 'PAYMENT_NOT_CONFIGURED');
  }

  // 2. Find the booking
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  if (booking.userId !== userId) {
    throw new AppError('Not your booking', 403, 'FORBIDDEN');
  }

  if (booking.status !== 'PENDING') {
    throw new AppError(
      `Cannot initiate payment for booking in ${booking.status} status`,
      400,
      'INVALID_BOOKING_STATUS'
    );
  }

  // 3. Check if a payment order already exists for this booking
  const existingPayment = await prisma.payment.findUnique({
    where: { bookingId },
  });

  if (existingPayment && existingPayment.status === 'CREATED') {
    // Return the existing order so the frontend can retry payment
    logger.info(`Returning existing payment order for booking ${bookingId}`);
    return {
      order: { id: existingPayment.razorpayOrderId, amount: Math.round(Number(existingPayment.amount) * 100), currency: existingPayment.currency },
      paymentId: existingPayment.id,
      key: env.RAZORPAY_KEY_ID,
    };
  }

  // 4. Create Razorpay order
  const amountInPaise = Math.round(Number(booking.totalAmount) * 100);

  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt: `receipt_${bookingId}`,
    notes: {
      bookingId,
      userId,
      movieTitle: booking.movieTitle,
    },
  });

  // 5. Create Payment record in PostgreSQL
  const paymentId = generatePaymentId();
  const payment = await prisma.payment.create({
    data: {
      id: paymentId,
      bookingId,
      razorpayOrderId: order.id,
      amount: Number(booking.totalAmount),
      currency: 'INR',
      status: 'CREATED',
    },
  });

  logger.info(`Razorpay order ${order.id} created for booking ${bookingId} (₹${booking.totalAmount})`);

  return {
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    },
    paymentId: payment.id,
    key: env.RAZORPAY_KEY_ID, // Frontend needs this to open Razorpay checkout
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Verify Payment Signature & Confirm Booking
// Called by frontend after successful Razorpay checkout
// ═══════════════════════════════════════════════════════════════════════════
export async function verifyPayment(payload: VerifyPaymentInput, userId: string) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = payload;

  // 1. Verify the HMAC signature
  const secret = env.RAZORPAY_KEY_SECRET!;
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (generatedSignature !== razorpay_signature) {
    logger.error(`Invalid payment signature for order ${razorpay_order_id}`);
    throw new AppError('Payment verification failed — invalid signature', 400, 'INVALID_SIGNATURE');
  }

  // 2. Find the payment record
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId: razorpay_order_id, bookingId },
  });

  if (!payment) {
    throw new AppError('Payment record not found for this order', 404, 'PAYMENT_NOT_FOUND');
  }

  if (payment.status === 'CAPTURED') {
    // Idempotent — already processed
    logger.info(`Payment ${payment.id} already captured, returning success`);
    return { success: true, message: 'Payment already verified and booking confirmed' };
  }

  // 3. Update Payment record
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: 'CAPTURED',
      capturedAt: new Date(),
    },
  });

  // 4. Confirm the booking (moves seats from hold → booked in Redis)
  const result = await confirmBookingById(bookingId, userId);

  if (!result.success) {
    logger.error(`Payment captured but booking confirmation failed: ${result.error?.message}`);
    // Payment is captured but booking failed — flag for manual review
    throw new AppError(
      `Payment captured but booking confirmation failed: ${result.error?.message}`,
      500,
      'BOOKING_CONFIRM_FAILED'
    );
  }

  logger.info(`Payment verified and booking ${bookingId} confirmed`);

  // Emit Kafka event (fire-and-forget)
  emitPaymentVerified({
    paymentId: payment.id,
    bookingId,
    userId,
    amount: Number(payment.amount),
    razorpayPaymentId: razorpay_payment_id,
  });

  return {
    success: true,
    message: 'Payment successful and booking confirmed',
    booking: result.booking,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Process Refund
// Refunds via Razorpay API, cancels booking, releases seats
// ═══════════════════════════════════════════════════════════════════════════
export async function refundPayment(paymentId: string, userId: string) {
  // 1. Find the payment
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true },
  });

  if (!payment) {
    throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
  }

  if (payment.booking.userId !== userId) {
    throw new AppError('Not your payment', 403, 'FORBIDDEN');
  }

  if (payment.status !== 'CAPTURED') {
    throw new AppError(
      `Cannot refund a payment with status: ${payment.status}`,
      400,
      'INVALID_PAYMENT_STATUS'
    );
  }

  if (!payment.razorpayPaymentId) {
    throw new AppError('No Razorpay payment ID found — cannot process refund', 400, 'NO_PAYMENT_ID');
  }

  // 2. Call Razorpay Refund API
  const amountInPaise = Math.round(Number(payment.amount) * 100);

  const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
    amount: amountInPaise,
  });

  // 3. Update Payment record
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'REFUNDED',
      refundId: refund.id,
      refundedAt: new Date(),
    },
  });

  // 4. Cancel the booking (releases seats from Redis)
  const cancelResult = await cancelBookingById(payment.bookingId, userId);

  if (!cancelResult.success) {
    logger.warn(`Refund processed but booking cancellation had issue: ${cancelResult.error?.message}`);
  }

  logger.info(`Refund ${refund.id} processed for payment ${paymentId}, booking ${payment.bookingId} cancelled`);

  // Emit Kafka event (fire-and-forget)
  emitPaymentRefunded({
    paymentId,
    bookingId: payment.bookingId,
    userId,
    amount: Number(payment.amount),
    refundId: refund.id,
  });

  return {
    refundId: refund.id,
    amount: Number(payment.amount),
    status: 'REFUNDED',
    booking: cancelResult.booking,
  };
}
