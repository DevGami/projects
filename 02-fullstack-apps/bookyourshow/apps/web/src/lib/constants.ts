// ═══════════════════════════════════════════════════════════════════════════
// BookYourShow — Constants
// ═══════════════════════════════════════════════════════════════════════════

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// ── TMDB Image URLs ─────────────────────────────────────────────────────────
// The DB stores full URLs (https://image.tmdb.org/t/p/<size><path>).
// These helpers accept either a bare path (/abc.jpg) or a full TMDB URL
// and always return a URL with the correct size prefix.
// This makes them idempotent — safe to call on already-processed values.
const TMDB_BASE = 'https://image.tmdb.org/t/p/';

function tmdbPath(urlOrPath: string | null | undefined): { isLocal: boolean; path: string | null } {
  if (!urlOrPath) return { isLocal: false, path: null };
  if (urlOrPath.startsWith('/posters/') || urlOrPath.startsWith('/backdrop') || urlOrPath.startsWith('/avatar')) {
    return { isLocal: true, path: urlOrPath };
  }
  if (urlOrPath.startsWith(TMDB_BASE)) {
    const withoutBase = urlOrPath.slice(TMDB_BASE.length);
    const slashIdx = withoutBase.indexOf('/');
    return { isLocal: false, path: slashIdx >= 0 ? withoutBase.slice(slashIdx) : null };
  }
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    return { isLocal: true, path: urlOrPath };
  }
  return { isLocal: false, path: urlOrPath };
}

export const TMDB_IMAGE = {
  poster: (path: string | null | undefined) => {
    const res = tmdbPath(path);
    if (!res.path) return '/poster-placeholder.svg';
    if (res.isLocal) return res.path;
    return `${TMDB_BASE}w500${res.path}`;
  },
  posterSmall: (path: string | null | undefined) => {
    const res = tmdbPath(path);
    if (!res.path) return '/poster-placeholder.svg';
    if (res.isLocal) return res.path;
    return `${TMDB_BASE}w342${res.path}`;
  },
  backdrop: (path: string | null | undefined) => {
    const res = tmdbPath(path);
    if (!res.path) return '/backdrop-placeholder.svg';
    if (res.isLocal) return res.path;
    return `${TMDB_BASE}w1280${res.path}`;
  },
  backdropOriginal: (path: string | null | undefined) => {
    const res = tmdbPath(path);
    if (!res.path) return '/backdrop-placeholder.svg';
    if (res.isLocal) return res.path;
    return `${TMDB_BASE}original${res.path}`;
  },
  profile: (path: string | null | undefined) => {
    const res = tmdbPath(path);
    if (!res.path) return '/avatar-placeholder.svg';
    if (res.isLocal) return res.path;
    return `${TMDB_BASE}w185${res.path}`;
  },
};


// ── Cities ──────────────────────────────────────────────────────────────────
export const CITIES = [
  'Ahmedabad',
  'Mumbai',
  'Delhi',
  'Bangalore',
  'Chennai',
  'Hyderabad',
  'Kolkata',
  'Pune',
] as const;

export type City = (typeof CITIES)[number];

export const DEFAULT_CITY: City = 'Ahmedabad';

// ── Tier Colors (label text — ascending premiumness) ────────────────────────
export const TIER_COLORS: Record<string, string> = {
  Classic:      'text-slate-400',
  Prime:        'text-emerald-400',
  'Prime Plus': 'text-amber-400',
  Recliner:     'text-rose-400',
  // Legacy fallbacks
  Silver:       'text-slate-400',
  Gold:         'text-amber-400',
  Platinum:     'text-fuchsia-400',
  VIP:          'text-purple-400',
};

// ── Tier Accent Colors (for borders of available seats) ─────────────────────
export const TIER_BORDER_COLORS: Record<string, string> = {
  Classic:      'border-slate-500/40',
  Prime:        'border-emerald-500/40',
  'Prime Plus': 'border-amber-500/40',
  Recliner:     'border-rose-500/40',
};

// ── Tier Selected Styles (solid fill when user selects a seat) ──────────────
export const TIER_SELECTED_STYLES: Record<string, string> = {
  Classic:      'bg-slate-400 border-slate-400 text-slate-900 shadow-md shadow-slate-400/30',
  Prime:        'bg-emerald-400 border-emerald-400 text-emerald-950 shadow-md shadow-emerald-400/30',
  'Prime Plus': 'bg-amber-400 border-amber-400 text-amber-950 shadow-md shadow-amber-400/30',
  Recliner:     'bg-rose-400 border-rose-400 text-rose-950 shadow-md shadow-rose-400/30',
  // Legacy fallbacks
  Silver:       'bg-slate-300 border-slate-300 text-slate-900',
  Gold:         'bg-amber-400 border-amber-400 text-amber-900',
  Platinum:     'bg-fuchsia-400 border-fuchsia-400 text-fuchsia-900',
  VIP:          'bg-purple-400 border-purple-400 text-purple-900',
};

// ── Tier Hover Styles (subtle glow on hover for available seats) ────────────
export const TIER_HOVER_STYLES: Record<string, string> = {
  Classic:      'hover:border-slate-400/70 hover:bg-slate-500/10',
  Prime:        'hover:border-emerald-400/70 hover:bg-emerald-500/10',
  'Prime Plus': 'hover:border-amber-400/70 hover:bg-amber-500/10',
  Recliner:     'hover:border-rose-400/70 hover:bg-rose-500/10',
};

// ── Tier Legend Dot Colors ──────────────────────────────────────────────────
export const TIER_DOT_COLORS: Record<string, string> = {
  Classic:      'bg-slate-400',
  Prime:        'bg-emerald-400',
  'Prime Plus': 'bg-amber-400',
  Recliner:     'bg-rose-400',
};

// ── Tier ordering (for proper display order) ────────────────────────────────
export const TIER_ORDER = ['Classic', 'Prime', 'Prime Plus', 'Recliner'];

// ── Booking Status Badges ───────────────────────────────────────────────────
export const BOOKING_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  CONFIRMED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
  EXPIRED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

// ── Razorpay ────────────────────────────────────────────────────────────────
export const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
