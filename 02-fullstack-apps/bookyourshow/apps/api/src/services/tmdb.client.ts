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
 * Fetch ALL movies currently playing in Indian theatres using a multi-source
 * strategy. TMDB's now_playing?region=IN misses many Indian films that aren't
 * properly tagged with an IN theatrical release. We combine four sources:
 *
 *  1. now_playing (no region) — global theatrical releases
 *  2. now_playing?region=IN   — officially tagged India releases
 *  3. discover/movie?region=IN — theatrical releases in India last 90 days
 *  4. discover/movie (Indian languages) — hi/ta/te/ml recent theatrical releases
 *
 * All results are deduplicated by TMDB ID.
 */
export async function fetchAllNowPlayingIndia(): Promise<TmdbMovieListResult[]> {
  const seenIds = new Set<number>();
  const combined: TmdbMovieListResult[] = [];

  function addResults(results: TmdbMovieListResult[]) {
    for (const m of results) {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
        combined.push(m);
      }
    }
  }

  // ── Early-abort detector ─────────────────────────────────────────────────
  // If the first two sources both fail (TMDB blocked), abort immediately
  // instead of waiting 12s × remaining sources. This keeps startup sync fast.
  let consecutiveSourceFailures = 0;
  const MAX_SOURCE_FAILURES = 2; // after 2 source-level failures, assume TMDB is blocked

  // ── Source 1: now_playing global (no region filter) ──────────────────────
  // This is the most reliable source — it returns all movies in cinemas worldwide
  // including Indian films that don't have a proper IN region tag.
  try {
    for (let page = 1; page <= 3; page++) {
      const data = await getNowPlaying(page, '', 'en');
      addResults(data.results);
      if (data.total_pages <= page) break;
    }
    consecutiveSourceFailures = 0; // reset on success
    logger.debug(`Source 1 (global now_playing): ${combined.length} unique so far`);
  } catch (err) {
    consecutiveSourceFailures++;
    logger.warn(`⚠️ Source 1 (global now_playing) failed: ${err}`);
  }

  // ── Source 2: now_playing?region=IN ──────────────────────────────────────
  // Official India theatrical list — usually Hollywood + big Bollywood releases
  if (consecutiveSourceFailures < MAX_SOURCE_FAILURES) {
    try {
      for (let page = 1; page <= 3; page++) {
        const data = await getNowPlaying(page, 'IN', 'en');
        addResults(data.results);
        if (data.total_pages <= page) break;
      }
      consecutiveSourceFailures = 0;
      logger.debug(`Source 2 (now_playing IN): ${combined.length} unique so far`);
    } catch (err) {
      consecutiveSourceFailures++;
      logger.warn(`⚠️ Source 2 (now_playing IN) failed: ${err}`);
    }
  } else {
    logger.warn('⚡ TMDB appears blocked — skipping remaining sources to fall back quickly');
  }

  // ── Source 3: discover/movie — India theatrical, last 90 days ─────────────
  // Finds all movies with a theatrical release in India in the past 90 days.
  // with_release_type=3 = Theatrical release
  if (consecutiveSourceFailures < MAX_SOURCE_FAILURES) {
    try {
      const today = new Date();
      const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
      const fmt = (d: Date) => d.toISOString().split('T')[0];

      for (let page = 1; page <= 5; page++) {
        const url = buildUrl('/discover/movie', {
          region: 'IN',
          with_release_type: '3|2',  // 3=Theatrical, 2=Limited Theatrical
          'release_date.gte': fmt(ninetyDaysAgo),
          'release_date.lte': fmt(today),
          sort_by: 'popularity.desc',
          page: String(page),
          language: 'en',
        });
        const res = await rateLimitedFetch(url);
        if (!res.ok) break;
        const data = await res.json() as TmdbNowPlayingResponse;
        addResults(data.results);
        if (data.total_pages <= page) break;
      }
      consecutiveSourceFailures = 0;
      logger.debug(`Source 3 (discover IN theatrical): ${combined.length} unique so far`);
    } catch (err) {
      consecutiveSourceFailures++;
      logger.warn(`⚠️ Source 3 (discover IN) failed: ${err}`);
    }
  }

  // ── Source 4: discover/movie — Indian language films, last 90 days ────────
  // Specifically targets Hindi, Tamil, Telugu, Malayalam, Punjabi, Kannada films
  // regardless of region tagging — catches films the other sources miss.
  const indianLanguages = ['hi', 'ta', 'te', 'ml', 'pa', 'kn', 'mr'];
  if (consecutiveSourceFailures < MAX_SOURCE_FAILURES) {
    try {
      const today = new Date();
      const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
      const fmt = (d: Date) => d.toISOString().split('T')[0];

      for (let page = 1; page <= 3; page++) {
        const url = buildUrl('/discover/movie', {
          with_original_language: indianLanguages.join('|'),
          with_release_type: '3|2',
          'release_date.gte': fmt(ninetyDaysAgo),
          'release_date.lte': fmt(today),
          sort_by: 'popularity.desc',
          page: String(page),
          language: 'en',
        });
        const res = await rateLimitedFetch(url);
        if (!res.ok) break;
        const data = await res.json() as TmdbNowPlayingResponse;
        addResults(data.results);
        if (data.total_pages <= page) break;
      }
      consecutiveSourceFailures = 0;
      logger.debug(`Source 4 (discover Indian languages): ${combined.length} unique so far`);
    } catch (err) {
      consecutiveSourceFailures++;
      logger.warn(`⚠️ Source 4 (discover Indian languages) failed: ${err}`);
    }
  }

  logger.info(`🎬 fetchAllNowPlayingIndia: ${combined.length} unique movies across all sources`);
  return combined;
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
