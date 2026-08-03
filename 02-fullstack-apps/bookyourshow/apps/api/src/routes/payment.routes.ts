import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  createOrderSchema,
  verifyPaymentSchema,
  paymentIdParamSchema,
} from '../schemas/payment.schemas.js';
import {
  createOrderHandler,
  verifyPaymentHandler,
  refundPaymentHandler,
} from '../controllers/payment.controller.js';

const router = Router();

// All payment routes require authentication
router.use(authenticate);

// ── Payment Routes ──────────────────────────────────────────────────────────
router.post('/order', validate({ body: createOrderSchema }), createOrderHandler);
router.post('/verify', validate({ body: verifyPaymentSchema }), verifyPaymentHandler);
router.post('/:id/refund', validate({ params: paymentIdParamSchema }), refundPaymentHandler);

export default router;
