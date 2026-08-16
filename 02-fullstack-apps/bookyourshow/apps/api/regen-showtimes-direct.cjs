require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');
const p = new PrismaClient();

// Showtime slots for weekdays
const WEEKDAY_SLOTS = [
  { time: '09:30 AM', priceMultiplier: 0.85 },
  { time: '12:45 PM', priceMultiplier: 1.00 },
  { time: '04:00 PM', priceMultiplier: 1.00 },
  { time: '07:15 PM', priceMultiplier: 1.15 },
  { time: '10:00 PM', priceMultiplier: 1.25 },
];

const WEEKEND_SLOTS = [
  { time: '09:00 AM', priceMultiplier: 0.90 },
  { time: '10:30 AM', priceMultiplier: 1.00 },
  { time: '12:30 PM', priceMultiplier: 1.10 },
  { time: '01:45 PM', priceMultiplier: 1.10 },
  { time: '03:30 PM', priceMultiplier: 1.10 },
  { time: '05:00 PM', priceMultiplier: 1.15 },
  { time: '07:00 PM', priceMultiplier: 1.25 },
  { time: '09:00 PM', priceMultiplier: 1.30 },
  { time: '10:30 PM', priceMultiplier: 1.35 },
];

function getVisibleDates() {
  // IST offset: UTC+5:30
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const now = new Date(Date.now() + IST_OFFSET_MS);
  const todayIST = new Date(now);
  todayIST.setUTCHours(0, 0, 0, 0);
  
  const dayOfWeek = todayIST.getUTCDay(); // 0=Sun
  const hourIST = now.getUTCHours();
  
  const dates = [];
  // Always include today
  const yyyy = todayIST.getUTCFullYear();
  const mm = String(todayIST.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(todayIST.getUTCDate()).padStart(2, '0');
  dates.push(`${yyyy}-${mm}-${dd}`);
  
  // Walk forward 7 days
  for (let offset = 1; offset <= 7; offset++) {
    const futureDate = new Date(todayIST);
    futureDate.setUTCDate(todayIST.getUTCDate() + offset);
    const futureDow = futureDate.getUTCDay();
    
    // Check if release date has passed
    let releaseDate = new Date(futureDate);
    
    if (futureDow >= 1 && futureDow <= 3) {
      // Mon/Tue/Wed: visible after Sunday 12PM IST
      // releaseDate = preceding Sunday 12PM IST
      releaseDate.setUTCDate(futureDate.getUTCDate() - futureDow);
      releaseDate.setUTCHours(6, 30, 0, 0); // Sunday 12PM IST = 06:30 UTC
    } else if (futureDow === 4 || futureDow === 5) {
      // Thu/Fri: visible after Wednesday 6PM IST = 12:30 UTC
      releaseDate.setUTCDate(futureDate.getUTCDate() - (futureDow - 3));
      releaseDate.setUTCHours(12, 30, 0, 0);
    } else if (futureDow === 6 || futureDow === 0) {
      // Sat/Sun: visible after Friday 6PM IST = 12:30 UTC
      const daysToSubtract = futureDow === 6 ? 1 : 2;
      releaseDate.setUTCDate(futureDate.getUTCDate() - daysToSubtract);
      releaseDate.setUTCHours(12, 30, 0, 0);
    }
    
    const nowUTC = new Date(Date.now());
    if (nowUTC >= releaseDate) {
      const fy = futureDate.getUTCFullYear();
      const fm = String(futureDate.getUTCMonth() + 1).padStart(2, '0');
      const fd = String(futureDate.getUTCDate()).padStart(2, '0');
      dates.push(`${fy}-${fm}-${fd}`);
    }
  }
  
  return dates;
}

function getScreenFormat(screenName) {
  const name = screenName.toLowerCase();
  if (name.includes('imax') || name.includes('macro')) return 'IMAX';
  if (name.includes('4dx')) return '4DX';
  if (name.includes('3d')) return '3D';
  return 'Standard';
}

function movieSupportsFormat(movieFormats, screenFormat) {
  if (screenFormat === 'Standard') return true;
  return (movieFormats || ['2D']).includes(screenFormat);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const movieSchema = new mongoose.Schema({
    tmdbId: Number, title: String, formats: [String],
    popularity: Number, status: String, isActive: Boolean
  }, { timestamps: true });
  const Movie = mongoose.models.Movie || mongoose.model('Movie', movieSchema, 'movies');
  
  const visibleDates = getVisibleDates();
  console.log('Visible dates (IST):', visibleDates);
  
  // Find dates already covered
  const existingDates = await p.showtime.groupBy({
    by: ['showDate'],
    where: { showDate: { in: visibleDates.map(d => new Date(d)) } },
  });
  const existingSet = new Set(existingDates.map(d => d.showDate.toISOString().split('T')[0]));
  
  const missingDates = visibleDates.filter(d => !existingSet.has(d));
  console.log('Dates already covered:', [...existingSet]);
  console.log('Missing dates to generate:', missingDates);
  
  if (missingDates.length === 0) {
    console.log('All dates already covered!');
    await mongoose.disconnect();
    await p.$disconnect();
    return;
  }
  
  // Fetch screens
  const screens = await p.screen.findMany({
    where: { isActive: true },
    include: { theater: true }
  });
  console.log('Active screens:', screens.length);
  
  // Fetch movies
  const movies = await Movie.find({ status: 'now_showing', isActive: true }).sort({ popularity: -1 }).lean();
  console.log('Now showing movies:', movies.length, movies.map(m => m.title).join(', '));
  
  let totalCreated = 0;
  
  for (const dateStr of missingDates) {
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
    const slots = isWeekend ? WEEKEND_SLOTS : WEEKDAY_SLOTS;
    
    let movieIndex = 0;
    
    for (const screen of screens) {
      const screenFormat = getScreenFormat(screen.name);
      const compatibleMovies = movies.filter(m => movieSupportsFormat(m.formats, screenFormat));
      if (compatibleMovies.length === 0) continue;
      
      const movie = compatibleMovies[movieIndex % compatibleMovies.length];
      movieIndex++;
      
      const screenSlots = isWeekend ? slots : (screen.theater.totalScreens <= 2 ? slots.slice(0, 4) : slots);
      
      for (const slot of screenSlots) {
        try {
          await p.showtime.create({
            data: {
              movieTmdbId: movie.tmdbId,
              movieTitle: movie.title,
              screenId: screen.id,
              showDate: dateObj,
              showTime: slot.time,
              priceMultiplier: slot.priceMultiplier,
              bookedSeats: [],
            }
          });
          totalCreated++;
        } catch (err) {
          if (err.code !== 'P2002') {
            console.warn('Failed to create showtime:', err.message);
          }
        }
      }
    }
    console.log(`Generated showtimes for ${dateStr}`);
  }
  
  console.log('Total showtimes created:', totalCreated);
  
  // Summary
  const summary = await p.showtime.groupBy({
    by: ['showDate'],
    _count: true,
    where: { showDate: { gte: new Date(new Date().setHours(0,0,0,0)) } },
    orderBy: { showDate: 'asc' }
  });
  console.log('Current+Future showtimes summary:');
  summary.forEach(function(r) { console.log(' ', r.showDate.toISOString().split('T')[0], 'count:', r._count); });
  
  await mongoose.disconnect();
  await p.$disconnect();
}

run().catch(function(e) { console.error(e); process.exit(1); });
