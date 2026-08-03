import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import {
  getDashboardStats,
  getUsers,
  updateUserRole,
  triggerMovieSync,
  updateMovie,
  deleteMovie,
  createTheater,
  updateTheater,
  deleteTheater,
  getShowtimes,
  createShowtime,
  deleteShowtime,
  getAllBookings,
} from '../controllers/admin.controller.js';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(authenticate, authorize('ADMIN'));

// ── Dashboard ─────────────────────────────────────────────────
router.get('/stats', getDashboardStats);

// ── Users ─────────────────────────────────────────────────────
router.get('/users', getUsers);
router.patch('/users/:id/role', updateUserRole);

// ── Movies ────────────────────────────────────────────────────
router.post('/movies/sync', triggerMovieSync);
router.patch('/movies/:id', updateMovie);
router.delete('/movies/:id', deleteMovie);

// ── Theaters ──────────────────────────────────────────────────
router.post('/theaters', createTheater);
router.patch('/theaters/:id', updateTheater);
router.delete('/theaters/:id', deleteTheater);

// ── Showtimes ─────────────────────────────────────────────────
router.get('/showtimes', getShowtimes);
router.post('/showtimes', createShowtime);
router.delete('/showtimes/:id', deleteShowtime);

// ── Bookings ──────────────────────────────────────────────────
router.get('/bookings', getAllBookings);

export default router;
