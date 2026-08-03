import { syncMoviesFromTMDB } from '../src/services/movie-sync.service.js';
import mongoose from 'mongoose';
import { prisma } from '../src/config/database.js';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bookyourshow');
  await prisma.$connect();
  
  console.log('Syncing movies from TMDB...');
  const res = await syncMoviesFromTMDB();
  console.log('Sync result:', res);
  
  await mongoose.disconnect();
  await prisma.$disconnect();
}

main().catch(console.error);
