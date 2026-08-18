import { prisma } from '../config/database.js';
import { logger } from '../middleware/logger.js';
import { redis } from '../config/redis.js';
import { Movie } from '../models/mongo/Movie.js';

// ═══════════════════════════════════════════════════════════════════════════
// Showtime Auto-Generator
// Generates realistic showtimes based on:
//   - Real movies from MongoDB (now_showing)
//   - Real theaters/screens from PostgreSQL
//   - Time-of-day pricing (morning cheaper, night expensive)
//   - Weekend density (more shows, more pre-booked seats)
//   - Movie format matching (IMAX movies → IMAX screens only)
// ═══════════════════════════════════════════════════════════════════════════

// ── Show time slots ─────────────────────────────────────────────────────
const WEEKDAY_SLOTS = [
  { time: '09:30 AM', priceMultiplier: 0.85 },  // Morning — cheapest
  { time: '12:45 PM', priceMultiplier: 1.00 },  // Afternoon — base
  { time: '04:00 PM', priceMultiplier: 1.00 },  // Afternoon — base
  { time: '07:15 PM', priceMultiplier: 1.15 },  // Evening — slightly more
  { time: '10:00 PM', priceMultiplier: 1.25 },  // Late night — most expensive
];

const WEEKEND_SLOTS = [
  { time: '09:00 AM', priceMultiplier: 0.90 },
  { time: '10:30 AM', priceMultiplier: 1.00 },
  { time: '12:30 PM', priceMultiplier: 1.10 },
  { time: '01:45 PM', priceMultiplier: 1.10 },
  { time: '03:30 PM', priceMultiplier: 1.10 },
  { time: '05:00 PM', priceMultiplier: 1.15 },
  { time: '07:00 PM', priceMultiplier: 1.25 },
  { time: '09:00 PM', priceMultiplier: 1.30 },
  { time: '10:30 PM', priceMultiplier: 1.35 },
];

// ── Pre-booking simulation ──────────────────────────────────────────────
// Returns an array of seat IDs that are "already booked" to simulate realism
function generatePreBookedSeats(
  _rows: number,
  cols: number,
  seatLayout: { tier: string; rows: number[]; price: number }[],
  isWeekend: boolean,
  isEvening: boolean,
): string[] {
  // Higher occupancy on weekends and evenings
  let occupancyRate: number;
  if (isWeekend && isEvening) {
    occupancyRate = 0.30 + Math.random() * 0.15; // 30-45%
  } else if (isWeekend) {
    occupancyRate = 0.20 + Math.random() * 0.15; // 20-35%
  } else if (isEvening) {
    occupancyRate = 0.15 + Math.random() * 0.10; // 15-25%
  } else {
    occupancyRate = 0.05 + Math.random() * 0.10; // 5-15%
  }

  const allSeats: string[] = [];
  for (const tier of seatLayout) {
    for (const rowIndex of tier.rows) {
      const rowLabel = String.fromCharCode(65 + rowIndex);
      // Recliner rows have fewer seats (10 instead of cols)
      const seatCount = tier.tier === 'Recliner' ? Math.min(cols, 10) : cols;
      for (let col = 1; col <= seatCount; col++) {
        allSeats.push(`${rowLabel}${col}`);
      }
    }
  }

  const numToBook = Math.floor(allSeats.length * occupancyRate);
  // Shuffle and pick
  const shuffled = allSeats.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, numToBook);
}

// ── Format detection for screen matching ────────────────────────────────
function getScreenFormat(screenName: string): string {
  const name = screenName.toLowerCase();
  if (name.includes('imax') || name.includes('macro')) return 'IMAX';
  if (name.includes('4dx')) return '4DX';
  if (name.includes('3d')) return '3D';
  return 'Standard';
}

