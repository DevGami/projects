import Redis from 'ioredis';
import { env } from './env.js';

// ── Redis Client ────────────────────────────────────────────────────────────
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
  lazyConnect: true,
});

// ── Connection Test ─────────────────────────────────────────────────────────
export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    const pong = await redis.ping();
    if (pong === 'PONG') {
      console.log('✅ Redis connected');
    }
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    throw error;
  }
}

redis.on('error', (error) => {
  console.error('❌ Redis error:', error.message);
});

redis.on('close', () => {
  console.warn('⚠️ Redis connection closed');
});

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  console.log('🔌 Redis disconnected');
}
