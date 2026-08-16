import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.bvojtizgtwsxmlcapkuh:Devgami%4017102005@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    }
  }
});

async function main() {
  const start = Date.now();
  const users = await prisma.user.findMany({ select: { name: true, email: true, role: true } });
  const theaters = await prisma.theater.findMany({ select: { name: true, city: true, totalScreens: true } });
  const screenCount = await prisma.screen.count();
  const latency = Date.now() - start;

  console.log(`\n======================================================`);
  console.log(`🟢 SUPABASE CLOUD POSTGRESQL: CONNECTED & 100% HEALTHY`);
  console.log(`⏱️ Round-Trip Latency: ${latency}ms (Region: Mumbai ap-south-1)`);
  console.log(`======================================================`);
  console.log(`👥 Registered Accounts (${users.length}):`);
  users.forEach(u => console.log(`   - [${u.role}] ${u.name} (${u.email})`));
  console.log(`\n🏢 Seated Theaters in Cloud (${theaters.length}):`);
  theaters.forEach(t => console.log(`   - ${t.name} (${t.city}) — ${t.totalScreens} screens`));
  console.log(`\n🎬 Total Active Screens in Cloud: ${screenCount}`);
  console.log(`======================================================\n`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Connection check failed:', err);
  process.exit(1);
});
