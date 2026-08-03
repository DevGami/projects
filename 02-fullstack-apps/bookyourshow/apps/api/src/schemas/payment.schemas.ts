import { z } from 'zod';

// ── Booking ID Pattern ──────────────────────────────────────────────────────
const bookingIdPattern = /^BYS-[A-Z0-9]{6}$/;

// ── Create Payment Order ────────────────────────────────────────────────────
export const createOrderSchema = z.object({
  bookingId: z.string().regex(bookingIdPattern, 'Invalid booking ID format (expected BYS-XXXXXX)'),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ── Verify Payment ──────────────────────────────────────────────────────────
export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string({ required_error: 'Razorpay Order ID is required' }).min(1),
  razorpay_payment_id: z.string({ required_error: 'Razorpay Payment ID is required' }).min(1),
  razorpay_signature: z.string({ required_error: 'Razorpay Signature is required' }).min(1),
  bookingId: z.string().regex(bookingIdPattern, 'Invalid booking ID format (expected BYS-XXXXXX)'),
});
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

// ── Payment ID Param ────────────────────────────────────────────────────────
export const paymentIdParamSchema = z.object({
  id: z.string().min(1, 'Payment ID is required'),
});
