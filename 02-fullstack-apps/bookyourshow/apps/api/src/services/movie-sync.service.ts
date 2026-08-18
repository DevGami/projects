import slugify from 'slugify';
import { Movie } from '../models/mongo/Movie.js';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { logger } from '../middleware/logger.js';
import {
  fetchAllNowPlayingIndia,
  getMovieDetails,
  getGenreMap,
  extractCast,
  extractDirector,
  extractTrailer,
  extractCertification,
  languageName,
  tmdbImageUrl,
} from './tmdb.client.js';
// Lazy import to avoid circular dep — catchUpShowtimes imported here
let _catchUpShowtimes: (() => Promise<void>) | null = null;
async function triggerShowtimeCatchUp(): Promise<void> {
  if (!_catchUpShowtimes) {
    const mod = await import('./showtime-generator.service.js');
    _catchUpShowtimes = mod.catchUpShowtimes;
  }
  await _catchUpShowtimes();
}

// ═══════════════════════════════════════════════════════════════════════════
// Sync Status Tracking
// ═══════════════════════════════════════════════════════════════════════════
interface SyncStatus {
  lastSyncAt: string;
  duration: string;
  moviesAdded: number;
  moviesUpdated: number;
  moviesEnded: number;
  totalMovies: number;
  status: 'idle' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

const SYNC_STATUS_KEY = 'bys:movies:sync:status';

export async function getSyncStatus(): Promise<SyncStatus | null> {
  const data = await redis.get(SYNC_STATUS_KEY);
  return data ? JSON.parse(data) : null;
}

async function setSyncStatus(status: SyncStatus): Promise<void> {
  await redis.set(SYNC_STATUS_KEY, JSON.stringify(status));
}

// ═══════════════════════════════════════════════════════════════════════════
// Generate URL-Safe Slug
// ═══════════════════════════════════════════════════════════════════════════
function generateSlug(title: string, tmdbId: number): string {
  const base = slugify(title, {
    lower: true,
    strict: true,
    trim: true,
  });
  // Append tmdbId to ensure uniqueness for same-named movies
  return `${base}-${tmdbId}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Full Sync: TMDB → MongoDB
// ═══════════════════════════════════════════════════════════════════════════
export async function syncMoviesFromTMDB(): Promise<SyncStatus> {
  const startTime = Date.now();
  let moviesAdded = 0;
  let moviesUpdated = 0;
  let moviesEnded = 0;

  try {
    await setSyncStatus({
      lastSyncAt: new Date().toISOString(),
      duration: '0s',
      moviesAdded: 0,
      moviesUpdated: 0,
      moviesEnded: 0,
      totalMovies: 0,
      status: 'syncing',
    });

    logger.info('🎬 Starting TMDB movie sync (all Indian languages)...');

    // Step 1: Fetch genre map (non-fatal — if it fails we still sync movies)
    let genreMap: Map<number, string> = new Map();
    try {
      genreMap = await getGenreMap();
      logger.info(`📚 Loaded ${genreMap.size} genres`);
    } catch (genreErr) {
      logger.warn(`⚠️ Genre map fetch failed (non-fatal): ${genreErr}. Movie sync will continue without genre names.`);
    }

    // Step 2: Fetch ALL now-playing movies in India across all major Indian
    // languages (hi, ta, te, ml, en-IN, pa, kn, mr) — deduplicated by TMDB ID.
    // This gives us a complete picture of what's actually in theatres.
    // fetchAllNowPlayingIndia handles per-language errors internally.
    const allMovieResults = await fetchAllNowPlayingIndia();
    logger.info(`🎬 Fetched ${allMovieResults.length} unique movies from TMDB (all languages)`);

    // If TMDB returned nothing at all, throw so the catch block uses mock data
    if (allMovieResults.length === 0) {
      throw new Error('fetch failed: TMDB returned 0 movies across all languages');
    }

    // Sort by popularity descending and keep exactly the top 20 movies
    const top20Movies = allMovieResults
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 20);

    logger.info(`🎬 Processing top ${top20Movies.length} popular now-playing movies from TMDB`);

    const allTmdbIds: Set<number> = new Set();

    // Step 3: Upsert top 20 fetched movies in parallel batches of 5
    const CONCURRENCY = 5;
    for (let i = 0; i < top20Movies.length; i += CONCURRENCY) {
      const batch = top20Movies.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        batch.map(async (movie) => {
          try {
            const details = await getMovieDetails(movie.id);

            // Detect available formats based on genres, budget, and language
            const genres = details.genres.map(g => g.name);
            const budget = details.budget || 0;
            const isEnglish = details.original_language === 'en';
            const formats: string[] = ['2D'];

            const isAction = genres.some(g => ['Action', 'Adventure', 'Science Fiction'].includes(g));
            const isAnimated = genres.includes('Animation');
            const isFantasy = genres.some(g => ['Fantasy', 'Science Fiction'].includes(g));
            const isBigBudget = budget > 80_000_000;

            if (isEnglish && isAction && isBigBudget) formats.push('IMAX');
            if (isAnimated || (isEnglish && isFantasy && isBigBudget)) formats.push('3D');
            if (isEnglish && isBigBudget && isAction && budget > 150_000_000) formats.push('4DX');

            const movieData = {
              tmdbId: details.id,
              title: details.title,
              originalTitle: details.original_title !== details.title ? details.original_title : undefined,
              slug: generateSlug(details.title, details.id),
              genres,
              language: languageName(details.original_language),
              originalLanguage: details.original_language,
              rating: details.vote_average > 0 ? Math.round(details.vote_average * 10) / 10 : null,
              voteCount: details.vote_count,
              popularity: details.popularity || 0,
              revenue: details.revenue || 0,
              budget,
              duration: details.runtime,
              poster: tmdbImageUrl.poster(details.poster_path),
              backdrop: tmdbImageUrl.backdrop(details.backdrop_path),
              description: details.overview || 'No description available.',
              cast: extractCast(details),
              director: extractDirector(details),
              trailerUrl: extractTrailer(details),
              releaseDate: details.release_date ? new Date(details.release_date) : null,
              certificate: extractCertification(details),
              formats,
              status: 'now_showing' as const,
              isActive: true,
              lastSyncedAt: new Date(),
            };

            const result = await Movie.findOneAndUpdate(
              { tmdbId: details.id },
              { $set: movieData },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            allTmdbIds.add(details.id);

            const isNew = Math.abs(result.createdAt.getTime() - movieData.lastSyncedAt.getTime()) < 5000;
            if (isNew && result.createdAt.getTime() === result.updatedAt.getTime()) {
              moviesAdded++;
            } else {
              moviesUpdated++;
            }
          } catch (detailError) {
            logger.warn(`Failed to fetch details for TMDB ID ${movie.id}: ${detailError}`);
          }
        })
      );
      logger.info(`📄 Upserted batch ${Math.ceil((i + CONCURRENCY) / CONCURRENCY)} / ${Math.ceil(allMovieResults.length / CONCURRENCY)} (${allTmdbIds.size} done)`);
    }

    // Step 4: DELETE movies no longer in "Now Playing" — keeps DB lean
    const moviesToRemove = await Movie.find(
      { tmdbId: { $nin: Array.from(allTmdbIds) }, status: 'now_showing' },
      { tmdbId: 1 }
    ).lean();
    const removedTmdbIds = moviesToRemove.map(m => m.tmdbId);

    if (removedTmdbIds.length > 0) {
      // Delete their showtimes from Postgres first (referential cleanup)
      const deletedShowtimes = await prisma.showtime.deleteMany({
        where: {
          movieTmdbId: { in: removedTmdbIds },
          // Only delete showtimes with no confirmed/pending bookings
          bookings: { none: { status: { in: ['CONFIRMED', 'PENDING'] } } },
        },
      });
      logger.info(`🗑️ Deleted ${deletedShowtimes.count} orphan showtimes for removed movies`);

      // Now delete the movies from MongoDB
      const deleteResult = await Movie.deleteMany({
        tmdbId: { $in: removedTmdbIds },
        status: 'now_showing',
      });
      moviesEnded = deleteResult.deletedCount;
      logger.info(`🗑️ Deleted ${moviesEnded} movies no longer in theatres`);
    }

    // Step 5: Invalidate all movie-related Redis caches
    await invalidateMovieCaches();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalMovies = await Movie.countDocuments({ status: 'now_showing' });

    const status: SyncStatus = {
      lastSyncAt: new Date().toISOString(),
      duration: `${duration}s`,
      moviesAdded,
      moviesUpdated,
      moviesEnded,
      totalMovies,
      status: 'completed',
    };

    await setSyncStatus(status);

    logger.info(`✅ Sync complete in ${duration}s: +${moviesAdded} added, ~${moviesUpdated} updated, -${moviesEnded} ended. Total now_showing: ${totalMovies}`);

    // Trigger RAG Service Rebuild (Fire-and-forget)
    triggerRagRebuild();

    // Trigger showtime catch-up in background to refresh stale showtimes
    triggerShowtimeCatchUp().catch(err =>
      logger.error('Post-sync showtime catch-up failed:', err)
    );

    return status;
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('0 movies')
    ) {
      logger.warn('⚠️ TMDB blocked or timed out. Falling back to mock data...');
      
      // Load 20 real movies from JSON file
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const mockMovies = require('../data/mock-movies.json') as Array<Record<string, unknown>>;

      // Convert paths → full URLs and releaseDate strings → Date objects
      type MockMovie = Record<string, unknown> & { tmdbId: number };
      const processedMocks: MockMovie[] = (mockMovies.map(m => ({
        ...m,
        // Convert TMDB poster/backdrop paths to full URLs (same as live sync)
        poster: m.poster ? tmdbImageUrl.poster(m.poster as string) : null,
        backdrop: m.backdrop ? tmdbImageUrl.backdrop(m.backdrop as string) : null,
        releaseDate: m.releaseDate ? new Date(m.releaseDate as string) : null,
        lastSyncedAt: new Date(),
      }))) as any as MockMovie[];

      const mockTmdbIds = new Set(processedMocks.map(m => m.tmdbId));

      let added = 0;
      let updated = 0;
      for (const m of processedMocks) {
        const result = await Movie.findOneAndUpdate(
          { tmdbId: m.tmdbId },
          { $set: m },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          added++;
        } else {
          updated++;
        }
      }

      // DELETE movies no longer in our mock set (keeps DB lean, same as live sync)
      const moviesToRemoveMock = await Movie.find(
        { tmdbId: { $nin: Array.from(mockTmdbIds) }, status: 'now_showing' },
        { tmdbId: 1 }
      ).lean();
      const removedMockTmdbIds = moviesToRemoveMock.map(m => m.tmdbId);

      if (removedMockTmdbIds.length > 0) {
        await prisma.showtime.deleteMany({
          where: {
            movieTmdbId: { in: removedMockTmdbIds },
            bookings: { none: { status: { in: ['CONFIRMED', 'PENDING'] } } },
          },
        });
        await Movie.deleteMany({ tmdbId: { $in: removedMockTmdbIds } });
      }
      const endedMockResult = { modifiedCount: removedMockTmdbIds.length };

      await invalidateMovieCaches();
      const totalMoviesMock = await Movie.countDocuments({ status: 'now_showing' });
      const successStatus: SyncStatus = {
        lastSyncAt: new Date().toISOString(),
        duration: duration + 's',
        moviesAdded: added,
        moviesUpdated: updated,
        moviesEnded: endedMockResult.modifiedCount,
        totalMovies: totalMoviesMock,
        status: 'completed',
      };
      await setSyncStatus(successStatus);
      logger.info(`✅ Mock sync complete: +${added} added, ~${updated} updated, -${endedMockResult.modifiedCount} ended. Total now_showing: ${totalMoviesMock}`);
      
      // Trigger RAG Service Rebuild (Fire-and-forget)
      triggerRagRebuild();

      // Trigger showtime catch-up in background to refresh stale showtimes
      triggerShowtimeCatchUp().catch(err =>
        logger.error('Post-mock-sync showtime catch-up failed:', err)
      );
      
      return successStatus;
    }

    const status: SyncStatus = {
      lastSyncAt: new Date().toISOString(),
      duration: `${duration}s`,
      moviesAdded,
      moviesUpdated,
      moviesEnded,
      totalMovies: 0,
      status: 'failed',
      error: errorMessage,
    };

    await setSyncStatus(status);
    logger.error(`❌ Sync failed after ${duration}s: ${errorMessage}`);

    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Redis Cache Invalidation
// Uses SCAN instead of KEYS to avoid blocking the Redis event loop (H3 fix)
// ═══════════════════════════════════════════════════════════════════════════
async function invalidateMovieCaches(): Promise<void> {
  const patterns = [
    'bys:movies:list:*',
    'bys:movies:now-showing:*',
    'bys:movies:detail:*',
    'bys:movies:genres',
    // Also clear showtime caches — they embed movie titles and must refresh when movies change
    'bys:showtimes:list:*',
    'bys:showtimes:detail:*',
  ];
  let deleted = 0;

  for (const pattern of patterns) {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');
  }

  if (deleted > 0) {
    logger.info(`🗑️ Invalidated ${deleted} movie + showtime cache keys`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Trigger RAG Index Rebuild
// ═══════════════════════════════════════════════════════════════════════════
function triggerRagRebuild(): void {
  fetch('http://localhost:8001/index/rebuild', { method: 'POST' })
    .then(res => {
      if (res.ok) {
        logger.info('🧠 Triggered RAG Service Index Rebuild');
      } else {
        logger.warn(`⚠️ RAG Service Rebuild trigger returned status ${res.status}`);
      }
    })
    .catch(err => {
      logger.warn(`⚠️ Could not trigger RAG Service rebuild (is it running?): ${err.message}`);
    });
}

