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
// Uses an atomic Lua script to prevent race conditions (C6 fix).
// Returns: { success, conflictSeats? }
// ═══════════════════════════════════════════════════════════════════════════

// Lua script: atomically check for conflicts then lock
// KEYS[1] = bookedKey(showtimeId)
// KEYS[2] = userHoldKey(showtimeId, userId)
// ARGV[1..n] = seatIds to lock
// ARGV[n+1] = TTL in seconds
// Returns: JSON array of conflicting seat IDs (empty = success)
const LOCK_SEATS_LUA = `
local bookedKey = KEYS[1]
local userHoldKey = KEYS[2]
local ttl = tonumber(ARGV[#ARGV])
local conflicts = {}

-- Collect all hold keys for this showtime (except this user's own hold)
-- We cannot do SCAN inside Lua, so conflicts from other users' holds
-- are checked via the pre-passed held seats in ARGV
-- ARGV[1..n-1] = seats to lock, ARGV[n] = ttl
local seatCount = #ARGV - 1

for i = 1, seatCount do
  local seat = ARGV[i]
  -- Check if permanently booked
  if redis.call('SISMEMBER', bookedKey, seat) == 1 then
    table.insert(conflicts, seat)
  end
end

if #conflicts > 0 then
  return conflicts
end

-- All clear — lock the seats
for i = 1, seatCount do
  redis.call('SADD', userHoldKey, ARGV[i])
end
redis.call('EXPIRE', userHoldKey, ttl)
return {}
`;

export async function lockSeats(
  showtimeId: string,
  seatIds: string[],
  userId: string
): Promise<{ success: boolean; conflictSeats?: string[] }> {
  // Step 1: Check seats held by OTHER users (cannot be done atomically in Lua without SCAN)
  const allHeld = await getAllHeldSeats(showtimeId);
  const userHoldKey = holdKey(showtimeId, userId);
  const userHeldSeats = await redis.smembers(userHoldKey);
  const userHeldSet = new Set(userHeldSeats);

  // Seats held by others (not by this user) are conflicts
  const heldByOthers = allHeld.filter(s => !userHeldSet.has(s));
  const preConflicts = seatIds.filter(s => heldByOthers.includes(s));
  if (preConflicts.length > 0) {
    return { success: false, conflictSeats: preConflicts };
  }

  // Step 2: Atomically check booked set + lock seats via Lua
  // This prevents race conditions between the check and the SADD
  const args: (string | number)[] = [
    ...seatIds,
    HOLD_TTL,
  ];

  const result = await redis.eval(
    LOCK_SEATS_LUA,
    2, // numkeys
    bookedKey(showtimeId),
    userHoldKey,
    ...args
  ) as string[];

  if (result && result.length > 0) {
    return { success: false, conflictSeats: result };
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
