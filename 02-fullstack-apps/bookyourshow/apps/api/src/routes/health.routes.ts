import { Router, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { mongoose } from '../config/mongodb.js';
import { isKafkaConnected } from '../config/kafka.js';

const router = Router();

// GET /api/v1/health — Health check endpoint
router.get('/', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; latency?: string }> = {};

  // ── PostgreSQL ──────────────────────────────────────────────
  try {
    const pgStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.postgresql = { status: '✅ connected', latency: `${Date.now() - pgStart}ms` };
  } catch {
    checks.postgresql = { status: '❌ disconnected' };
  }

  // ── MongoDB ─────────────────────────────────────────────────
  try {
    const mongoStart = Date.now();
    const state = mongoose.connection.readyState;
    // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    if (state === 1) {
      await mongoose.connection.db?.admin().ping();
      checks.mongodb = { status: '✅ connected', latency: `${Date.now() - mongoStart}ms` };
    } else {
      checks.mongodb = { status: `⚠️ state=${state}` };
    }
  } catch {
    checks.mongodb = { status: '❌ disconnected' };
  }

  // ── Redis ───────────────────────────────────────────────────
  try {
    const redisStart = Date.now();
    const pong = await redis.ping();
    checks.redis = {
      status: pong === 'PONG' ? '✅ connected' : '❌ no pong',
      latency: `${Date.now() - redisStart}ms`,
    };
  } catch {
    checks.redis = { status: '❌ disconnected' };
  }

  // ── Kafka ───────────────────────────────────────────────────
  checks.kafka = {
    status: isKafkaConnected() ? '✅ connected' : '⚠️ disconnected (events will be dropped)',
  };

  // ── Overall ─────────────────────────────────────────────────
  // Kafka is non-critical — only check PG, Mongo, Redis for overall health
  const criticalChecks = [checks.postgresql, checks.mongodb, checks.redis];
  const allHealthy = criticalChecks.every((c) => c.status.includes('✅'));

  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    data: {
      service: 'BookYourShow API',
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime())}s`,
      checks,
    },
  });
});

export default router;
