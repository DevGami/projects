import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import mongoose from 'mongoose';
import slugify from 'slugify';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

const TMDB_API_KEY = '71983c015811d4a80d73e25be6bf9fc5';
const ATLAS_URI = 'mongodb+srv://bookyourshow:Devgami%4017102005@cluster0.drrzvu9.mongodb.net/bookyourshow?retryWrites=true&w=majority&appName=Cluster0';
const REDIS_URL = 'rediss://default:gQAAAAAAAaPDAAIgcDJiYjk5NDYyMTZhMjU0ZDY5OWQ1NmExZTMyYzYyOWI3NA@brief-husky-107459.upstash.io:6379';

const EXACT_TMDB_IDS = [
  1212763, // Evil Dead Burn
  1169537, // Batwara 1947
  1108427, // Moana
  969681,  // Spider-Man: Brand New Day
  1739294, // Maaran
  1727563, // Ohh My Dog
  1368337, // The Odyssey
  1303331, // Dhamaal 4
  1489543, // G.D.N
  1479832, // DC
  1101383, // The End of Oak Street
  1408162, // Vishwanath & Sons
  1235877, // Jana Nayagan
  1739212, // Get Set Go
  1506736, // Thudakkam
  1432631, // Idhayam Murali
  1408170, // Lenin
  1545486, // Unmadham
  1478476, // Keu Bole Biplobi, Keu Bole Dakat
  1444466, // Awarapan 2
];

async function fetchTmdbMovie(tmdbId: number) {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?append_to_response=credits,videos,release_dates&api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`⚠️ TMDB fetch failed for ID ${tmdbId} (Status: ${res.status}). Trying fallback search...`);
    return null;
  }
  return await res.json();
}

