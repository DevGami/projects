require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // Delete ALL future showtimes (today and forward) so catchup regenerates with new 20 movies
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const deleted = await p.showtime.deleteMany({
    where: {
      showDate: { gte: today },
      // Only delete if no confirmed bookings
      bookings: { none: { status: { in: ['CONFIRMED', 'PENDING'] } } }
    }
  });
  console.log('Deleted future showtimes (no confirmed bookings):', deleted.count);
  
  // Show what's left
  const remaining = await p.showtime.groupBy({
    by: ['showDate'],
    _count: true,
    orderBy: { showDate: 'asc' }
  });
  console.log('Remaining showtimes:');
  remaining.forEach(function(r) { console.log(' ', r.showDate.toISOString().split('T')[0], 'count:', r._count); });
  
  await p.$disconnect();
  console.log('Done! Restart the API to trigger showtime catchup with new movies.');
}

run().catch(function(e) { console.error(e); process.exit(1); });
