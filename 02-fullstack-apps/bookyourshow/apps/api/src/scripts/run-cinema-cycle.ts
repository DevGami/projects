import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import mongoose from 'mongoose';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { getVisibleDates, generateShowtimesForDates, catchUpShowtimes } from '../services/showtime-generator.service.js';

const ATLAS_URI = 'mongodb+srv://bookyourshow:Devgami%4017102005@cluster0.drrzvu9.mongodb.net/bookyourshow?retryWrites=true&w=majority&appName=Cluster0';
const REDIS_URL = 'rediss://default:gQAAAAAAAaPDAAIgcDJiYjk5NDYyMTZhMjU0ZDY5OWQ1NmExZTMyYzYyOWI3NA@brief-husky-107459.upstash.io:6379';

async function main() {
  console.log('Connecting to databases...');
  await mongoose.connect(ATLAS_URI);
  const redis = new Redis(REDIS_URL);
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: "postgresql://postgres.bvojtizgtwsxmlcapkuh:Devgami%4017102005@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
      }
    }
  });

  const visibleDates = getVisibleDates();
  console.log('\n📅 Current Visible Dates according to Real-World Cinema Cycle (IST):', visibleDates);

  // Clean old showtimes for clean generation
  console.log('\n🧹 Clearing existing unbooked showtimes...');
  await prisma.showtime.deleteMany({
    where: { bookings: { none: {} } }
  });

  console.log('⚡ Generating realistic showtimes for visible dates...');
  const count = await generateShowtimesForDates(visibleDates);
  console.log(`✅ Generated ${count} realistic showtimes across screens!`);

  // Flush Redis cache
  const keys = await redis.keys('bys:showtimes:*');
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log(`Deleted ${keys.length} showtime cache keys in Redis.`);
  }

  await prisma.$disconnect();
  await redis.quit();
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
