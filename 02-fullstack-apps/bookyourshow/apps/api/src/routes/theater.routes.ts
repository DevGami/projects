import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import {
  createTheaterSchema,
  updateTheaterSchema,
  createScreenSchema,
  updateScreenSchema,
  listTheatersQuerySchema,
  theaterIdParamSchema,
  screenIdParamSchema,
} from '../schemas/theater.schemas.js';
import {
  createTheater,
  listTheaters,
  getTheater,
  updateTheater,
  createScreen,
  updateScreen,
} from '../controllers/theater.controller.js';

const router = Router();

// ── Public Routes ───────────────────────────────────────────────────────────
router.get('/', validate({ query: listTheatersQuerySchema }), listTheaters);
router.get('/:id', validate({ params: theaterIdParamSchema }), getTheater);

// ── Admin Routes ────────────────────────────────────────────────────────────
router.post('/', authenticate, authorize('ADMIN'), validate({ body: createTheaterSchema }), createTheater);
router.put('/:id', authenticate, authorize('ADMIN'), validate({ params: theaterIdParamSchema, body: updateTheaterSchema }), updateTheater);
router.post('/:id/screens', authenticate, authorize('ADMIN'), validate({ params: theaterIdParamSchema, body: createScreenSchema }), createScreen);
router.put('/:id/screens/:screenId', authenticate, authorize('ADMIN'), validate({ params: screenIdParamSchema, body: updateScreenSchema }), updateScreen);

export default router;
