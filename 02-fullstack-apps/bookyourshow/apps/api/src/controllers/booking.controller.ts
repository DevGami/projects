import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import {
  createBooking,
  confirmBookingById,
  cancelBookingById,
} from '../services/booking.service.js';
import { verifyRecaptcha } from '../services/recaptcha.service.js';
import type { CreateBookingInput, MyBookingsQuery } from '../schemas/booking.schemas.js';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/bookings — Create booking (Auth required)
// ═══════════════════════════════════════════════════════════════════════════
export async function createBookingHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { captchaToken, ...input } = req.body as CreateBookingInput & { captchaToken?: string };

  // Bot detection for booking creation
  const captchaOk = await verifyRecaptcha(captchaToken, 'create_booking', 0.5);
  if (!captchaOk) {
    res.status(403).json({
      success: false,
      error: { code: 'CAPTCHA_FAILED', message: 'Bot detection failed. Please try again.' },
    });
    return;
  }

  const result = await createBooking(userId, input);

  if (!result.success) {
    const statusCode = result.error!.code === 'SEATS_UNAVAILABLE' ? 409 : 400;
    res.status(statusCode).json({
      success: false,
      error: result.error,
    });
    return;
  }

  res.status(201).json({
    success: true,
    data: result.booking,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/bookings — My bookings (Auth required)
// ═══════════════════════════════════════════════════════════════════════════
export async function getMyBookings(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { status, page, limit } =
    ((req as any).validatedQuery || req.query) as MyBookingsQuery;
  const skip = (page - 1) * limit;

  const where: any = { userId };
  if (status) where.status = status;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take: limit,
      include: {
        showtime: {
          include: {
            screen: {
              include: {
                theater: { select: { name: true, city: true, address: true } },
              },
            },
          },
        },
        payment: true,
      },
      orderBy: { bookedAt: 'desc' },
    }),
    prisma.booking.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/bookings/:id — Booking detail (Auth required)
// ═══════════════════════════════════════════════════════════════════════════
export async function getBookingDetail(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id } = req.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      showtime: {
        include: {
          screen: {
            include: {
              theater: { select: { name: true, city: true, address: true } },
            },
          },
        },
      },
      payment: true,
    },
  });

  if (!booking) {
    res.status(404).json({
      success: false,
      error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
    });
    return;
  }

  // Users can only see their own bookings (admins can see all)
  if (booking.userId !== userId && req.user!.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Not your booking' },
    });
    return;
  }

  res.json({ success: true, data: booking });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/bookings/:id/confirm — Confirm booking (mock payment)
// This is a temporary endpoint until Razorpay is integrated in M11
// ═══════════════════════════════════════════════════════════════════════════
export async function confirmBookingHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id } = req.params;

  const result = await confirmBookingById(id, userId);

  if (!result.success) {
    const statusCode =
      result.error!.code === 'BOOKING_NOT_FOUND' ? 404 :
      result.error!.code === 'FORBIDDEN' ? 403 : 400;
    res.status(statusCode).json({
      success: false,
      error: result.error,
    });
    return;
  }

  res.json({
    success: true,
    data: result.booking,
    message: 'Booking confirmed! Seats are now permanently reserved.',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/bookings/:id/cancel — Cancel booking (Auth required)
// ═══════════════════════════════════════════════════════════════════════════
export async function cancelBookingHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id } = req.params;

  const result = await cancelBookingById(id, userId);

  if (!result.success) {
    const statusCode =
      result.error!.code === 'BOOKING_NOT_FOUND' ? 404 :
      result.error!.code === 'FORBIDDEN' ? 403 : 400;
    res.status(statusCode).json({
      success: false,
      error: result.error,
    });
    return;
  }

  res.json({
    success: true,
    data: result.booking,
    message: 'Booking cancelled. Seats have been released.',
  });
}
