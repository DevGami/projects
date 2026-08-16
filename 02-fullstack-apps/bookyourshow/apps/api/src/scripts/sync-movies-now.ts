import { syncMoviesFromTMDB } from '../services/movie-sync.service.js';
import { connectMongoDB } from '../config/mongodb.js';
import { redis } from '../config/redis.js';

async function main() {
  await connectMongoDB();
  await syncMoviesFromTMDB();
  console.log('Sync complete');
  redis.quit();
  process.exit(0);
}

main().catch(console.error);

main().catch(console.error);
