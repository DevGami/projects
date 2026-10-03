import { env } from '../config/env.js';
import { logger } from '../middleware/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// TMDB Configuration
// ═══════════════════════════════════════════════════════════════════════════
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

// ── Rate Limiter (40 requests per 10 seconds) ──────────────────────────────
let requestCount = 0;
let windowStart = Date.now();
const MAX_REQUESTS = 38; // slightly under 40 for safety
const WINDOW_MS = 10_000;

const TMDB_FETCH_TIMEOUT_MS = 12_000; // 12s — fast fail if TMDB is blocked, enough for slow but working connections

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

// ═══════════════════════════════════════════════════════════════════════════
// TMDB API Types
// ═══════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════
// TMDB Client Functions
// ═══════════════════════════════════════════════════════════════════════════
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
 * Fetch exactly the movies that TMDB shows under "What's Popular → In Theaters".
 *
 * Strategy (mirrors TMDB's own "In Theaters" tab logic):
 *   1. Get the active theatrical date window from /movie/now_playing (TMDB returns
 *      `dates.minimum` and `dates.maximum` — the window of what counts as "in theaters").
 *   2. Fetch the top popular movies from /movie/popular (globally, sorted by popularity desc).
 *   3. Keep only movies whose release_date falls within that theatrical window.
 *   4. Return up to 20 — exactly what TMDB's "In Theaters" tab shows.
 */
export async function fetchAllNowPlayingIndia(): Promise<TmdbMovieListResult[]> {
  // ── Step 1: Get the theatrical date window from now_playing ───────────────
  let minDate = '';
  let maxDate = '';
  try {
    const windowData = await getNowPlaying(1, '', 'en');
    minDate = windowData.dates?.minimum ?? '';
    maxDate = windowData.dates?.maximum ?? '';
    logger.debug(`Theatrical window: ${minDate} to ${maxDate}`);
  } catch (err) {
    logger.warn(`Could not fetch TMDB theatrical window: ${err}. Using 60-day fallback.`);
    const today = new Date();
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
    minDate = sixtyDaysAgo.toISOString().split('T')[0];
    maxDate = today.toISOString().split('T')[0];
  }

  // ── Step 2: Fetch popular movies (sorted by popularity desc) ─────────────
  // Fetch 3 pages (60 results) to ensure enough candidates after date filtering.
  const seenIds = new Set<number>();
  const popular: TmdbMovieListResult[] = [];

  for (let page = 1; page <= 3; page++) {
    try {
      const url = buildUrl('/movie/popular', { page: String(page), language: 'en' });
      const res = await rateLimitedFetch(url);
      if (!res.ok) { logger.warn(`/movie/popular page ${page} returned ${res.status}`); break; }
      const data = await res.json() as TmdbNowPlayingResponse;
      for (const m of data.results) {
        if (!seenIds.has(m.id)) { seenIds.add(m.id); popular.push(m); }
      }
      if (data.total_pages <= page) break;
    } catch (err) {
      logger.warn(`/movie/popular page ${page} failed: ${err}`);
      break;
    }
  }

  // ── Step 3: Filter to only movies within the theatrical window ────────────
  const inTheaters = popular.filter(m => {
    if (!m.release_date) return false;
    return m.release_date >= minDate && m.release_date <= maxDate;
  });

  logger.debug(`${inTheaters.length} of ${popular.length} popular movies are within the theatrical window`);

  // ── Step 4: Fallback if filtering yields too few results ──────────────────
  // Edge case: popular list and now_playing window don't overlap well.
  if (inTheaters.length <= 5) {
    logger.warn(`Only ${inTheaters.length} filtered results — falling back to now_playing directly`);
    try {
      const p1 = await getNowPlaying(1, '', 'en');
      const fallback = [...p1.results];
      try { const p2 = await getNowPlaying(2, '', 'en'); fallback.push(...p2.results); } catch { /* ignore */ }
      for (const m of fallback) {
        if (!seenIds.has(m.id)) { seenIds.add(m.id); inTheaters.push(m); }
      }
    } catch (err) {
      logger.warn(`Fallback now_playing also failed: ${err}`);
    }
  }

  // Sort by popularity desc (already ordered, but re-sort after potential merge)
  inTheaters.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  logger.info(`fetchAllNowPlayingIndia: returning ${inTheaters.length} in-theater movies (TMDB "What's Popular In Theaters" logic)`);
  return inTheaters;
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

// ═══════════════════════════════════════════════════════════════════════════
// Helper Extractors (used by sync service)
// ═══════════════════════════════════════════════════════════════════════════

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
      photo: c.profile_path || null,  // store path only — frontend adds base URL via TMDB_IMAGE.profile()
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
