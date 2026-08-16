import mongoose from 'mongoose';
import { Movie } from './src/schemas/movie.schemas';
import { syncMoviesFromTMDB } from './src/services/movie-sync.service';
import 'dotenv/config';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bookyourshow');
  console.log("Connected to MongoDB");
  await Movie.deleteMany({});
  console.log("Cleared movies collection");
  try {
    await syncMoviesFromTMDB();
    console.log("Sync complete");
  } catch (e: any) {
    console.log("Sync failed:", e.message);
  }
  await mongoose.disconnect();
}
run();
