import { z } from 'zod';

// ── Seat Layout Tier ────────────────────────────────────────────────────────
const seatLayoutTierSchema = z.object({
  tier: z.enum(['Silver', 'Gold', 'VIP']),
  rows: z.array(z.number().int().min(0)).min(1),
  price: z.number().positive(),
});

// ── Theater Schemas ─────────────────────────────────────────────────────────

export const createTheaterSchema = z.object({
  name: z.string().min(2).max(200),
  city: z.string().min(2).max(100),
  address: z.string().max(500).optional(),
  totalScreens: z.number().int().min(1).max(50).default(1),
});
export type CreateTheaterInput = z.infer<typeof createTheaterSchema>;

export const updateTheaterSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  city: z.string().min(2).max(100).optional(),
  address: z.string().max(500).optional(),
  totalScreens: z.number().int().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateTheaterInput = z.infer<typeof updateTheaterSchema>;

// ── Screen Schemas ──────────────────────────────────────────────────────────

export const createScreenSchema = z.object({
  name: z.string().min(1).max(50),
  rows: z.number().int().min(1).max(30),
  cols: z.number().int().min(1).max(40),
  seatLayout: z.array(seatLayoutTierSchema).min(1),
});
export type CreateScreenInput = z.infer<typeof createScreenSchema>;

export const updateScreenSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  rows: z.number().int().min(1).max(30).optional(),
  cols: z.number().int().min(1).max(40).optional(),
  seatLayout: z.array(seatLayoutTierSchema).min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateScreenInput = z.infer<typeof updateScreenSchema>;

// ── Query Schemas ───────────────────────────────────────────────────────────

export const listTheatersQuerySchema = z.object({
  city: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListTheatersQuery = z.infer<typeof listTheatersQuerySchema>;

// ── Param Schemas ───────────────────────────────────────────────────────────

export const theaterIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const screenIdParamSchema = z.object({
  id: z.string().uuid(),
  screenId: z.string().uuid(),
});
