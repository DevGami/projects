/**
 * Seed fresh showtimes for the next 7 days.
 * Run: npx tsx scripts/seed-showtimes.ts
 */
import { prisma } from '../src/config/database.js';

const SCREENS = [
  '00000000-0000-0000-0000-000000000101', // Screen 1 - Standard (Ahmedabad)
  '00000000-0000-0000-0000-000000000102', // Screen 2 - Premium (Ahmedabad)
  '00000000-0000-0000-0000-000000000103', // Screen 3 - IMAX (Ahmedabad)
];

const MOVIES = [
  { tmdbId: 1084244, title: 'Toy Story 5' },
  { tmdbId: 1083381, title: 'Backrooms' },
  { tmdbId: 1315772, title: 'Minions & Monsters' },
  { tmdbId: 1486860, title: 'Haunted 3D: Echoes of the Past' },
  { tmdbId: 1480382, title: 'The Voice of Hind Rajab' },
];

const SHOW_TIMES = ['10:00 AM', '01:30 PM', '05:00 PM', '08:30 PM'];
const PRICE_MULTIPLIERS = [1, 1, 1.2, 1.5]; // evening shows cost more

async function main() {
  await prisma.$connect();
  console.log('🎬 Seeding showtimes for next 7 days...');

  const records = [];
  const today = new Date();

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const showDate = new Date(today);
    showDate.setDate(today.getDate() + dayOffset);
    showDate.setHours(0, 0, 0, 0);

    // Each screen gets 2 movies per day (rotate)
    for (let screenIdx = 0; screenIdx < SCREENS.length; screenIdx++) {
      const screenId = SCREENS[screenIdx]!;
      // Pick 2 movies for this screen (rotate based on day)
      const movieA = MOVIES[(dayOffset + screenIdx) % MOVIES.length]!;
      const movieB = MOVIES[(dayOffset + screenIdx + 2) % MOVIES.length]!;

      // Morning + afternoon shows → movie A
      // Evening + night shows → movie B
      records.push({
        screenId,
        movieTmdbId: movieA.tmdbId,
        movieTitle: movieA.title,
        showDate,
        showTime: SHOW_TIMES[0]!,
        priceMultiplier: String(PRICE_MULTIPLIERS[0]),
        status: 'ACTIVE' as const,
      });
      records.push({
        screenId,
        movieTmdbId: movieA.tmdbId,
        movieTitle: movieA.title,
        showDate,
        showTime: SHOW_TIMES[1]!,
        priceMultiplier: String(PRICE_MULTIPLIERS[1]),
        status: 'ACTIVE' as const,
      });
      records.push({
        screenId,
        movieTmdbId: movieB.tmdbId,
        movieTitle: movieB.title,
        showDate,
        showTime: SHOW_TIMES[2]!,
        priceMultiplier: String(PRICE_MULTIPLIERS[2]),
        status: 'ACTIVE' as const,
      });
      records.push({
        screenId,
        movieTmdbId: movieB.tmdbId,
        movieTitle: movieB.title,
        showDate,
        showTime: SHOW_TIMES[3]!,
        priceMultiplier: String(PRICE_MULTIPLIERS[3]),
        status: 'ACTIVE' as const,
      });
    }
  }

  const result = await prisma.showtime.createMany({
    data: records,
    skipDuplicates: true,
  });

  console.log(`✅ Created ${result.count} showtimes (${7} days × ${SCREENS.length} screens × 4 shows)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
