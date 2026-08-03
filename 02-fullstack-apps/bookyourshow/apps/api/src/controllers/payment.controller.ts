import { Request, Response } from 'express';
import {
  createPaymentOrder,
  verifyPayment,
  refundPayment,
} from '../services/payment.service.js';
import type { CreateOrderInput, VerifyPaymentInput } from '../schemas/payment.schemas.js';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/payments/order — Create Razorpay order for a PENDING booking
// ═══════════════════════════════════════════════════════════════════════════
export async function createOrderHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { bookingId } = req.body as CreateOrderInput;

  const result = await createPaymentOrder(bookingId, userId);

  res.status(201).json({
    success: true,
    data: result,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/payments/verify — Verify Razorpay signature & confirm booking
// ═══════════════════════════════════════════════════════════════════════════
export async function verifyPaymentHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const payload = req.body as VerifyPaymentInput;

  const result = await verifyPayment(payload, userId);

  res.status(200).json({
    success: true,
    data: result,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/payments/:id/refund — Refund a captured payment
// ═══════════════════════════════════════════════════════════════════════════
export async function refundPaymentHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: paymentId } = req.params;

  const result = await refundPayment(paymentId, userId);

  res.status(200).json({
    success: true,
    data: result,
  });
}
