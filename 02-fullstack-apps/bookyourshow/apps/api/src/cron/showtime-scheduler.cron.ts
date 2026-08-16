import cron, { type ScheduledTask } from 'node-cron';
import { logger } from '../middleware/logger.js';
import { generateShowtimesForDates, catchUpShowtimes } from '../services/showtime-generator.service.js';

// ═══════════════════════════════════════════════════════════════════════════
// Showtime Scheduler Cron
//
// Release schedule:
//   Sunday 12:00 PM IST  → generate Mon, Tue, Wed showtimes
//   Wednesday 6:00 PM IST → generate Thu, Fri showtimes
//   Friday 6:00 PM IST   → generate Sat, Sun showtimes
// ═══════════════════════════════════════════════════════════════════════════

const TIMEZONE = 'Asia/Kolkata';

function getDateOffset(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().split('T')[0]!;
}

// getDayOfWeek was removed as it's no longer used

let sundayCron: ScheduledTask | null = null;
let wednesdayCron: ScheduledTask | null = null;
let fridayCron: ScheduledTask | null = null;

export function startShowtimeScheduler(): void {
  // Sunday at 12:00 PM IST → Mon, Tue, Wed
  sundayCron = cron.schedule('0 12 * * 0', async () => {
    logger.info('⏰ Sunday 12PM: generating Mon/Tue/Wed showtimes');
    try {
      const dates: string[] = [];
      // Mon = today + 1, Tue = +2, Wed = +3
      for (let i = 1; i <= 3; i++) {
        dates.push(getDateOffset(i));
      }
      await generateShowtimesForDates(dates);
    } catch (err) {
      logger.error('Sunday showtime generation failed:', err);
    }
  }, { timezone: TIMEZONE });

  // Wednesday at 6:00 PM IST → Thu, Fri
  wednesdayCron = cron.schedule('0 18 * * 3', async () => {
    logger.info('⏰ Wednesday 6PM: generating Thu/Fri showtimes');
    try {
      const dates = [getDateOffset(1), getDateOffset(2)]; // Thu, Fri
      await generateShowtimesForDates(dates);
    } catch (err) {
      logger.error('Wednesday showtime generation failed:', err);
    }
  }, { timezone: TIMEZONE });

  // Friday at 6:00 PM IST → Sat, Sun
  fridayCron = cron.schedule('0 18 * * 5', async () => {
    logger.info('⏰ Friday 6PM: generating Sat/Sun showtimes');
    try {
      const dates = [getDateOffset(1), getDateOffset(2)]; // Sat, Sun
      await generateShowtimesForDates(dates);
    } catch (err) {
      logger.error('Friday showtime generation failed:', err);
    }
  }, { timezone: TIMEZONE });

  logger.info('📅 Showtime scheduler started (Sun 12PM, Wed 6PM, Fri 6PM IST)');

  // On startup, run catch-up to fill any missing dates
  catchUpShowtimes().catch(err => {
    logger.error('Showtime catch-up failed:', err);
  });
}

export function stopShowtimeScheduler(): void {
  sundayCron?.stop();
  wednesdayCron?.stop();
  fridayCron?.stop();
  sundayCron = wednesdayCron = fridayCron = null;
  logger.info('🛑 Showtime scheduler stopped');
}