function movieSupportsFormat(movieFormats: string[], screenFormat: string): boolean {
  if (screenFormat === 'Standard') return true; // All movies play on standard
  return movieFormats.includes(screenFormat);
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Generator
// ═══════════════════════════════════════════════════════════════════════════
export async function generateShowtimesForDates(dates: string[]): Promise<number> {
  let totalCreated = 0;

  // 1. Fetch all active screens with their theaters
  const screens = await prisma.screen.findMany({
    where: { isActive: true },
    include: { theater: true },
  });

  if (screens.length === 0) {
    logger.warn('No active screens found — cannot generate showtimes');
    return 0;
  }

  // 2. Fetch all now_showing movies from MongoDB
  const movies = await Movie.find({ status: 'now_showing', isActive: true })
    .sort({ popularity: -1 })
    .lean();

  if (movies.length === 0) {
    logger.warn('No active movies found — cannot generate showtimes');
    return 0;
  }

  logger.info(`🎬 Generating showtimes for ${dates.length} dates across ${screens.length} screens with ${movies.length} movies`);

  for (const dateStr of dates) {
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay(); // 0=Sun, 5=Fri, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
    const slots = isWeekend ? WEEKEND_SLOTS : WEEKDAY_SLOTS;

    // Assign movies to screens in a round-robin fashion
    // More popular movies get IMAX/premium screens
    let movieIndex = 0;

    for (const screen of screens) {
      const screenFormat = getScreenFormat(screen.name);
      const seatLayout = screen.seatLayout as { tier: string; rows: number[]; price: number }[];

      // Find movies compatible with this screen format
      const compatibleMovies = movies.filter(m =>
        movieSupportsFormat(m.formats || ['2D'], screenFormat)
      );

      if (compatibleMovies.length === 0) continue;

      // Pick a movie for this screen (rotate through compatible movies)
      const movie = compatibleMovies[movieIndex % compatibleMovies.length]!;
      movieIndex++;

      // On weekends, use all slots; on weekdays, use fewer slots for smaller theaters
      const screenSlots = isWeekend
        ? slots
        : screen.theater.totalScreens <= 2
          ? slots.slice(0, 4) // Smaller theaters: 4 shows on weekdays
          : slots;

      for (const slot of screenSlots) {
        const isEvening = slot.time.includes('PM') &&
          !slot.time.startsWith('12') &&
          parseInt(slot.time.split(':')[0]!) >= 5;

        const preBookedSeats = generatePreBookedSeats(
          screen.rows,
          screen.cols,
          seatLayout,
          isWeekend,
          isEvening,
        );

        try {
          await prisma.showtime.upsert({
            where: {
              screenId_showDate_showTime: {
                screenId: screen.id,
                showDate: dateObj,
                showTime: slot.time,
              },
            },
            create: {
              movieTmdbId: movie.tmdbId,
              movieTitle: movie.title,
              screenId: screen.id,
              showDate: dateObj,
              showTime: slot.time,
              priceMultiplier: slot.priceMultiplier,
              bookedSeats: preBookedSeats,
            },
            update: {
              movieTmdbId: movie.tmdbId,
              movieTitle: movie.title,
              priceMultiplier: slot.priceMultiplier,
            },
          });
          totalCreated++;
        } catch (err: any) {
          logger.warn(`Failed to upsert showtime: ${err.message}`);
        }
      }
    }

    logger.info(`📅 ${dateStr} (${isWeekend ? 'weekend' : 'weekday'}): generated showtimes`);
  }

  logger.info(`✅ Total showtimes created: ${totalCreated}`);

  // Invalidate showtime list caches so next request gets fresh data
  if (totalCreated > 0) {
    const keys = await redis.keys('bys:showtimes:list:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`🗑️ Invalidated ${keys.length} showtime cache keys`);
    }
  }

  return totalCreated;
}

// ═══════════════════════════════════════════════════════════════════════════
// Determine which dates should currently have showtimes
//
// Real cinema release schedule (IST):
//   Sunday 12PM    → Mon, Tue, Wed become bookable
//   Wednesday 6PM  → Thu, Fri become bookable
//   Friday 6PM     → Sat, Sun become bookable
//
// For our deployed app we always show the next 7 days from today so users
// can always browse and book. The cron controls WHEN new slots are generated
// (simulating real cinema booking windows opening), but catch-up on startup
// ensures the full window is always populated.
// ═══════════════════════════════════════════════════════════════════════════
export function getVisibleDates(): string[] {
  // Always compute in IST (UTC+5:30)
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowUTC = new Date();
  const nowIST = new Date(nowUTC.getTime() + IST_OFFSET_MS);

  const todayIST = new Date(nowIST);
  todayIST.setUTCHours(0, 0, 0, 0);

  const formatDate = (d: Date): string => {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Always include today + next 6 days = 7 days total visible window
  const dates: string[] = [];
  for (let offset = 0; offset <= 6; offset++) {
    const d = new Date(todayIST);
    d.setUTCDate(todayIST.getUTCDate() + offset);
    dates.push(formatDate(d));
  }

  return dates;
}

// ═══════════════════════════════════════════════════════════════════════════
// Catch-up: ensure showtimes for all visible dates use CURRENT movies
// Called on server startup — also cleans stale/wrong movie showtimes
// ═══════════════════════════════════════════════════════════════════════════
export async function catchUpShowtimes(): Promise<void> {
  const visibleDates = getVisibleDates();
  logger.info(`📅 Catch-up checking ${visibleDates.length} visible dates: ${visibleDates.join(', ')}`);

  // Get current valid movie tmdbIds from MongoDB
  const currentMovies = await Movie.find({ status: 'now_showing', isActive: true })
    .select('tmdbId')
    .lean();
  const validTmdbIds = new Set(currentMovies.map(m => m.tmdbId));

  if (validTmdbIds.size === 0) {
    logger.warn('⚠️ No active movies in MongoDB — skipping catch-up');
    return;
  }

  logger.info(`🎬 ${validTmdbIds.size} valid movies in MongoDB`);

  // For each visible date, check if it has valid showtimes
  const datesToRegenerate: string[] = [];

  for (const dateStr of visibleDates) {
    const dateObj = new Date(dateStr);

    // Count showtimes for this date
    const totalCount = await prisma.showtime.count({
      where: { showDate: dateObj, status: 'ACTIVE' },
    });

    if (totalCount === 0) {
      datesToRegenerate.push(dateStr);
      continue;
    }

    // Check if any showtimes reference movies NOT in our current list
    const staleCount = await prisma.showtime.count({
      where: {
        showDate: dateObj,
        status: 'ACTIVE',
        movieTmdbId: { notIn: Array.from(validTmdbIds) },
        // Only delete if not booked by anyone
        bookings: { none: {} },
      },
    });

    if (staleCount > 0) {
      logger.info(`🗑️ ${dateStr}: found ${staleCount} stale showtimes — cleaning & regenerating`);
      // Delete stale showtimes (unbooked only)
      await prisma.showtime.deleteMany({
        where: {
          showDate: dateObj,
          status: 'ACTIVE',
          movieTmdbId: { notIn: Array.from(validTmdbIds) },
          bookings: { none: {} },
        },
      });
      datesToRegenerate.push(dateStr);
    } else {
      logger.info(`✅ ${dateStr}: ${totalCount} valid showtimes — OK`);
    }
  }

  if (datesToRegenerate.length === 0) {
    logger.info('✅ All visible dates have valid showtimes for current movies');
    return;
  }

  logger.info(`🔄 Regenerating showtimes for ${datesToRegenerate.length} dates: ${datesToRegenerate.join(', ')}`);
  await generateShowtimesForDates(datesToRegenerate);
}

