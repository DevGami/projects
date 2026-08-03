// ═══════════════════════════════════════════════════════════════════════════
// BookYourShow — Constants
// ═══════════════════════════════════════════════════════════════════════════

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// ── TMDB Image URLs ─────────────────────────────────────────────────────────
export const TMDB_IMAGE = {
  poster: (path: string | null) =>
    path ? `https://image.tmdb.org/t/p/w500${path}` : '/poster-placeholder.svg',
  posterSmall: (path: string | null) =>
    path ? `https://image.tmdb.org/t/p/w342${path}` : '/poster-placeholder.svg',
  backdrop: (path: string | null) =>
    path ? `https://image.tmdb.org/t/p/w1280${path}` : '/backdrop-placeholder.svg',
  backdropOriginal: (path: string | null) =>
    path ? `https://image.tmdb.org/t/p/original${path}` : '/backdrop-placeholder.svg',
  profile: (path: string | null) =>
    path ? `https://image.tmdb.org/t/p/w185${path}` : '/avatar-placeholder.svg',
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

// ── Seat Colors ─────────────────────────────────────────────────────────────
export const SEAT_STATUS_COLORS = {
  available: 'bg-emerald-600/80 hover:bg-emerald-500 cursor-pointer',
  selected: 'bg-cyan-500 ring-2 ring-cyan-300 cursor-pointer',
  booked: 'bg-slate-700 cursor-not-allowed opacity-50',
  held: 'bg-amber-600/70 cursor-not-allowed opacity-60',
} as const;

// ── Tier Colors ─────────────────────────────────────────────────────────────
export const TIER_COLORS: Record<string, string> = {
  Silver: 'text-slate-300',
  Gold: 'text-amber-400',
  Platinum: 'text-fuchsia-400',
  VIP: 'text-purple-400',
};

// ── Tier Selected Colors ────────────────────────────────────────────────────
export const TIER_SELECTED_STYLES: Record<string, string> = {
  Silver: 'bg-slate-300 border-slate-300 text-slate-900 ring-2 ring-slate-400/50 ring-offset-1 ring-offset-surface-900',
  Gold: 'bg-amber-400 border-amber-400 text-amber-900 ring-2 ring-amber-400/50 ring-offset-1 ring-offset-surface-900',
  Platinum: 'bg-fuchsia-400 border-fuchsia-400 text-fuchsia-900 ring-2 ring-fuchsia-400/50 ring-offset-1 ring-offset-surface-900',
  VIP: 'bg-purple-400 border-purple-400 text-purple-900 ring-2 ring-purple-400/50 ring-offset-1 ring-offset-surface-900',
};

// ── Booking Status Badges ───────────────────────────────────────────────────
export const BOOKING_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  CONFIRMED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
  EXPIRED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

// ── Razorpay ────────────────────────────────────────────────────────────────
export const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
