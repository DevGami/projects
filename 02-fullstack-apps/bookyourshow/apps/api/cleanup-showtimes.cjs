require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // Delete all showtimes referencing old movies (Deadpool, Inside Out 2, Despicable Me 4)
  const oldTmdbIds = [533535, 1022789, 519182];
  
  const deleted = await p.showtime.deleteMany({
    where: { movieTmdbId: { in: oldTmdbIds } }
  });
  console.log('Deleted old showtimes:', deleted.count);
  
  // Show what's left
  const remaining = await p.showtime.groupBy({
    by: ['showDate'],
    _count: true,
    orderBy: { showDate: 'asc' }
  });
  remaining.forEach(function(r) { console.log(r.showDate.toISOString().split('T')[0], 'count:', r._count); });
  console.log('Total remaining:', remaining.reduce(function(s,r){return s+r._count;}, 0));
  
  await p.$disconnect();
}

run().catch(function(e) { console.error(e); process.exit(1); });
