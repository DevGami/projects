import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// Real Ahmedabad Theaters
// ═══════════════════════════════════════════════════════════════════════════
interface TheaterDef {
  id: string;
  name: string;
  address: string;
  screens: ScreenDef[];
}

interface ScreenDef {
  id: string;
  name: string;
  format: string; // Standard, IMAX, 3D, 4DX
  rows: number;
  cols: number;
  seatLayout: { tier: string; rows: number[]; price: number }[];
}

// 4-tier layout: Classic (3 rows) → Prime (3 rows) → Prime Plus (2 rows) → Recliner (1 row)
function standardLayout(basePrice: number): ScreenDef['seatLayout'] {
  return [
    { tier: 'Classic',    rows: [0, 1, 2],    price: basePrice },
    { tier: 'Prime',      rows: [3, 4, 5],    price: Math.round(basePrice * 1.5) },
    { tier: 'Prime Plus', rows: [6, 7],       price: Math.round(basePrice * 2.0) },
    { tier: 'Recliner',   rows: [9],          price: Math.round(basePrice * 3.0) }, // row 9 = J, gap at row 8
  ];
}

const THEATERS: TheaterDef[] = [
  {
    id: '00000000-0000-0000-0001-000000000001',
    name: 'PVR INOX — Acropolis Mall',
    address: 'Acropolis Mall, 3rd Floor, Thaltej Cross Road, SG Highway, Ahmedabad 380054',
    screens: [
      {
        id: '00000000-0000-0000-0001-000000000101',
        name: 'Screen 1',
        format: 'Standard',
        rows: 10, cols: 16,
        seatLayout: standardLayout(150),
      },
      {
        id: '00000000-0000-0000-0001-000000000102',
        name: 'Screen 2',
        format: 'Standard',
        rows: 10, cols: 16,
        seatLayout: standardLayout(150),
      },
      {
        id: '00000000-0000-0000-0001-000000000103',
        name: 'Screen 3 — IMAX',
        format: 'IMAX',
        rows: 10, cols: 18,
        seatLayout: standardLayout(200),
      },
    ],
  },
  {
    id: '00000000-0000-0000-0002-000000000001',
    name: 'INOX — Palladium Mall',
    address: 'Palladium Mall, 1st Floor, 136 ft Ring Road, Prahladnagar, Ahmedabad 380015',
    screens: [
      {
        id: '00000000-0000-0000-0002-000000000101',
        name: 'Screen 1',
        format: 'Standard',
        rows: 10, cols: 14,
        seatLayout: standardLayout(140),
      },
      {
        id: '00000000-0000-0000-0002-000000000102',
        name: 'Screen 2 — 3D',
        format: '3D',
        rows: 10, cols: 16,
        seatLayout: standardLayout(170),
      },
      {
        id: '00000000-0000-0000-0002-000000000103',
        name: 'Screen 3 — IMAX',
        format: 'IMAX',
        rows: 10, cols: 18,
        seatLayout: standardLayout(210),
      },
    ],
  },
  {
    id: '00000000-0000-0000-0003-000000000001',
    name: 'Cinépolis — Ahmedabad One Mall',
    address: 'Ahmedabad One Mall, 3rd Floor, Vastrapur Lake Road, Vastrapur, Ahmedabad 380015',
    screens: [
      {
        id: '00000000-0000-0000-0003-000000000101',
        name: 'Screen 1',
        format: 'Standard',
        rows: 10, cols: 14,
        seatLayout: standardLayout(160),
      },
      {
        id: '00000000-0000-0000-0003-000000000102',
        name: 'Screen 2 — Macro XL',
        format: 'IMAX',
        rows: 10, cols: 18,
        seatLayout: standardLayout(220),
      },
      {
        id: '00000000-0000-0000-0003-000000000103',
        name: 'Screen 3 — 4DX',
        format: '4DX',
        rows: 10, cols: 12,
        seatLayout: standardLayout(250),
      },
    ],
  },
  {
    id: '00000000-0000-0000-0004-000000000001',
    name: 'PVR INOX — Motera',
    address: 'Sardar Patel Stadium Complex, Motera, Ahmedabad 380005',
    screens: [
      {
        id: '00000000-0000-0000-0004-000000000101',
        name: 'Screen 1',
        format: 'Standard',
        rows: 10, cols: 14,
        seatLayout: standardLayout(130),
      },
      {
        id: '00000000-0000-0000-0004-000000000102',
        name: 'Screen 2',
        format: 'Standard',
        rows: 10, cols: 14,
        seatLayout: standardLayout(130),
      },
    ],
  },
  {
    id: '00000000-0000-0000-0005-000000000001',
    name: 'Rajhans Cineplex — Naranpura',
    address: 'Rajhans Complex, Naranpura Cross Rd, Naranpura, Ahmedabad 380013',
    screens: [
      {
        id: '00000000-0000-0000-0005-000000000101',
        name: 'Screen 1',
        format: 'Standard',
        rows: 10, cols: 14,
        seatLayout: standardLayout(120),
      },
      {
        id: '00000000-0000-0000-0005-000000000102',
        name: 'Screen 2',
        format: 'Standard',
        rows: 10, cols: 14,
        seatLayout: standardLayout(120),
      },
    ],
  },
];

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

  // ── Clean old theaters & screens ────────────────────────────
  // Must delete in correct FK order: payments → bookings → showtimes → screens → theaters
  await prisma.payment.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.showtime.deleteMany({});
  await prisma.screen.deleteMany({});
  await prisma.theater.deleteMany({});
  console.log('🗑️  Cleared old theaters, screens, showtimes, bookings, and payments');

  // ── Create Theaters & Screens ───────────────────────────────
  for (const t of THEATERS) {
    const theater = await prisma.theater.create({
      data: {
        id: t.id,
        name: t.name,
        city: 'Ahmedabad',
        address: t.address,
        totalScreens: t.screens.length,
      },
    });
    console.log(`✅ Theater: ${theater.name} (${t.screens.length} screens)`);

    for (const s of t.screens) {
      await prisma.screen.create({
        data: {
          id: s.id,
          theaterId: theater.id,
          name: s.name,
          rows: s.rows,
          cols: s.cols,
          seatLayout: s.seatLayout,
        },
      });
      console.log(`   📺 ${s.name} (${s.format}) — ${s.rows} rows × ${s.cols} cols`);
    }
  }

  console.log('\n🎉 Seed completed successfully!');
  console.log('💡 Run the showtime generator to populate shows: npx tsx src/cron/generate-showtimes-now.ts');
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
