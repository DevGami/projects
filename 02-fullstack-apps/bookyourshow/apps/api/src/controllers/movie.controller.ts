import { Request, Response } from 'express';
import crypto from 'crypto';
import { Movie } from '../models/mongo/Movie.js';
import { redis } from '../config/redis.js';
import { logger } from '../middleware/logger.js';
import { syncMoviesFromTMDB, getSyncStatus } from '../services/movie-sync.service.js';
import type { ListMoviesInput, SearchMoviesInput } from '../schemas/movie.schemas.js';

// ── Cache helpers ───────────────────────────────────────────────────────────
function cacheKey(prefix: string, params: Record<string, unknown>): string {
  const hash = crypto.createHash('md5').update(JSON.stringify(params)).digest('hex').slice(0, 12);
  return `bys:movies:${prefix}:${hash}`;
}

async function getFromCache<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

async function setCache(key: string, data: unknown, ttlSeconds: number): Promise<void> {
  await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/movies — List movies with filters + pagination
// ═══════════════════════════════════════════════════════════════════════════
export async function listMovies(req: Request, res: Response): Promise<void> {
  const { page, limit, genre, language, status, sort, order } = ((req as any).validatedQuery || req.query) as ListMoviesInput;

  // Check cache
  const key = cacheKey('list', { page, limit, genre, language, status, sort, order });
  const cached = await getFromCache<unknown>(key);
  if (cached) {
    res.json(cached);
    return;
  }

  // Build query filter
  const filter: Record<string, unknown> = { isActive: true };
  if (status) filter.status = status;
  else filter.status = 'now_showing'; // Default to now_showing
  if (genre) filter.genres = { $in: [genre] };
  if (language) filter.language = language;

  // Build sort
  const sortMap: Record<string, string> = {
    title: 'title',
    rating: 'rating',
    releaseDate: 'releaseDate',
    popularity: 'popularity',
    revenue: 'revenue',
  };
  const sortField = sortMap[sort] || 'rating';
  const sortOrder = order === 'asc' ? 1 : -1;

  const skip = (page - 1) * limit;

  const [movies, total] = await Promise.all([
    Movie.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .select('-cast -description -customDescription')  // Exclude heavy fields for list
      .lean(),
    Movie.countDocuments(filter),
  ]);

  const response = {
    success: true,
    data: {
      movies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  };

  // Cache for 10 minutes
  await setCache(key, response, 600);

  res.json(response);
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/movies/now-showing — Shortcut for currently playing
// Accepts optional ?city=Ahmedabad to filter by city with active showtimes
// Accepts optional ?sort=rating|popularity|title|revenue  &order=asc|desc
// ═══════════════════════════════════════════════════════════════════════════
export async function nowShowing(req: Request, res: Response): Promise<void> {
  const city = (req.query.city as string) || '';
  const sort = (req.query.sort as string) || 'rating';
  const order = (req.query.order as string) || 'desc';

  const key = cacheKey('now-showing', { city, sort, order });
  const cached = await getFromCache<unknown>(key);
  if (cached) {
    res.json(cached);
    return;
  }

  // Build sort
  const sortMap: Record<string, string> = {
    title: 'title',
    rating: 'rating',
    popularity: 'popularity',
    revenue: 'revenue',
  };
  const sortField = sortMap[sort] || 'rating';
  const sortOrder = order === 'asc' ? 1 : -1;

  let filter: Record<string, unknown> = { status: 'now_showing', isActive: true };

  // If a city is specified, only show movies that have active showtimes in that city
  if (city) {
    try {
      const { prisma } = await import('../config/database.js');

      // Find all unique movieTmdbIds from active showtimes in theaters in this city
      const showtimesInCity = await prisma.showtime.findMany({
        where: {
          status: 'ACTIVE',
          showDate: { gte: new Date() },
          screen: {
            theater: {
              city: { equals: city, mode: 'insensitive' },
              isActive: true,
            },
          },
        },
        select: { movieTmdbId: true },
        distinct: ['movieTmdbId'],
      });

      const tmdbIds = showtimesInCity.map(s => s.movieTmdbId);

      if (tmdbIds.length === 0) {
        // No showtimes seeded for this city yet — fall back to all now-showing movies
        // so the page is never empty for the user
        logger.info(`No showtimes found for city "${city}", falling back to all now-showing movies`);
        // filter stays as { status: 'now_showing', isActive: true } — no city restriction
      } else {
        filter.tmdbId = { $in: tmdbIds };
      }
    } catch (err) {
      // If Prisma query fails, fall back to showing all movies
      logger.warn(`City filter failed for "${city}", falling back to all movies: ${err}`);
    }
  }

  const movies = await Movie.find(filter)
    .sort({ [sortField]: sortOrder })
    .select('-cast -description -customDescription')
    .lean();

  const response = {
    success: true,
    data: { movies, total: movies.length, city },
  };

  await setCache(key, response, 300); // 5 min cache (shorter for city-filtered)
  res.json(response);
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/movies/search?q=... — Text search
// ═══════════════════════════════════════════════════════════════════════════
export async function searchMovies(req: Request, res: Response): Promise<void> {
  const { q, page, limit } = ((req as any).validatedQuery || req.query) as SearchMoviesInput;

  const key = cacheKey('search', { q, page, limit });
  const cached = await getFromCache<unknown>(key);
  if (cached) {
    res.json(cached);
    return;
  }

  const skip = (page - 1) * limit;

  const [movies, total] = await Promise.all([
    Movie.find(
      { $text: { $search: q }, isActive: true },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit)
      .select('-customDescription')
      .lean(),
    Movie.countDocuments({ $text: { $search: q }, isActive: true }),
  ]);

  const response = {
    success: true,
    data: {
      movies,
      query: q,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  };

  await setCache(key, response, 300); // 5 min cache for search
  res.json(response);
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/movies/genres — List all genres
// ═══════════════════════════════════════════════════════════════════════════
export async function getGenres(_req: Request, res: Response): Promise<void> {
  const key = 'bys:movies:genres';
  const cached = await getFromCache<unknown>(key);
  if (cached) {
    res.json(cached);
    return;
  }

  // Aggregate distinct genres from all active movies
  const genres = await Movie.distinct('genres', { isActive: true });
  genres.sort();

  const response = {
    success: true,
    data: { genres },
  };

  await setCache(key, response, 86400); // 24 hour cache
  res.json(response);
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/movies/:slug — Movie detail by slug
// ═══════════════════════════════════════════════════════════════════════════
export async function getMovieBySlug(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;

  const key = `bys:movies:detail:${slug}`;
  const cached = await getFromCache<unknown>(key);
  if (cached) {
    res.json(cached);
    return;
  }

  const movie = await Movie.findOne({ slug, isActive: true }).lean();

  if (!movie) {
    res.status(404).json({
      success: false,
      error: { code: 'MOVIE_NOT_FOUND', message: `Movie with slug "${slug}" not found` },
    });
    return;
  }

  const response = {
    success: true,
    data: { movie },
  };

  await setCache(key, response, 1800); // 30 min cache
  res.json(response);
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/movies/sync — Admin: trigger manual sync
// ═══════════════════════════════════════════════════════════════════════════
export async function triggerSync(_req: Request, res: Response): Promise<void> {
  // Check if sync is already running
  const currentStatus = await getSyncStatus();
  if (currentStatus?.status === 'syncing') {
    res.status(409).json({
      success: false,
      error: { code: 'SYNC_IN_PROGRESS', message: 'A sync is already running' },
    });
    return;
  }

  logger.info('🔄 Manual sync triggered by admin');

  // Run sync in background (don't await — return immediately)
  syncMoviesFromTMDB().catch(err => {
    logger.error('Background sync failed:', err);
  });

  res.status(202).json({
    success: true,
    data: { message: 'Sync started. Check /api/v1/movies/sync/status for progress.' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/movies/sync/status — Admin: check sync status
// ═══════════════════════════════════════════════════════════════════════════
export async function syncStatus(_req: Request, res: Response): Promise<void> {
  const status = await getSyncStatus();

  res.json({
    success: true,
    data: status || { status: 'never_synced', message: 'No sync has been run yet' },
  });
}
