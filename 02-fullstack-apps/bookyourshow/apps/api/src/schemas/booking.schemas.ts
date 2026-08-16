import { z } from 'zod';

// ── Seat Selection ──────────────────────────────────────────────────────────
const seatSelectionSchema = z.object({
  id: z.string().regex(/^[A-Z]\d{1,2}$/, 'Seat ID must be like A1, B10, etc.'),
  tier: z.enum(['Classic', 'Prime', 'Prime Plus', 'Recliner']),
  price: z.number().positive(),
});

// ── Create Booking ──────────────────────────────────────────────────────────
export const createBookingSchema = z.object({
  showtimeId: z.string().uuid(),
  seats: z.array(seatSelectionSchema).min(1).max(10, 'Maximum 10 seats per booking'),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

// ── Booking ID Param ────────────────────────────────────────────────────────
export const bookingIdParamSchema = z.object({
  id: z.string().regex(/^BYS-[A-Z0-9]{6}$/, 'Invalid booking ID format'),
});

// ── My Bookings Query ───────────────────────────────────────────────────────
export const myBookingsQuerySchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type MyBookingsQuery = z.infer<typeof myBookingsQuerySchema>;
