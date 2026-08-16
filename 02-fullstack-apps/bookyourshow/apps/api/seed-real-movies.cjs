require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const mockMovies = require('./src/data/mock-movies.json');
  const TMDB_BASE = 'https://image.tmdb.org/t/p';

  const movieSchema = new mongoose.Schema({
    tmdbId: Number, title: String, slug: String, genres: [String],
    language: String, originalLanguage: String,
    rating: Number, voteCount: Number, popularity: Number, revenue: Number, budget: Number,
    duration: Number, poster: String, backdrop: String, description: String,
    cast: mongoose.Schema.Types.Mixed, director: String, trailerUrl: String,
    releaseDate: Date, certificate: String, status: String, isActive: Boolean,
    formats: [String], lastSyncedAt: Date
  }, { timestamps: true });

  // Use existing model or create
  const Movie = mongoose.models.Movie || mongoose.model('Movie', movieSchema, 'movies');

  const mockTmdbIds = mockMovies.map(function(m) { return m.tmdbId; });

  // Mark old movies as ended
  const ended = await Movie.updateMany(
    { tmdbId: { $nin: mockTmdbIds }, status: 'now_showing' },
    { $set: { status: 'ended', lastSyncedAt: new Date() } }
  );
  console.log('Marked as ended:', ended.modifiedCount);

  let added = 0, updated = 0;
  for (const m of mockMovies) {
    const data = Object.assign({}, m, {
      poster: m.poster ? TMDB_BASE + '/w500' + m.poster : null,
      backdrop: m.backdrop ? TMDB_BASE + '/w1280' + m.backdrop : null,
      releaseDate: m.releaseDate ? new Date(m.releaseDate) : null,
      lastSyncedAt: new Date()
    });

    const existing = await Movie.findOne({ tmdbId: m.tmdbId });
    if (existing) {
      await Movie.updateOne({ tmdbId: m.tmdbId }, { $set: data });
      updated++;
    } else {
      await Movie.create(data);
      added++;
    }
  }

  const total = await Movie.countDocuments({ status: 'now_showing' });
  console.log('Added:', added, 'Updated:', updated, 'Total now_showing:', total);

  const all = await Movie.find({ status: 'now_showing' }, { tmdbId: 1, title: 1, poster: 1 }).lean();
  all.forEach(function(m) { console.log(m.tmdbId, m.title, m.poster ? 'HAS_POSTER' : 'NO_POSTER'); });

  await mongoose.disconnect();
  console.log('Done!');
}

run().catch(function(e) { console.error(e); process.exit(1); });
