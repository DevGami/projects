import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── Create Admin User ───────────────────────────────────────
  const adminPassword = await hash('Admin@123456!', {
    type: 2,            // argon2id
    memoryCost: 65536,  // 64 MB
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@bookyourshow.com' },
    update: { passwordHash: adminPassword },
    create: {
      name: 'Admin User',
      email: 'admin@bookyourshow.com',
      passwordHash: adminPassword,
      emailVerified: true,
      role: Role.ADMIN,
    },
  });
  console.log(`✅ Admin user: ${admin.email} (password: Admin@123456!)`);

  // ── Create Test User ────────────────────────────────────────
  const testPassword = await hash('test123456', {
    type: 2,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const testUser = await prisma.user.upsert({
    where: { email: 'test@demo.com' },
    update: {},
    create: {
      name: 'Test User',
      email: 'test@demo.com',
      passwordHash: testPassword,
      emailVerified: true,
      role: Role.USER,
    },
  });
  console.log(`✅ Test user: ${testUser.email} (password: test123456)`);

  // ── Create Default Theater ──────────────────────────────────
  const theater = await prisma.theater.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'BookYourShow Cinemas - Ahmedabad',
      city: 'Ahmedabad',
      address: 'SG Highway, near PDEU, Ahmedabad, Gujarat 382007',
      totalScreens: 3,
    },
  });
  console.log(`✅ Theater: ${theater.name}`);

  // ── Create Screens ──────────────────────────────────────────
  const seatLayout = [
    { tier: 'Silver', rows: [0, 1], price: 150 },
    { tier: 'Gold', rows: [2, 3], price: 220 },
    { tier: 'VIP', rows: [4], price: 350 },
  ];

  const screenNames = ['Screen 1 - Standard', 'Screen 2 - Premium', 'Screen 3 - IMAX'];
  for (let i = 0; i < 3; i++) {
    const screenId = `00000000-0000-0000-0000-00000000010${i + 1}`;
    const screen = await prisma.screen.upsert({
      where: { id: screenId },
      update: {},
      create: {
        id: screenId,
        theaterId: theater.id,
        name: screenNames[i]!,
        rows: 5,
        cols: 10,
        seatLayout,
      },
    });
    console.log(`✅ Screen: ${screen.name} (5 rows × 10 cols)`);
  }

  // ── Create Sample Showtimes ──────────────────────────────────
  // Uses real TMDB movie IDs from the synced collection
  const sampleMovies = [
    { tmdbId: 1084244, title: 'Toy Story 5' },
    { tmdbId: 1275779, title: 'Disclosure Day' },
    { tmdbId: 1083381, title: 'Backrooms' },
    { tmdbId: 1280738, title: 'The Furious' },
    { tmdbId: 1315772, title: 'Minions & Monsters' },
    { tmdbId: 1081003, title: 'Supergirl' },
  ];

  const screenIds = [
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000103',
  ];

  const showTimes = ['10:30 AM', '02:00 PM', '06:30 PM', '09:45 PM'];

  // Seed showtimes for today + next 2 days
  const today = new Date();
  const dates: string[] = [];
  for (let d = 0; d < 3; d++) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + d);
    dates.push(dt.toISOString().split('T')[0]!);
  }

  let showtimeCount = 0;
  for (const date of dates) {
    // Screen 1: 2 movies, 4 shows each
    for (let mi = 0; mi < 2; mi++) {
      const movie = sampleMovies[mi]!;
      for (const time of showTimes) {
        try {
          await prisma.showtime.create({
            data: {
              movieTmdbId: movie.tmdbId,
              movieTitle: movie.title,
              screenId: screenIds[0]!,
              showDate: new Date(date),
              showTime: time,
              priceMultiplier: 1.0,
            },
          });
          showtimeCount++;
        } catch {
          // Skip duplicates on re-seed
        }
      }
    }

    // Screen 2: 2 movies, 4 shows each
    for (let mi = 2; mi < 4; mi++) {
      const movie = sampleMovies[mi]!;
      for (const time of showTimes) {
        try {
          await prisma.showtime.create({
            data: {
              movieTmdbId: movie.tmdbId,
              movieTitle: movie.title,
              screenId: screenIds[1]!,
              showDate: new Date(date),
              showTime: time,
              priceMultiplier: 1.2,
            },
          });
          showtimeCount++;
        } catch {
          // Skip duplicates on re-seed
        }
      }
    }

    // Screen 3 (IMAX): 2 movies, 4 shows each
    for (let mi = 4; mi < 6; mi++) {
      const movie = sampleMovies[mi]!;
      for (const time of showTimes) {
        try {
          await prisma.showtime.create({
            data: {
              movieTmdbId: movie.tmdbId,
              movieTitle: movie.title,
              screenId: screenIds[2]!,
              showDate: new Date(date),
              showTime: time,
              priceMultiplier: 1.5,
            },
          });
          showtimeCount++;
        } catch {
          // Skip duplicates on re-seed
        }
      }
    }
  }
  console.log(`✅ Showtimes: ${showtimeCount} created across 3 screens × 3 days`);

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
