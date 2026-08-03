import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import {
  createShowtimeSchema,
  listShowtimesQuerySchema,
  showtimeIdParamSchema,
} from '../schemas/showtime.schemas.js';
import {
  createShowtime,
  listShowtimes,
  getShowtime,
  cancelShowtime,
} from '../controllers/showtime.controller.js';

const router = Router();

// ── Public Routes ───────────────────────────────────────────────────────────
router.get('/', validate({ query: listShowtimesQuerySchema }), listShowtimes);
router.get('/:id', validate({ params: showtimeIdParamSchema }), getShowtime);

// ── Admin Routes ────────────────────────────────────────────────────────────
router.post('/', authenticate, authorize('ADMIN'), validate({ body: createShowtimeSchema }), createShowtime);
router.delete('/:id', authenticate, authorize('ADMIN'), validate({ params: showtimeIdParamSchema }), cancelShowtime);

export default router;
