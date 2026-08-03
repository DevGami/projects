import { redis } from '../config/redis.js';
import { prisma } from '../config/database.js';
import { logger } from '../middleware/logger.js';

// ── Redis Key Patterns ──────────────────────────────────────────────────────
// bys:seats:hold:{showtimeId}:{userId}  → SET of seat IDs (TTL 300s)
// bys:seats:booked:{showtimeId}         → SET of seat IDs (permanent)

const HOLD_TTL = 300; // 5 minutes

function holdKey(showtimeId: string, userId: string): string {
  return `bys:seats:hold:${showtimeId}:${userId}`;
}

function bookedKey(showtimeId: string): string {
  return `bys:seats:booked:${showtimeId}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Get all currently held seats for a showtime (across ALL users)
// ═══════════════════════════════════════════════════════════════════════════
export async function getAllHeldSeats(showtimeId: string): Promise<string[]> {
  const pattern = `bys:seats:hold:${showtimeId}:*`;

  // Use SCAN instead of KEYS to avoid blocking the Redis event loop
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, batchKeys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...batchKeys);
  } while (cursor !== '0');

  if (keys.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.smembers(key);
  }
  const results = await pipeline.exec();
  if (!results) return [];

  const allSeats: string[] = [];
  for (const [err, seats] of results) {
    if (!err && Array.isArray(seats)) {
      allSeats.push(...(seats as string[]));
    }
  }
  return allSeats;
}

// ═══════════════════════════════════════════════════════════════════════════
// Get permanently booked seats for a showtime
// ═══════════════════════════════════════════════════════════════════════════
export async function getBookedSeats(showtimeId: string): Promise<string[]> {
  return redis.smembers(bookedKey(showtimeId));
}


// Get full seat availability (booked + held = unavailable)
// ═══════════════════════════════════════════════════════════════════════════
export async function getUnavailableSeats(showtimeId: string): Promise<{
  booked: string[];
  held: string[];
}> {
  const [redisBooked, held, showtime] = await Promise.all([
    getBookedSeats(showtimeId),
    getAllHeldSeats(showtimeId),
    prisma.showtime.findUnique({
      where: { id: showtimeId },
      select: { bookedSeats: true },
    }),
  ]);

  // Merge Redis-tracked booked seats with DB pre-seeded booked seats
  const preBooked = Array.isArray(showtime?.bookedSeats) ? (showtime.bookedSeats as string[]) : [];
  const booked = [...new Set([...redisBooked, ...preBooked])];

  return { booked, held };
}

// ═══════════════════════════════════════════════════════════════════════════
// Lock seats for a user (5-min hold)
// Returns: { success, conflictSeats? }
// ═══════════════════════════════════════════════════════════════════════════
export async function lockSeats(
  showtimeId: string,
  seatIds: string[],
  userId: string
): Promise<{ success: boolean; conflictSeats?: string[] }> {
  // 1. Check for conflicts (already booked or held by others)
  const { booked, held } = await getUnavailableSeats(showtimeId);

  // Get this user's own holds (they can re-select their own held seats)
  const userHoldKey = holdKey(showtimeId, userId);
  const userHeldSeats = await redis.smembers(userHoldKey);
  const userHeldSet = new Set(userHeldSeats);

  const unavailable = new Set([...booked, ...held]);
  const conflicts = seatIds.filter(
    (seat) => unavailable.has(seat) && !userHeldSet.has(seat)
  );

  if (conflicts.length > 0) {
    return { success: false, conflictSeats: conflicts };
  }

  // 2. Lock the seats in Redis
  const key = userHoldKey;
  if (seatIds.length > 0) {
    await redis.sadd(key, ...seatIds);
    await redis.expire(key, HOLD_TTL);
  }

  logger.info(
    `Seats locked: ${seatIds.join(', ')} for showtime ${showtimeId} by user ${userId} (TTL ${HOLD_TTL}s)`
  );

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Release a user's seat hold
// ═══════════════════════════════════════════════════════════════════════════
export async function releaseSeatLock(
  showtimeId: string,
  seatIds: string[],
  userId: string
): Promise<void> {
  const key = holdKey(showtimeId, userId);
  if (seatIds.length > 0) {
    await redis.srem(key, ...seatIds);
  }
  // If set is now empty, delete the key
  const remaining = await redis.scard(key);
  if (remaining === 0) {
    await redis.del(key);
  }
  logger.info(`Seats released: ${seatIds.join(', ')} for showtime ${showtimeId} by user ${userId}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Confirm seats (move from hold → permanent booked set)
// Called after successful payment/confirmation
// ═══════════════════════════════════════════════════════════════════════════
export async function confirmSeats(
  showtimeId: string,
  seatIds: string[],
  userId: string
): Promise<void> {
  const pipeline = redis.pipeline();

  // Add to permanent booked set
  if (seatIds.length > 0) {
    pipeline.sadd(bookedKey(showtimeId), ...seatIds);
  }

  // Remove from user's hold set
  const key = holdKey(showtimeId, userId);
  pipeline.del(key);

  await pipeline.exec();
  logger.info(`Seats confirmed: ${seatIds.join(', ')} for showtime ${showtimeId}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Unbook seats (remove from permanent booked set)
// Called on booking cancellation
// ═══════════════════════════════════════════════════════════════════════════
export async function unbookSeats(
  showtimeId: string,
  seatIds: string[]
): Promise<void> {
  if (seatIds.length > 0) {
    await redis.srem(bookedKey(showtimeId), ...seatIds);
  }
  logger.info(`Seats unbooked: ${seatIds.join(', ')} for showtime ${showtimeId}`);
}
