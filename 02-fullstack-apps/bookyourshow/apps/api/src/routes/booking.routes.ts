import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  createBookingSchema,
  bookingIdParamSchema,
  myBookingsQuerySchema,
} from '../schemas/booking.schemas.js';
import {
  createBookingHandler,
  getMyBookings,
  getBookingDetail,
  confirmBookingHandler,
  cancelBookingHandler,
} from '../controllers/booking.controller.js';

const router = Router();

// All booking routes require authentication
router.use(authenticate);

// ── Booking Routes ──────────────────────────────────────────────────────────
router.post('/', validate({ body: createBookingSchema }), createBookingHandler);
router.get('/', validate({ query: myBookingsQuerySchema }), getMyBookings);
router.get('/:id', validate({ params: bookingIdParamSchema }), getBookingDetail);
router.post('/:id/confirm', validate({ params: bookingIdParamSchema }), confirmBookingHandler);
router.post('/:id/cancel', validate({ params: bookingIdParamSchema }), cancelBookingHandler);

export default router;
