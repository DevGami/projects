import mongoose from 'mongoose';
import fs from 'fs';
import { redis, connectRedis, disconnectRedis } from '../config/redis.js';

async function updateDb() {
  await mongoose.connect('mongodb://bookyourshow:bys_dev_2026@localhost:27017/bookyourshow?authSource=admin');
  const db = mongoose.connection.db;
  const mockData = JSON.parse(fs.readFileSync('d:/Programming/bookyourshow/apps/api/src/data/mock-movies.json', 'utf-8'));
  
  for (const m of mockData) {
    const poster = m.poster ? 'https://image.tmdb.org/t/p/w500' + m.poster : null;
    const backdrop = m.backdrop ? 'https://image.tmdb.org/t/p/w1280' + m.backdrop : null;
    await db.collection('movies').updateOne(
      { tmdbId: m.tmdbId },
      {
        $set: {
          title: m.title,
          slug: m.slug,
          genres: m.genres,
          language: m.language,
          originalLanguage: m.originalLanguage,
          rating: m.rating,
          voteCount: m.voteCount,
          popularity: m.popularity,
          revenue: m.revenue,
          budget: m.budget,
          duration: m.duration,
          poster: poster,
          backdrop: backdrop,
          description: m.description,
          cast: m.cast,
          director: m.director,
          trailerUrl: m.trailerUrl,
          releaseDate: new Date(m.releaseDate),
          certificate: m.certificate,
          formats: m.formats,
          status: 'now_showing',
          isActive: true,
          lastSyncedAt: new Date()
        }
      },
      { upsert: true }
    );
  }
  console.log('✅ Updated all', mockData.length, 'movies in MongoDB with verified posters and cast!');
  
  // Flush redis cache
  await connectRedis();
  await redis.flushall();
  console.log('✅ Redis cache flushed!');
  await disconnectRedis();
  
  await mongoose.disconnect();
  process.exit(0);
}

updateDb().catch((e) => {
  console.error(e);
  process.exit(1);
});
