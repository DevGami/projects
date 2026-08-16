import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../middleware/logger.js';
import { syncMoviesFromTMDB } from '../services/movie-sync.service.js';

// ═══════════════════════════════════════════════════════════════════════════
// Movie Sync Cron Job
// ═══════════════════════════════════════════════════════════════════════════
let syncTask: ScheduledTask | null = null;
let startupTimer: NodeJS.Timeout | null = null;

export function startMovieSyncCron(): void {
  // Don't start cron if no TMDB API key configured
  if (!env.TMDB_API_KEY) {
    logger.warn('⚠️ TMDB_API_KEY not set — movie sync cron disabled');
    return;
  }

  // ── Startup Sync ────────────────────────────────────────────────────────
  // Run a sync 15 seconds after server starts so movies are always fresh
  // after any deploy — without needing any manual intervention.
  startupTimer = setTimeout(async () => {
    logger.info('🚀 Running startup TMDB sync (15s after boot)...');
    try {
      const result = await syncMoviesFromTMDB();
      logger.info(`✅ Startup sync done: ${result.totalMovies} now-showing movies`);
    } catch (err) {
      logger.error('❌ Startup sync failed:', err);
    }
  }, 15_000);

  // ── Recurring Schedule ──────────────────────────────────────────────────
  // Production: every 6 hours | Development: every 30 minutes
  // 6 hours is plenty — TMDB now_playing lists don't change minute-to-minute.
  // Using a longer interval avoids wasting TMDB API quota.
  const schedule = env.NODE_ENV === 'production'
    ? '0 */6 * * *'    // Every 6 hours (midnight, 6am, 12pm, 6pm IST)
    : '*/30 * * * *';  // Every 30 minutes in dev

  syncTask = cron.schedule(schedule, async () => {
    logger.info(`⏰ Cron triggered: TMDB movie sync (schedule: ${schedule})`);
    try {
      const result = await syncMoviesFromTMDB();
      logger.info(`✅ Cron sync done: ${result.totalMovies} now-showing movies`);
    } catch (error) {
      logger.error('Cron sync failed:', error);
    }
  }, {
    timezone: 'Asia/Kolkata',
  });

  logger.info(`🕐 Movie sync cron started (${schedule}, IST) + startup sync in 15s`);
}

export function stopMovieSyncCron(): void {
  if (startupTimer) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
  if (syncTask) {
    syncTask.stop();
    syncTask = null;
    logger.info('🛑 Movie sync cron stopped');
  }
}
