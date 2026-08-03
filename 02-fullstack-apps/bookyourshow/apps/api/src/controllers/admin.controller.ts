import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { logger } from '../middleware/logger.js';
import { syncMoviesFromTMDB } from '../services/movie-sync.service.js';
import { Movie } from '../models/mongo/Movie.js';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/admin/stats — Dashboard summary
// ═══════════════════════════════════════════════════════════════════════════
export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  const [
    totalUsers,
    totalMovies,
    totalBookings,
    bookingsToday,
    revenueThisWeek,
    recentBookings,
  ] = await Promise.all([
    prisma.user.count(),
    Movie.countDocuments(),
    prisma.booking.count(),
    prisma.booking.count({ where: { bookedAt: { gte: todayStart } } }),
    prisma.booking.aggregate({
      where: {
        status: 'CONFIRMED',
        bookedAt: { gte: weekStart },
      },
      _sum: { totalAmount: true },
    }),
    prisma.booking.findMany({
      take: 5,
      orderBy: { bookedAt: 'desc' },
      select: {
        id: true,
        movieTitle: true,
        status: true,
        totalAmount: true,
        bookedAt: true,
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      stats: {
        totalUsers,
        totalMovies,
        totalBookings,
        bookingsToday,
        revenueThisWeek: Number(revenueThisWeek._sum.totalAmount ?? 0),
      },
      recentBookings,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/admin/users
// ═══════════════════════════════════════════════════════════════════════════
export async function getUsers(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  const search = (req.query.search as string) || '';

  const where = search
    ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { bookings: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    success: true,
    data: { users, total, page, pages: Math.ceil(total / limit) },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/v1/admin/users/:id/role
// ═══════════════════════════════════════════════════════════════════════════
export async function updateUserRole(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { role } = req.body;

  if (!['USER', 'ADMIN'].includes(role)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ROLE', message: 'Role must be USER or ADMIN' } });
    return;
  }

  // Prevent self-demotion
  if (req.user?.userId === id && role === 'USER') {
    res.status(400).json({ success: false, error: { code: 'SELF_DEMOTION', message: 'Cannot demote your own account' } });
    return;
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });

  logger.info(`Admin ${req.user?.email} changed role of ${user.email} to ${role}`);
  res.json({ success: true, data: { user } });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/admin/movies/sync — Trigger TMDB sync
// ═══════════════════════════════════════════════════════════════════════════
export async function triggerMovieSync(req: Request, res: Response): Promise<void> {
  logger.info(`Admin ${req.user?.email} triggered TMDB movie sync`);
  try {
    const result = await syncMoviesFromTMDB();
    res.json({ success: true, data: { result, message: 'TMDB sync completed' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SYNC_FAILED', message: err.message } });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/v1/admin/movies/:id — Update movie flags
// ═══════════════════════════════════════════════════════════════════════════
export async function updateMovie(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { isNowShowing, isUpcoming, releaseDate } = req.body;

  // MongoDB via Mongoose — movies live in Mongo, not Postgres
  const movie = await Movie.findByIdAndUpdate(
    id,
    {
      ...(isNowShowing !== undefined && { status: isNowShowing ? 'now_showing' : 'upcoming' }),
      ...(isUpcoming !== undefined && { isUpcoming }),
      ...(releaseDate !== undefined && { releaseDate: new Date(releaseDate) }),
    },
    { new: true },
  );

  if (!movie) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Movie not found' } });
    return;
  }

  res.json({ success: true, data: { movie } });
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/admin/movies/:id
// ═══════════════════════════════════════════════════════════════════════════
export async function deleteMovie(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  // MongoDB via Mongoose
  await Movie.findByIdAndDelete(id);
  logger.info(`Admin ${req.user?.email} deleted movie ${id}`);
  res.json({ success: true, data: { message: 'Movie deleted' } });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/admin/theaters — Create theater
// ═══════════════════════════════════════════════════════════════════════════
export async function createTheater(req: Request, res: Response): Promise<void> {
  const { name, city, address, screens } = req.body;

  const theater = await prisma.theater.create({
    data: {
      name,
      city,
      address,
      screens: screens
        ? {
          create: screens.map((s: { name: string; totalSeats: number; tiers: any }) => ({
            name: s.name,
            totalSeats: s.totalSeats,
            tiers: s.tiers,
          })),
        }
        : undefined,
    },
    include: { screens: true },
  });

  logger.info(`Admin ${req.user?.email} created theater "${name}" in ${city}`);
  res.status(201).json({ success: true, data: { theater } });
}

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/v1/admin/theaters/:id
// ═══════════════════════════════════════════════════════════════════════════
export async function updateTheater(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, city, address } = req.body;

  const theater = await prisma.theater.update({
    where: { id },
    data: { ...(name && { name }), ...(city && { city }), ...(address && { address }) },
  });

  res.json({ success: true, data: { theater } });
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/admin/theaters/:id
// ═══════════════════════════════════════════════════════════════════════════
export async function deleteTheater(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  await prisma.theater.delete({ where: { id } });
  logger.info(`Admin ${req.user?.email} deleted theater ${id}`);
  res.json({ success: true, data: { message: 'Theater deleted' } });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/admin/showtimes — Create showtime
// ═══════════════════════════════════════════════════════════════════════════
export async function createShowtime(req: Request, res: Response): Promise<void> {
  const { movieId, screenId, showDate, showTime, basePrice, language, format } = req.body;

  // Get screen tiers to build seat pricing
  const screen = await prisma.screen.findUnique({ where: { id: screenId } });
  if (!screen) {
    res.status(404).json({ success: false, error: { code: 'SCREEN_NOT_FOUND', message: 'Screen not found' } });
    return;
  }

  const movie = await prisma.movie.findUnique({ where: { id: movieId }, select: { title: true } });
  if (!movie) {
    res.status(404).json({ success: false, error: { code: 'MOVIE_NOT_FOUND', message: 'Movie not found' } });
    return;
  }

  // Build seat pricing from screen tiers + basePrice multipliers
  const tiers = screen.tiers as Record<string, { rows: string[]; multiplier: number }>;
  const seatPricing: Record<string, number> = {};
  for (const [tierName, tierData] of Object.entries(tiers)) {
    seatPricing[tierName] = Math.round(basePrice * (tierData.multiplier ?? 1));
  }

  const showtime = await prisma.showtime.create({
    data: {
      movieId,
      screenId,
      showDate: new Date(showDate),
      showTime,
      basePrice,
      language: language || 'Hindi',
      format: format || '2D',
      seatPricing,
    },
    include: {
      movie: { select: { title: true, posterUrl: true } },
      screen: { include: { theater: { select: { name: true, city: true } } } },
    },
  });

  logger.info(`Admin ${req.user?.email} created showtime for "${movie.title}" on ${showDate}`);
  res.status(201).json({ success: true, data: { showtime } });
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/admin/showtimes/:id
// ═══════════════════════════════════════════════════════════════════════════
export async function deleteShowtime(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  await prisma.showtime.delete({ where: { id } });
  logger.info(`Admin ${req.user?.email} deleted showtime ${id}`);
  res.json({ success: true, data: { message: 'Showtime deleted' } });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/admin/showtimes — All showtimes with movie info
// ═══════════════════════════════════════════════════════════════════════════
export async function getShowtimes(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 30;
  const skip = (page - 1) * limit;

  const [showtimes, total] = await Promise.all([
    prisma.showtime.findMany({
      skip,
      take: limit,
      orderBy: [{ showDate: 'asc' }, { showTime: 'asc' }],
      include: {
        movie: { select: { title: true, posterUrl: true } },
        screen: { include: { theater: { select: { name: true, city: true } } } },
      },
    }),
    prisma.showtime.count(),
  ]);

  res.json({
    success: true,
    data: { showtimes, total, page, pages: Math.ceil(total / limit) },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/admin/bookings — All bookings (paginated)
// ═══════════════════════════════════════════════════════════════════════════
export async function getAllBookings(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  const status = req.query.status as string;

  const where = status ? { status } : {};

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy: { bookedAt: 'desc' },
      include: {
        showtime: {
          include: {
            screen: {
              include: { theater: { select: { name: true, city: true } } },
            },
          },
        },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  res.json({
    success: true,
    data: { bookings, total, page, pages: Math.ceil(total / limit) },
  });
}
