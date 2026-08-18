import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { logger } from '../middleware/logger.js';
import { syncMoviesFromTMDB } from '../services/movie-sync.service.js';
import { Movie } from '../models/mongo/Movie.js';
import { catchUpShowtimes, generateShowtimesForDates, getVisibleDates } from '../services/showtime-generator.service.js';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/admin/stats — Dashboard summary
// ═══════════════════════════════════════════════════════════════════════════
export async function getDashboardStats(_req: Request, res: Response): Promise<void> {
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
    Movie.countDocuments({ status: 'now_showing' }),
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
  const { id } = req.params as { id: string };
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
  const { id } = req.params as { id: string };
  const { isNowShowing, isUpcoming, releaseDate } = req.body;

  // Guard against invalid MongoDB ObjectId (prevents unhandled CastError)
  const { isValidObjectId } = await import('mongoose');
  if (!isValidObjectId(id)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid movie ID format' } });
    return;
  }

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
  const { id } = req.params as { id: string };
  const { isValidObjectId } = await import('mongoose');
  if (!isValidObjectId(id)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid movie ID format' } });
    return;
  }
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
  const { id } = req.params as { id: string };
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
  const { id } = req.params as { id: string };
  await prisma.theater.delete({ where: { id } });
  logger.info(`Admin ${req.user?.email} deleted theater ${id}`);
  res.json({ success: true, data: { message: 'Theater deleted' } });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/admin/showtimes — Create showtime
// ═══════════════════════════════════════════════════════════════════════════
export async function createShowtime(req: Request, res: Response): Promise<void> {
  const { movieId, screenId, showDate, showTime } = req.body;

  // Get screen
  const screen = await prisma.screen.findUnique({ where: { id: screenId } });
  if (!screen) {
    res.status(404).json({ success: false, error: { code: 'SCREEN_NOT_FOUND', message: 'Screen not found' } });
    return;
  }

  // Get movie from Mongo
  const movie = await Movie.findById(movieId).select('title tmdbId poster');
  if (!movie) {
    res.status(404).json({ success: false, error: { code: 'MOVIE_NOT_FOUND', message: 'Movie not found' } });
    return;
  }

  // In new schema, basePrice is determined by priceMultiplier. We'll set a default 1.0.
  const showtime = await prisma.showtime.create({
    data: {
      movieTmdbId: movie.tmdbId,
      movieTitle: movie.title,
      screenId,
      showDate: new Date(showDate),
      showTime,
      priceMultiplier: 1.0,
    },
    include: {
      screen: { include: { theater: { select: { name: true, city: true } } } },
    },
  });

  const enrichedShowtime = {
    ...showtime,
    movie: { title: movie.title, posterUrl: movie.poster }
  };

  logger.info(`Admin ${req.user?.email} created showtime for "${movie.title}" on ${showDate}`);
  res.status(201).json({ success: true, data: { showtime: enrichedShowtime } });
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/admin/showtimes/:id
// ═══════════════════════════════════════════════════════════════════════════
export async function deleteShowtime(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
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

  // Only show today and future showtimes
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [showtimes, total] = await Promise.all([
    prisma.showtime.findMany({
      where: { showDate: { gte: today } },
      skip,
      take: limit,
      orderBy: [{ showDate: 'asc' }, { showTime: 'asc' }],
      include: {
        screen: { include: { theater: { select: { name: true, city: true } } } },
      },
    }),
    prisma.showtime.count({ where: { showDate: { gte: today } } }),
  ]);

  const tmdbIds = [...new Set(showtimes.map(s => s.movieTmdbId))];
  const movies = await Movie.find({ tmdbId: { $in: tmdbIds } }, { tmdbId: 1, title: 1, poster: 1 }).lean();
  const movieMap = new Map(movies.map((m: any) => [m.tmdbId, m]));

  const enrichedShowtimes = showtimes.map(s => ({
    ...s,
    movie: movieMap.get(s.movieTmdbId) 
      ? { title: movieMap.get(s.movieTmdbId).title, posterUrl: movieMap.get(s.movieTmdbId).poster } 
      : { title: s.movieTitle, posterUrl: null }
  }));

  res.json({
    success: true,
    data: { showtimes: enrichedShowtimes, total, page, pages: Math.ceil(total / limit) },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/admin/bookings — All bookings (paginated)
// ═══════════════════════════════════════════════════════════════════════════
export async function getAllBookings(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  const status = req.query.status as any; // Type-cast to any to satisfy BookingStatus enum

  const where: any = status ? { status } : {};

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

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/admin/resync-showtimes
// Cleans stale showtimes and regenerates for all visible dates with
// current MongoDB movies. Useful for fixing stale data after a movie sync.
// ═══════════════════════════════════════════════════════════════════════════
export async function resyncShowtimes(_req: Request, res: Response): Promise<void> {
  try {
    logger.info('🔄 Manual showtime resync triggered via admin API');

    // Get current valid movie tmdbIds
    const movies = await Movie.find({ status: 'now_showing', isActive: true }).select('tmdbId').lean();
    const validTmdbIds = movies.map(m => m.tmdbId);

    if (validTmdbIds.length === 0) {
      res.status(400).json({ success: false, error: { code: 'NO_MOVIES', message: 'No active movies in MongoDB' } });
      return;
    }

    const visibleDates = getVisibleDates();
    logger.info(`🗑️ Deleting stale showtimes for ${visibleDates.length} visible dates (movies not in current ${validTmdbIds.length} movie list)`);

    // Delete all unbooked showtimes for visible dates that reference old movies
    const { count: deletedCount } = await prisma.showtime.deleteMany({
      where: {
        showDate: { in: visibleDates.map(d => new Date(d)) },
        movieTmdbId: { notIn: validTmdbIds },
        bookings: { none: {} },
      },
    });

    logger.info(`🗑️ Deleted ${deletedCount} stale showtimes`);

    // Run catchup which will regenerate based on current movies
    await catchUpShowtimes();

    res.json({
      success: true,
      data: {
        message: `Resync complete. Deleted ${deletedCount} stale showtimes. Regenerated for ${visibleDates.length} visible dates.`,
        visibleDates,
        moviesCount: validTmdbIds.length,
      },
    });
  } catch (err: any) {
    logger.error('Showtime resync failed:', err);
    res.status(500).json({ success: false, error: { code: 'RESYNC_FAILED', message: err.message } });
  }
}
