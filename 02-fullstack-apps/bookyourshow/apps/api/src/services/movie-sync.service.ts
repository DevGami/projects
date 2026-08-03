import slugify from 'slugify';
import { Movie } from '../models/mongo/Movie.js';
import { redis } from '../config/redis.js';
import { logger } from '../middleware/logger.js';
import {
  getNowPlaying,
  getMovieDetails,
  getGenreMap,
  extractCast,
  extractDirector,
  extractTrailer,
  extractCertification,
  languageName,
  tmdbImageUrl,
} from './tmdb.client.js';

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

    logger.info('🎬 Starting TMDB movie sync...');

    // Step 1: Fetch genre map
    const genreMap = await getGenreMap();
    logger.info(`📚 Loaded ${genreMap.size} genres`);

    // Step 2: Fetch all pages of "Now Playing" for India
    const allTmdbIds: Set<number> = new Set();
    let page = 1;
    let totalPages = 1;

    do {
      const data = await getNowPlaying(page);
      totalPages = 1; // Only fetch exactly the top 20 (page 1)

      for (const movie of data.results) {
        allTmdbIds.add(movie.id);

        // Step 3: Fetch details for each movie
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
          const isBigBudget = budget > 80_000_000; // $80M+

          // IMAX: big-budget English action/sci-fi/adventure
          if (isEnglish && isAction && isBigBudget) {
            formats.push('IMAX');
          }

          // 3D: animated movies, big-budget fantasy/sci-fi
          if (isAnimated || (isEnglish && isFantasy && isBigBudget)) {
            formats.push('3D');
          }

          // 4DX: only the biggest blockbusters
          if (isEnglish && isBigBudget && isAction && budget > 150_000_000) {
            formats.push('4DX');
          }

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

          // Upsert: create if new, update if existing
          const result = await Movie.findOneAndUpdate(
            { tmdbId: details.id },
            { $set: movieData },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

          // Check if this was an insert or update
          if (result.createdAt.getTime() === result.updatedAt.getTime()) {
            moviesAdded++;
          } else {
            moviesUpdated++;
          }
        } catch (detailError) {
          logger.warn(`Failed to fetch details for TMDB ID ${movie.id}: ${detailError}`);
          // Continue with other movies even if one fails
        }
      }

      logger.info(`📄 Processed page ${page}/${totalPages} (${data.results.length} movies)`);
      page++;
    } while (page <= totalPages);

    // Step 4: Mark movies no longer in "Now Playing" as ended
    const endedResult = await Movie.updateMany(
      {
        tmdbId: { $nin: Array.from(allTmdbIds) },
        status: 'now_showing',
      },
      {
        $set: { status: 'ended', lastSyncedAt: new Date() },
      }
    );
    moviesEnded = endedResult.modifiedCount;

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

    return status;
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const errorMessage = error instanceof Error ? error.message : String(error);

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
// ═══════════════════════════════════════════════════════════════════════════
async function invalidateMovieCaches(): Promise<void> {
  const patterns = ['bys:movies:list:*', 'bys:movies:now-showing:*', 'bys:movies:detail:*', 'bys:movies:genres'];
  let deleted = 0;

  for (const pattern of patterns) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  }

  if (deleted > 0) {
    logger.info(`🗑️ Invalidated ${deleted} movie cache keys`);
  }
}
