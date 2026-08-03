import { z } from 'zod';

// ── Create Showtime ─────────────────────────────────────────────────────────
export const createShowtimeSchema = z.object({
  movieTmdbId: z.number().int().positive(),
  movieTitle: z.string().min(1).max(300),
  screenId: z.string().uuid(),
  showDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  showTime: z.string().regex(/^\d{2}:\d{2}\s?(AM|PM)$/i, 'Time must be HH:MM AM/PM format'),
  priceMultiplier: z.number().min(0.5).max(5.0).default(1.0),
});
export type CreateShowtimeInput = z.infer<typeof createShowtimeSchema>;

// ── List Showtimes Query ────────────────────────────────────────────────────
export const listShowtimesQuerySchema = z.object({
  movieTmdbId: z.coerce.number().int().positive().optional(),
  city: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional(),
  screenId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListShowtimesQuery = z.infer<typeof listShowtimesQuerySchema>;

// ── Param Schemas ───────────────────────────────────────────────────────────
export const showtimeIdParamSchema = z.object({
  id: z.string().uuid(),
});
