import { prisma } from '../config/database.js';
import { logger } from '../middleware/logger.js';
import {
  lockSeats,
  confirmSeats,
  unbookSeats,
  releaseSeatLock,
} from './seat-lock.service.js';
import { emitBookingConfirmed, emitBookingCancelled } from '../events/producers.js';
import { sendBookingConfirmationEmail, sendBookingCancellationEmail } from './email-notification.service.js';
import type { CreateBookingInput } from '../schemas/booking.schemas.js';
import crypto from 'crypto';

// ── Generate Booking ID ─────────────────────────────────────────────────────
// Format: BYS-XXXXXX (6 alphanumeric chars)
function generateBookingId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'BYS-';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    id += chars[bytes[i]! % chars.length];
  }
  return id;
}

// ═══════════════════════════════════════════════════════════════════════════
// Create Booking
// 1. Validate showtime
// 2. Lock seats in Redis
// 3. Create booking in PostgreSQL (PENDING)
// ═══════════════════════════════════════════════════════════════════════════
export async function createBooking(
  userId: string,
  input: CreateBookingInput
): Promise<{ success: boolean; booking?: any; error?: { code: string; message: string; seats?: string[] } }> {
  const { showtimeId, seats } = input;

  // 1. Validate showtime exists and is active
  const showtime = await prisma.showtime.findUnique({
    where: { id: showtimeId },
    include: {
      screen: {
        include: { theater: true },
      },
    },
  });

  if (!showtime || showtime.status !== 'ACTIVE') {
    return {
      success: false,
      error: {
        code: 'SHOWTIME_NOT_AVAILABLE',
        message: 'Showtime not found or not active',
      },
    };
  }

  // 2. Validate seat IDs exist in the screen layout
  const seatLayout = showtime.screen.seatLayout as Array<{
    tier: string;
    rows: number[];
    price: number;
  }>;
  const validSeats = new Set<string>();
  for (const tier of seatLayout) {
    for (const rowIndex of tier.rows) {
      const rowLabel = String.fromCharCode(65 + rowIndex);
      for (let col = 1; col <= showtime.screen.cols; col++) {
        validSeats.add(`${rowLabel}${col}`);
      }
    }
  }

  const invalidSeats = seats.filter((s) => !validSeats.has(s.id));
  if (invalidSeats.length > 0) {
    return {
      success: false,
      error: {
        code: 'INVALID_SEATS',
        message: `Invalid seat IDs: ${invalidSeats.map((s) => s.id).join(', ')}`,
      },
    };
  }

  // 3. Lock seats in Redis
  const seatIds = seats.map((s) => s.id);
  const lockResult = await lockSeats(showtimeId, seatIds, userId);

  if (!lockResult.success) {
    return {
      success: false,
      error: {
        code: 'SEATS_UNAVAILABLE',
        message: `The following seats are already taken: ${lockResult.conflictSeats!.join(', ')}`,
        seats: lockResult.conflictSeats,
      },
    };
  }

  // 4. Calculate total amount (seat price × showtime price multiplier)
  const totalAmount = seats.reduce(
    (sum, seat) => sum + seat.price * Number(showtime.priceMultiplier),
    0
  );

  // 5. Create booking in PostgreSQL
  const bookingId = generateBookingId();
  const booking = await prisma.booking.create({
    data: {
      id: bookingId,
      userId,
      showtimeId,
      movieTmdbId: showtime.movieTmdbId,
      movieTitle: showtime.movieTitle,
      seats: seats.map((s) => ({
        id: s.id,
        tier: s.tier,
        price: s.price * Number(showtime.priceMultiplier),
      })),
      totalAmount,
      status: 'PENDING',
    },
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
    },
  });

  logger.info(
    `Booking created: ${bookingId} — ${seats.length} seats for "${showtime.movieTitle}" (₹${totalAmount})`
  );

  return { success: true, booking };
}

// ═══════════════════════════════════════════════════════════════════════════
// Confirm Booking (after payment)
// Moves seats from hold → permanent booked
// ═══════════════════════════════════════════════════════════════════════════
export async function confirmBookingById(
  bookingId: string,
  userId: string
): Promise<{ success: boolean; booking?: any; error?: { code: string; message: string } }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    return {
      success: false,
      error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
    };
  }

  if (booking.userId !== userId) {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Not your booking' },
    };
  }

  if (booking.status !== 'PENDING') {
    return {
      success: false,
      error: {
        code: 'INVALID_STATUS',
        message: `Cannot confirm a booking with status: ${booking.status}`,
      },
    };
  }

  // Move seats to permanent booked set in Redis
  const seatIds = (booking.seats as Array<{ id: string }>).map((s) => s.id);
  await confirmSeats(booking.showtimeId, seatIds, userId);

  // Update booking status
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CONFIRMED' },
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
    },
  });

  logger.info(`Booking confirmed: ${bookingId}`);

  // Fetch user name + email for notifications
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  // Fire-and-forget: Kafka event + direct email (both non-blocking)
  emitBookingConfirmed({ ...updated, userEmail: user?.email ?? '' });

  // Direct email notification (works even when Kafka/Java are down)
  if (user?.email) {
    const seats = (updated.seats as Array<{ id: string; tier: string; price: number }>);
    sendBookingConfirmationEmail({
      userName: user.name || 'Guest',
      userEmail: user.email,
      bookingId: updated.id,
      movieTitle: updated.movieTitle,
      showDate: updated.showtime.showDate,
      showTime: updated.showtime.showTime,
      theaterName: updated.showtime.screen.theater.name,
      theaterCity: updated.showtime.screen.theater.city,
      screenName: updated.showtime.screen.name,
      seats,
      totalAmount: Number(updated.totalAmount),
    }).catch(err => logger.error('Failed to queue confirmation email:', err));
  }

  return { success: true, booking: updated };
}

// ═══════════════════════════════════════════════════════════════════════════
// Cancel Booking
// Releases seats from Redis, updates status
// ═══════════════════════════════════════════════════════════════════════════
export async function cancelBookingById(
  bookingId: string,
  userId: string
): Promise<{ success: boolean; booking?: any; error?: { code: string; message: string } }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    return {
      success: false,
      error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
    };
  }

  if (booking.userId !== userId) {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Not your booking' },
    };
  }

  if (booking.status === 'CANCELLED') {
    return {
      success: false,
      error: { code: 'ALREADY_CANCELLED', message: 'Booking is already cancelled' },
    };
  }

  const seatIds = (booking.seats as Array<{ id: string }>).map((s) => s.id);

  // Release from both hold and booked sets
  await releaseSeatLock(booking.showtimeId, seatIds, userId);
  await unbookSeats(booking.showtimeId, seatIds);

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: 'User cancelled',
    },
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
    },
  });

  logger.info(`Booking cancelled: ${bookingId} — ${seatIds.length} seats released`);

  // Fetch user name + email for notifications
  const cancelUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  // Fire-and-forget: Kafka event + direct email
  emitBookingCancelled({ ...updated, userEmail: cancelUser?.email ?? '' });

  if (cancelUser?.email) {
    sendBookingCancellationEmail({
      userName: cancelUser.name || 'Guest',
      userEmail: cancelUser.email,
      bookingId: updated.id,
      movieTitle: updated.movieTitle,
      totalAmount: Number(updated.totalAmount),
    }).catch(err => logger.error('Failed to queue cancellation email:', err));
  }

  return { success: true, booking: updated };
}
