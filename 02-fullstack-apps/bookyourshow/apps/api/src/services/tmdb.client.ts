import { env } from '../config/env.js';
import { logger } from '../middleware/logger.js';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TMDB Configuration
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const tmdbImageUrl = {
  poster: (path: string | null, size = 'w500') => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/posters/')) return path;
    return `${TMDB_IMAGE_BASE}/${size}${path}`;
  },
  backdrop: (path: string | null, size = 'w1280') => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/posters/')) return path;
    return `${TMDB_IMAGE_BASE}/${size}${path}`;
  },
  profile: (path: string | null, size = 'w185') => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/posters/')) return path;
    return `${TMDB_IMAGE_BASE}/${size}${path}`;
  },
};

// â”€â”€ Rate Limiter (40 requests per 10 seconds) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let requestCount = 0;
let windowStart = Date.now();
const MAX_REQUESTS = 38; // slightly under 40 for safety
const WINDOW_MS = 10_000;

const TMDB_FETCH_TIMEOUT_MS = 12_000; // 12s â€” fast fail if TMDB is blocked, enough for slow but working connections

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    requestCount = 0;
    windowStart = now;
  }

  if (requestCount >= MAX_REQUESTS) {
    const waitTime = WINDOW_MS - (now - windowStart) + 100;
    logger.debug(`TMDB rate limit: waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    requestCount = 0;
    windowStart = Date.now();
  }

  requestCount++;

  // Abort after 10s to prevent hanging syncs
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TMDB_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('retry-after') || '2') * 1000;
    logger.warn(`TMDB 429 rate limited, retrying after ${retryAfter}ms`);
    await new Promise(resolve => setTimeout(resolve, retryAfter));
    requestCount = 0;
    windowStart = Date.now();

    const retryController = new AbortController();
    const retryTimeout = setTimeout(() => retryController.abort(), TMDB_FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, { signal: retryController.signal });
    } finally {
      clearTimeout(retryTimeout);
    }
  }

  return response;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TMDB API Types
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
interface TmdbMovieListResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids: number[];
  original_language: string;
  vote_average: number;
  vote_count: number;
  release_date: string;
  popularity: number;
}

interface TmdbNowPlayingResponse {
  page: number;
  results: TmdbMovieListResult[];
  total_pages: number;
  total_results: number;
  dates: { maximum: string; minimum: string };
}

interface TmdbCastMember {
  name: string;
  character: string;
  profile_path: string | null;
  known_for_department: string;
  order: number;
}

interface TmdbCrewMember {
  name: string;
  job: string;
  department: string;
}

interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official: boolean;
}

interface TmdbReleaseDateEntry {
  iso_3166_1: string;
  release_dates: Array<{ certification: string; type: number }>;
}

interface TmdbMovieDetailsResponse {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: Array<{ id: number; name: string }>;
  original_language: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  budget: number;
  revenue: number;
  release_date: string;
  runtime: number | null;
  credits: {
    cast: TmdbCastMember[];
    crew: TmdbCrewMember[];
  };
  videos: {
    results: TmdbVideo[];
  };
  release_dates: {
    results: TmdbReleaseDateEntry[];
  };
}

interface TmdbGenre {
  id: number;
  name: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TMDB Client Functions
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function buildUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(`${env.TMDB_BASE_URL}${path}`);
  url.searchParams.set('api_key', env.TMDB_API_KEY || '');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Fetch "Now Playing" movies. Pass empty string for region to get global results.
 */
export async function getNowPlaying(
  page = 1,
  region = 'IN',
  language = 'en'
): Promise<TmdbNowPlayingResponse> {
  const params: Record<string, string> = { page: String(page), language };
  if (region) params.region = region; // omit for global results

  const url = buildUrl('/movie/now_playing', params);

  const res = await rateLimitedFetch(url);
  if (!res.ok) {
    throw new Error(`TMDB /movie/now_playing failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<TmdbNowPlayingResponse>;
}


/**
 * Fetch exactly the movies TMDB shows under "What's Popular -> In Theaters" for India.
 * Uses /movie/now_playing?region=IN — the only endpoint that returns a perfect 20/20 match.
 * Fetches all pages, deduplicates, sorts by popularity desc.
 */
export async function fetchAllNowPlayingIndia(): Promise<TmdbMovieListResult[]> {
  const seenIds = new Set<number>();
  const nowPlaying: TmdbMovieListResult[] = [];

  // Fetch up to 5 pages of now_playing — TMDB's authoritative "in theaters" list
  for (let page = 1; page <= 5; page++) {
    try {
      const data = await getNowPlaying(page, 'IN', 'en');
      for (const m of data.results) {
        if (!seenIds.has(m.id)) { seenIds.add(m.id); nowPlaying.push(m); }
      }
      if (data.total_pages <= page) break;
    } catch (err) {
      logger.warn(`/movie/now_playing page ${page} failed: ${err}`);
      if (page === 1) {
        // Page 1 fail means TMDB is blocked — throw to trigger mock fallback in sync service
        throw new Error(`fetch failed: TMDB now_playing page 1 failed: ${err}`);
      }
      break; // partial results are fine for pages > 1
    }
  }

  // Sort by popularity desc — matches TMDB's "Popular" ordering
  nowPlaying.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  logger.info(`fetchAllNowPlayingIndia: ${nowPlaying.length} now-playing movies, top 20 by popularity will be used`);
  return nowPlaying; // movie-sync.service.ts slices to top 20
}



/**
 * Fetch detailed movie info including credits, videos, and certification
 */
export async function getMovieDetails(tmdbId: number): Promise<TmdbMovieDetailsResponse> {
  const url = buildUrl(`/movie/${tmdbId}`, {
    append_to_response: 'credits,videos,release_dates',
    language: 'en-IN',
  });

  const res = await rateLimitedFetch(url);
  if (!res.ok) {
    throw new Error(`TMDB /movie/${tmdbId} failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<TmdbMovieDetailsResponse>;
}

/**
 * Fetch all movie genres from TMDB
 */
let cachedGenres: Map<number, string> | null = null;

export async function getGenreMap(): Promise<Map<number, string>> {
  if (cachedGenres) return cachedGenres;

  const url = buildUrl('/genre/movie/list', { language: 'en' });
  const res = await rateLimitedFetch(url);
  if (!res.ok) {
    throw new Error(`TMDB /genre/movie/list failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { genres: TmdbGenre[] };
  cachedGenres = new Map(data.genres.map(g => [g.id, g.name]));
  return cachedGenres;
}

/**
 * Clear the cached genre map (useful after sync)
 */
export function clearGenreCache(): void {
  cachedGenres = null;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Helper Extractors (used by sync service)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Extract top N cast members
 */
export function extractCast(details: TmdbMovieDetailsResponse, limit = 15) {
  return details.credits.cast
    .filter(c => c.known_for_department === 'Acting')
    .slice(0, limit)
    .map(c => ({
      name: c.name,
      character: c.character || undefined,
      photo: c.profile_path || null,  // store path only â€” frontend adds base URL via TMDB_IMAGE.profile()
    }));
}

/**
 * Extract director name
 */
export function extractDirector(details: TmdbMovieDetailsResponse): string | undefined {
  const director = details.credits.crew.find(c => c.job === 'Director');
  return director?.name;
}

/**
 * Extract YouTube trailer URL (prefer official trailers)
 */
export function extractTrailer(details: TmdbMovieDetailsResponse): string | undefined {
  const videos = details.videos.results.filter(v => v.site === 'YouTube');

  // Priority: official trailer > trailer > teaser
  const trailer =
    videos.find(v => v.type === 'Trailer' && v.official) ||
    videos.find(v => v.type === 'Trailer') ||
    videos.find(v => v.type === 'Teaser');

  return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined;
}

/**
 * Extract Indian certification (or fallback to US)
 */
export function extractCertification(details: TmdbMovieDetailsResponse): string | undefined {
  const releaseDates = details.release_dates.results;

  // Try India first
  const india = releaseDates.find(r => r.iso_3166_1 === 'IN');
  if (india?.release_dates[0]?.certification) {
    return india.release_dates[0].certification;
  }

  // Fallback to US
  const us = releaseDates.find(r => r.iso_3166_1 === 'US');
  if (us?.release_dates[0]?.certification) {
    return us.release_dates[0].certification;
  }

  return undefined;
}

/**
 * Map language code to readable name
 */
export function languageName(code: string): string {
  const map: Record<string, string> = {
    hi: 'Hindi',
    en: 'English',
    ta: 'Tamil',
    te: 'Telugu',
    ml: 'Malayalam',
    kn: 'Kannada',
    bn: 'Bengali',
    mr: 'Marathi',
    gu: 'Gujarati',
    pa: 'Punjabi',
    ko: 'Korean',
    ja: 'Japanese',
    zh: 'Chinese',
    fr: 'French',
    es: 'Spanish',
    de: 'German',
  };
  return map[code] || code.toUpperCase();
}
