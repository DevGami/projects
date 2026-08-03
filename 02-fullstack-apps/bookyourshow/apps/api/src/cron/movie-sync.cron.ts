import cron from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../middleware/logger.js';
import { syncMoviesFromTMDB } from '../services/movie-sync.service.js';

// ═══════════════════════════════════════════════════════════════════════════
// Movie Sync Cron Job
// ═══════════════════════════════════════════════════════════════════════════
let syncTask: cron.ScheduledTask | null = null;

export function startMovieSyncCron(): void {
  // Don't start cron if no TMDB API key configured
  if (!env.TMDB_API_KEY) {
    logger.warn('⚠️ TMDB_API_KEY not set — movie sync cron disabled');
    return;
  }

  // Production: every 6 hours | Development: every 30 minutes
  const schedule = env.NODE_ENV === 'production'
    ? '0 */6 * * *'      // At minute 0 of every 6th hour
    : '*/30 * * * *';    // Every 30 minutes

  syncTask = cron.schedule(schedule, async () => {
    logger.info(`⏰ Cron triggered: movie sync (schedule: ${schedule})`);
    try {
      await syncMoviesFromTMDB();
    } catch (error) {
      logger.error('Cron sync failed:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });

  logger.info(`🕐 Movie sync cron started (${schedule}, IST)`);
}

export function stopMovieSyncCron(): void {
  if (syncTask) {
    syncTask.stop();
    syncTask = null;
    logger.info('🛑 Movie sync cron stopped');
  }
}
