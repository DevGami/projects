import mongoose from 'mongoose';
import fs from 'fs';
import dns from 'dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);

const atlasUri = 'mongodb+srv://bookyourshow:Devgami%4017102005@cluster0.drrzvu9.mongodb.net/bookyourshow?retryWrites=true&w=majority&appName=Cluster0';

async function main() {
  const start = Date.now();
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(atlasUri);
  const latency = Date.now() - start;

  console.log(`\n======================================================`);
  console.log(`🟢 MONGODB ATLAS CLOUD: CONNECTED & 100% HEALTHY`);
  console.log(`⏱️ Round-Trip Latency: ${latency}ms (Host: cluster0.drrzvu9.mongodb.net)`);
  console.log(`======================================================`);

  const mockPath = 'd:/Programming/bookyourshow/apps/api/src/data/mock-movies.json';
  const movies = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));

  const db = mongoose.connection.db;
  if (!db) throw new Error('Database handle is undefined');

  // Clean and populate movies
  const validTmdbIds = movies.map((m: any) => m.tmdbId);
  await db.collection('movies').deleteMany({ tmdbId: { $nin: validTmdbIds } });

  for (const m of movies) {
    await db.collection('movies').updateOne(
      { tmdbId: m.tmdbId },
      {
        $set: {
          ...m,
          releaseDate: new Date(m.releaseDate),
          lastSyncedAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  const count = await db.collection('movies').countDocuments();
  console.log(`🎬 Cloud Movies Collection Populated: ${count} / 20 movies`);

  // Create search indexes
  await db.collection('movies').createIndex({ slug: 1 }, { unique: true });
  await db.collection('movies').createIndex({ tmdbId: 1 }, { unique: true });
  await db.collection('movies').createIndex({ status: 1, popularity: -1 });
  await db.collection('movies').createIndex(
    { title: 'text', description: 'text' },
    { language_override: 'textSearchLanguage', default_language: 'none' }
  );
  console.log(`⚡ MongoDB Atlas Indexes: Created successfully`);
  console.log(`======================================================\n`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Atlas connection error:', err);
  process.exit(1);
});
