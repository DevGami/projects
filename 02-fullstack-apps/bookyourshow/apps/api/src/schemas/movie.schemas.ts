import { z } from 'zod';

// ── List Movies Query ───────────────────────────────────────────────────────
export const listMoviesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  genre: z.string().optional(),
  language: z.string().optional(),
  status: z.enum(['now_showing', 'upcoming', 'ended']).optional(),
  sort: z.enum(['title', 'rating', 'releaseDate', 'popularity', 'revenue']).default('rating'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// ── Search Movies Query ─────────────────────────────────────────────────────
export const searchMoviesSchema = z.object({
  q: z.string().min(1, 'Search query is required').max(100),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ── Movie Slug Param ────────────────────────────────────────────────────────
export const movieSlugSchema = z.object({
  slug: z.string().min(1),
});

// ── Type Exports ────────────────────────────────────────────────────────────
export type ListMoviesInput = z.infer<typeof listMoviesSchema>;
export type SearchMoviesInput = z.infer<typeof searchMoviesSchema>;
export type MovieSlugInput = z.infer<typeof movieSlugSchema>;
