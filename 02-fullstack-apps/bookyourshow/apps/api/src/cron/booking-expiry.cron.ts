import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { logger } from '../middleware/logger.js';

// =========================================================================
// Stale Booking Cleanup Cron
// Cancels PENDING bookings older than 15 minutes.
// Seat hold TTL = 5 min, so by 15 min the Redis lock is gone but the
// Postgres record remains as a ghost booking. This cron cleans those up.
// Runs every 5 minutes.
// =========================================================================

const STALE_BOOKING_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

async function expireStaleBookings(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_BOOKING_THRESHOLD_MS);

  try {
    const staleBookings = await prisma.booking.findMany({
      where: {
        status: 'PENDING',
        bookedAt: { lt: cutoff },
      },
      select: {
        id: true,
        showtimeId: true,
        seats: true,
        userId: true,
      },
    });

    if (staleBookings.length === 0) return;

    logger.info('Cleaning up ' + staleBookings.length + ' stale PENDING bookings');

    for (const booking of staleBookings) {
      try {
        const seatIds = (booking.seats as Array<{ id: string }>).map((s) => s.id);
        if (seatIds.length > 0) {
          const bookedKey = 'bys:seats:booked:' + booking.showtimeId;
          const holdKey = 'bys:seats:hold:' + booking.showtimeId + ':' + booking.userId;
          await redis.srem(bookedKey, ...seatIds);
          await redis.del(holdKey);
        }

        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason: 'Payment timeout - booking auto-expired',
          },
        });

        logger.info('Auto-expired stale booking ' + booking.id);
      } catch (err) {
        logger.error('Failed to expire booking ' + booking.id + ':' + String(err));
      }
    }
  } catch (err) {
    logger.error('Stale booking cleanup failed: ' + String(err));
  }
}

export function startBookingExpiryJob(): void {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    expireStaleBookings().catch((err) => logger.error('Booking expiry cron error: ' + String(err)));
  });

  logger.info('Booking expiry cron started (every 5 min, 15-min threshold)');
}
