import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { logger } from '../middleware/logger.js';
import { getUnavailableSeats } from '../services/seat-lock.service.js';
import { getVisibleDates } from '../services/showtime-generator.service.js';
import type { CreateShowtimeInput, ListShowtimesQuery } from '../schemas/showtime.schemas.js';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/showtimes — Create showtime (Admin)
// ═══════════════════════════════════════════════════════════════════════════
export async function createShowtime(req: Request, res: Response): Promise<void> {
  const data = req.body as CreateShowtimeInput;

  // Validate screen exists
  const screen = await prisma.screen.findUnique({
    where: { id: data.screenId },
    include: { theater: true },
  });

  if (!screen) {
    res.status(404).json({
      success: false,
      error: { code: 'SCREEN_NOT_FOUND', message: 'Screen not found' },
    });
    return;
  }

  // Check for duplicate showtime
  const existing = await prisma.showtime.findUnique({
    where: {
      screenId_showDate_showTime: {
        screenId: data.screenId,
        showDate: new Date(data.showDate),
        showTime: data.showTime,
      },
    },
  });

  if (existing) {
    res.status(409).json({
      success: false,
      error: {
        code: 'SHOWTIME_CONFLICT',
        message: `A showtime already exists for ${screen.name} on ${data.showDate} at ${data.showTime}`,
      },
    });
    return;
  }

  const showtime = await prisma.showtime.create({
    data: {
      movieTmdbId: data.movieTmdbId,
      movieTitle: data.movieTitle,
      screenId: data.screenId,
      showDate: new Date(data.showDate),
      showTime: data.showTime,
      priceMultiplier: data.priceMultiplier,
    },
    include: {
      screen: {
        include: { theater: true },
      },
    },
  });

  logger.info(`Showtime created: ${data.movieTitle} at ${screen.theater.name} - ${screen.name} on ${data.showDate} ${data.showTime}`);

  res.status(201).json({ success: true, data: showtime });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/showtimes — List showtimes (Public)
// Filters: movieTmdbId, city, date, screenId
// ═══════════════════════════════════════════════════════════════════════════
export async function listShowtimes(req: Request, res: Response): Promise<void> {
  const { movieTmdbId, city, date, screenId, page, limit } =
    ((req as any).validatedQuery || req.query) as ListShowtimesQuery;
  const skip = (page - 1) * limit;

  // ── Redis cache (90-second TTL for real-time accuracy) ─────────────────
  const cacheKey = `bys:showtimes:list:${movieTmdbId || 'all'}:${city || 'all'}:${date || 'all'}:${screenId || 'all'}:${page}:${limit}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    res.json(JSON.parse(cached));
    return;
  }

  const where: any = { status: 'ACTIVE' };

  if (movieTmdbId) where.movieTmdbId = movieTmdbId;
  if (screenId) where.screenId = screenId;
  const visibleDates = getVisibleDates();

  if (date) {
    if (!visibleDates.includes(date)) {
      // If asking for a date that isn't visible yet, return empty
      res.json({ success: true, data: { showtimes: [], pagination: { page, limit, total: 0, totalPages: 0 } } });
      return;
    }
    where.showDate = new Date(date);
  } else {
    // Only return showtimes for visible dates
    where.showDate = { in: visibleDates.map(d => new Date(d)) };
  }

  // City filter requires joining through screen → theater
  if (city) {
    where.screen = {
      theater: {
        city: { contains: city, mode: 'insensitive' },
        isActive: true,
      },
    };
  }

  const [showtimes, total] = await Promise.all([
    prisma.showtime.findMany({
      where,
      skip,
      take: limit,
      include: {
        screen: {
          include: {
            theater: {
              select: { id: true, name: true, city: true, address: true },
            },
          },
        },
      },
      orderBy: [{ showDate: 'asc' }, { showTime: 'asc' }],
    }),
    prisma.showtime.count({ where }),
  ]);

  // Filter out past showtimes for today — use IST (UTC+5:30)
  const now = new Date();
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // IST = UTC+5:30
  const nowIST = new Date(now.getTime() + IST_OFFSET_MS);
  const todayDateStr = nowIST.toISOString().split('T')[0]; // YYYY-MM-DD in IST
  const currentMinutes = nowIST.getUTCHours() * 60 + nowIST.getUTCMinutes(); // IST hours/mins

  const filteredShowtimes = showtimes.filter((st: any) => {
    const stDateStr = st.showDate.toISOString().split('T')[0];
    if (stDateStr === todayDateStr) {
      const parts = st.showTime.trim().split(' ');
      if (parts.length === 2) {
        const [time, modifier] = parts;
        let [hours, minutes] = time!.split(':');
        let h = parseInt(hours!, 10);
        const m = parseInt(minutes!, 10);
        if (h === 12) h = 0;
        if (modifier!.toUpperCase() === 'PM') h += 12;
        const stMinutes = h * 60 + m;
        return stMinutes > currentMinutes;
      }
    }
    return true;
  });

  const responseBody = {
    success: true,
    data: {
      showtimes: filteredShowtimes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  };

  // Cache for 90 seconds — short enough to stay real-time, reduces DB load
  await redis.set(cacheKey, JSON.stringify(responseBody), 'EX', 90);

  res.json(responseBody);
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/showtimes/:id — Showtime detail + seat availability (Public)
// ═══════════════════════════════════════════════════════════════════════════
export async function getShowtime(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };

  const showtime = await prisma.showtime.findUnique({
    where: { id },
    include: {
      screen: {
        include: {
          theater: {
            select: { id: true, name: true, city: true, address: true },
          },
        },
      },
    },
  }) as (Awaited<ReturnType<typeof prisma.showtime.findUnique>> & {
    screen: {
      id: string; name: string; rows: number; cols: number;
      seatLayout: unknown;
      theater: { id: string; name: string; city: string; address: string };
    };
  }) | null;

  if (!showtime) {
    res.status(404).json({
      success: false,
      error: { code: 'SHOWTIME_NOT_FOUND', message: 'Showtime not found' },
    });
    return;
  }

  // Get seat availability (includes both Redis live-booked + DB pre-seeded)
  const { booked, held } = await getUnavailableSeats(id);

  // Build seat map from screen layout
  const seatLayout = showtime.screen.seatLayout as Array<{
    tier: string;
    rows: number[];
    price: number;
  }>;

  const seatMap = [];
  let totalSeats = 0;
  for (const tier of seatLayout) {
    for (const rowIndex of tier.rows) {
      const rowLabel = String.fromCharCode(65 + rowIndex); // A, B, C, ...
      // Recliners have fewer seats (max 10) — they're wider
      const seatsInRow = tier.tier === 'Recliner'
        ? Math.min(showtime.screen.cols, 10)
        : showtime.screen.cols;
      const seats = [];
      for (let col = 1; col <= seatsInRow; col++) {
        const seatId = `${rowLabel}${col}`;
        let status: 'available' | 'booked' | 'held' = 'available';
        if (booked.includes(seatId)) status = 'booked';
        else if (held.includes(seatId)) status = 'held';
        seats.push({
          id: seatId,
          row: rowLabel,
          col,
          tier: tier.tier,
          price: tier.price * Number(showtime.priceMultiplier),
          status,
        });
        totalSeats++;
      }
      seatMap.push({
        row: rowLabel,
        tier: tier.tier,
        seats,
      });
    }
  }

  res.json({
    success: true,
    data: {
      showtime,
      seatMap,
      summary: {
        totalSeats,
        booked: booked.length,
        held: held.length,
        available: totalSeats - booked.length - held.length,
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/showtimes/:id — Cancel showtime (Admin)
// ═══════════════════════════════════════════════════════════════════════════
export async function cancelShowtime(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };

  try {
    const showtime = await prisma.showtime.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    logger.info(`Showtime cancelled: ${showtime.movieTitle} on ${showtime.showDate}`);
    res.json({ success: true, data: showtime });
  } catch {
    res.status(404).json({
      success: false,
      error: { code: 'SHOWTIME_NOT_FOUND', message: 'Showtime not found' },
    });
  }
}
