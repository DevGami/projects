/**
 * Seed theaters for Ahmedabad and create showtimes for all movies.
 *
 * Run: npx tsx scripts/seed-city-showtimes.ts
 */
import { prisma } from '../src/config/database.js';
import mongoose from 'mongoose';
// We need to read movies from MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookyourshow';
const THEATERS = [
    {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'BookYourShow Cinemas - CG Road',
        city: 'Ahmedabad',
        address: 'CG Road, Ahmedabad, Gujarat 380009',
        screens: [
            { id: '00000000-0000-0000-0000-000000000101', name: 'Screen 1 - Standard', rows: 6, cols: 12 },
            { id: '00000000-0000-0000-0000-000000000102', name: 'Screen 2 - VIP', rows: 4, cols: 8 },
        ],
    },
    {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'PVR - Acropolis',
        city: 'Ahmedabad',
        address: 'Thaltej, Ahmedabad, Gujarat 380054',
        screens: [
            { id: '00000000-0000-0000-0000-000000000201', name: 'Screen 1 - IMAX', rows: 8, cols: 16 },
            { id: '00000000-0000-0000-0000-000000000202', name: 'Screen 2 - Gold', rows: 5, cols: 10 },
            { id: '00000000-0000-0000-0000-000000000203', name: 'Screen 3 - Standard', rows: 6, cols: 12 },
        ],
    },
];
const SEAT_LAYOUTS = [
    { rows: [0, 1], tier: 'Silver', price: 150 },
    { rows: [2, 3], tier: 'Gold', price: 250 },
    { rows: [4], tier: 'VIP', price: 400 },
];
const SCHEDULE_POOLS = [
    ['09:15 AM', '12:30 PM', '04:15 PM', '08:30 PM'],
    ['10:45 AM', '02:00 PM', '06:00 PM', '10:15 PM'],
    ['11:30 AM', '03:15 PM', '07:30 PM'],
    ['08:30 AM', '11:45 AM', '03:30 PM', '07:45 PM'],
    ['01:15 PM', '05:30 PM', '09:45 PM']
];
async function main() {
    await prisma.$connect();
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to PostgreSQL and MongoDB');
    // Fetch top movies from MongoDB (highest rated, now_showing)
    const Movie = mongoose.model('movies', new mongoose.Schema({}, { strict: false }));
    const allMovies = await Movie.find({ status: 'now_showing', isActive: true })
        .sort({ popularity: -1 })
        .lean();
    console.log(`📚 Found ${allMovies.length} now-showing movies`);
    if (allMovies.length === 0) {
        console.error('❌ Need at least 1 movie. Run TMDB sync first.');
        process.exit(1);
    }
    // 1. Upsert theaters and screens
    for (const theater of THEATERS) {
        await prisma.theater.upsert({
            where: { id: theater.id },
            create: {
                id: theater.id,
                name: theater.name,
                city: theater.city,
                address: theater.address,
                totalScreens: theater.screens.length,
            },
            update: {
                name: theater.name,
                city: theater.city,
                address: theater.address,
                totalScreens: theater.screens.length,
                isActive: true,
            },
        });
        for (const screen of theater.screens) {
            // Adapt seat layout to screen dimensions
            const layout = SEAT_LAYOUTS.filter(l => l.rows.every(r => r < screen.rows));
            await prisma.screen.upsert({
                where: { id: screen.id },
                create: {
                    id: screen.id,
                    theaterId: theater.id,
                    name: screen.name,
                    rows: screen.rows,
                    cols: screen.cols,
                    seatLayout: layout.length > 0 ? layout : SEAT_LAYOUTS,
                },
                update: {
                    name: screen.name,
                    rows: screen.rows,
                    cols: screen.cols,
                    seatLayout: layout.length > 0 ? layout : SEAT_LAYOUTS,
                },
            });
        }
        console.log(`🏪 ${theater.city}: ${theater.name} (${theater.screens.length} screens)`);
    }
    // 3. Create showtimes
    const allScreens = THEATERS.flatMap(t => t.screens.map(s => ({ screenId: s.id, city: t.city })));
    const today = new Date();
    const records = [];
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const showDate = new Date(today);
        showDate.setDate(today.getDate() + dayOffset);
        showDate.setHours(0, 0, 0, 0);
        for (const { screenId } of allScreens) {
            const pool = allMovies;
            // Each screen shows 2 movies per day (4 shows)
            const movieA = pool[(dayOffset) % pool.length];
            const movieB = pool[(dayOffset + 3) % pool.length];
            // Randomize schedule based on screen and day to make it look realistic
            const scheduleIdx = (screenId.charCodeAt(screenId.length - 1) + dayOffset) % SCHEDULE_POOLS.length;
            const showTimes = SCHEDULE_POOLS[scheduleIdx];
            showTimes.forEach((time, timeIdx) => {
                // Vary the movie played on this screen
                const movie = timeIdx % 2 === 0 ? movieA : movieB;
                records.push({
                    screenId,
                    movieTmdbId: movie.tmdbId,
                    movieTitle: movie.title,
                    showDate,
                    showTime: time,
                    priceMultiplier: timeIdx === showTimes.length - 1 ? '1.5' : timeIdx === 0 ? '0.9' : '1.2',
                    status: 'ACTIVE',
                });
            });
        }
    }
    // Delete old payments, bookings and showtimes
    await prisma.payment.deleteMany();
    await prisma.booking.deleteMany();
    const deletedOld = await prisma.showtime.deleteMany();
    console.log(`🗑️ Removed old payments, bookings and ${deletedOld.count} old showtimes`);
    const result = await prisma.showtime.createMany({
        data: records,
        skipDuplicates: true,
    });
    console.log(`✅ Created ${result.count} showtimes in Ahmedabad`);
    console.log(`  📍 Ahmedabad: ${allMovies.map(m => m.title).join(', ')}`);
    await prisma.$disconnect();
    await mongoose.disconnect();
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