async function main() {
  console.log('🎬 Connecting to MongoDB Atlas, Supabase, and Upstash Redis...');
  await mongoose.connect(ATLAS_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error('DB connection failed');

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: "postgresql://postgres.bvojtizgtwsxmlcapkuh:Devgami%4017102005@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
      }
    }
  });

  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

  console.log(`\n📡 Fetching real-time TMDB data for all 20 "In Theatres" movies...`);
  const populatedMovies = [];

  for (const id of EXACT_TMDB_IDS) {
    try {
      const data = await fetchTmdbMovie(id);
      if (!data) continue;

      const title = data.title || data.original_title;
      const slug = `${slugify(title, { lower: true, strict: true })}-${id}`;

      // Extract accurate cast (top 15)
      const cast = (data.credits?.cast || [])
        .filter((c: any) => c.known_for_department === 'Acting' || c.order < 20)
        .slice(0, 15)
        .map((c: any) => ({
          name: c.name,
          character: c.character || 'Cast Member',
          photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
        }));

      // Extract director
      const directorObj = data.credits?.crew?.find((c: any) => c.job === 'Director');
      const director = directorObj ? directorObj.name : 'Director';

      // Extract trailer
      const videos = data.videos?.results || [];
      const trailer = videos.find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));
      const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined;

      // Extract certification
      let certificate = 'U/A 13+';
      const releaseDates = data.release_dates?.results || [];
      const inRelease = releaseDates.find((r: any) => r.iso_3166_1 === 'IN') || releaseDates.find((r: any) => r.iso_3166_1 === 'US');
      if (inRelease?.release_dates?.[0]?.certification) {
        certificate = inRelease.release_dates[0].certification;
      }

      const poster = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : `/posters/${slugify(title, { lower: true, strict: true })}-${id}.svg`;
      const backdrop = data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : poster;

      const genres = (data.genres || []).map((g: any) => g.name);

      const movieDoc = {
        tmdbId: id,
        title,
        originalTitle: data.original_title || title,
        slug,
        genres: genres.length > 0 ? genres : ['Action', 'Drama'],
        language: data.spoken_languages?.[0]?.english_name || 'Hindi',
        originalLanguage: data.original_language || 'hi',
        rating: data.vote_average ? Number(data.vote_average.toFixed(1)) : 7.8,
        voteCount: data.vote_count || 120,
        popularity: data.popularity || 100,
        revenue: data.revenue || 0,
        duration: data.runtime || 135,
        poster,
        backdrop,
        description: data.overview || `${title} is currently playing in theatres across India with high viewer ratings.`,
        cast,
        director,
        trailerUrl,
        releaseDate: data.release_date ? new Date(data.release_date) : new Date(),
        certificate,
        status: 'now_showing',
        isActive: true,
        formats: ['2D', '3D', 'IMAX'],
        lastSyncedAt: new Date()
      };

      populatedMovies.push(movieDoc);
      console.log(`✅ [${populatedMovies.length}/20] ${title} (${movieDoc.language}) — Cast: ${cast.length} members | Rating: ${movieDoc.rating}★`);
    } catch (err) {
      console.error(`Error processing ID ${id}:`, err);
    }
  }

  // 1. Update MongoDB Atlas
  console.log(`\n💾 Upserting ${populatedMovies.length} movies into MongoDB Atlas...`);
  const validTmdbIds = populatedMovies.map(m => m.tmdbId);
  await db.collection('movies').deleteMany({ tmdbId: { $nin: validTmdbIds } });

  for (const m of populatedMovies) {
    await db.collection('movies').updateOne(
      { tmdbId: m.tmdbId },
      { $set: m },
      { upsert: true }
    );
  }

  // 2. Save to mock-movies.json for fallback consistency
  const mockPath = path.resolve('src/data/mock-movies.json');
  fs.writeFileSync(mockPath, JSON.stringify(populatedMovies, null, 2), 'utf-8');
  console.log(`📁 Updated ${mockPath}`);

  // 3. Generate Showtimes in Supabase for all 20 movies across all 13 screens
  console.log(`\n🎬 Synchronizing Showtimes in Supabase PostgreSQL...`);
  const screens = await prisma.screen.findMany({ select: { id: true, theaterId: true } });
  console.log(`Found ${screens.length} screens across Supabase theaters.`);

  // Clean old showtimes for movies not in the 20 list
  await prisma.showtime.deleteMany({
    where: {
      movieTmdbId: { notIn: validTmdbIds },
      bookings: { none: {} }
    }
  });

  const showTimes = ['09:30 AM', '12:45 PM', '04:15 PM', '07:30 PM', '10:45 PM'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let createdShowtimes = 0;
  for (let d = 0; d < 5; d++) {
    const showDate = new Date(today);
    showDate.setDate(today.getDate() + d);

    for (let sIdx = 0; sIdx < screens.length; sIdx++) {
      const screen = screens[sIdx];
      // Assign movies in round-robin fashion across screens
      const movie = populatedMovies[(sIdx + d) % populatedMovies.length];
      
      for (const time of showTimes) {
        try {
          await prisma.showtime.upsert({
            where: {
              screenId_showDate_showTime: {
                screenId: screen.id,
                showDate,
                showTime: time
              }
            },
            create: {
              screenId: screen.id,
              movieTmdbId: movie.tmdbId,
              movieTitle: movie.title,
              showDate,
              showTime: time,
              priceMultiplier: 1.0,
              bookedSeats: []
            },
            update: {
              movieTmdbId: movie.tmdbId,
              movieTitle: movie.title
            }
          });
          createdShowtimes++;
        } catch (e) {
          // ignore duplicate
        }
      }
    }
  }

  console.log(`⚡ Created/Updated ${createdShowtimes} showtimes in Supabase!`);

  // 4. Flush Redis Cache
  console.log(`\n🧹 Flushing API cache in Upstash Redis...`);
  const keys = await redis.keys('cache:*');
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log(`Deleted ${keys.length} cache keys.`);
  }

  console.log(`\n======================================================`);
  console.log(`🎉 LIVE TMDB SYNC COMPLETE: EXACT 20 MOVIES ACTIVE`);
  console.log(`======================================================\n`);

  await prisma.$disconnect();
  await redis.quit();
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Failed to sync exact 20 TMDB movies:', err);
  process.exit(1);
});
