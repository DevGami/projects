import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { listMoviesSchema, searchMoviesSchema, movieSlugSchema } from '../schemas/movie.schemas.js';
import {
  listMovies,
  nowShowing,
  searchMovies,
  getGenres,
  getMovieBySlug,
  triggerSync,
  syncStatus,
} from '../controllers/movie.controller.js';

const router = Router();

// ── Public Routes ───────────────────────────────────────────────────────────
router.get('/', validate({ query: listMoviesSchema }), listMovies);
router.get('/now-showing', nowShowing);
router.get('/search', validate({ query: searchMoviesSchema }), searchMovies);
router.get('/genres', getGenres);

// ── Admin Routes (must be BEFORE /:slug to avoid conflict) ──────────────────
router.post('/sync', authenticate, authorize('ADMIN'), triggerSync);
router.get('/sync/status', authenticate, authorize('ADMIN'), syncStatus);

// ── Dynamic Slug Route (must be LAST) ───────────────────────────────────────
router.get('/:slug', validate({ params: movieSlugSchema }), getMovieBySlug);

export default router;
