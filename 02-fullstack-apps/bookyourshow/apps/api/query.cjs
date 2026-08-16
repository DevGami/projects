const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const count = await prisma.showtime.count();
  console.log('Total showtimes:', count);
  
  const sample = await prisma.showtime.findMany({ take: 2 });
  console.log('Sample:', sample);
}
run().finally(() => prisma.$disconnect());
