import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import { connectPostgres } from './config/database.js';
import { connectMongoDB } from './config/mongodb.js';
import { connectRedis } from './config/redis.js';
import { connectKafka } from './config/kafka.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { logger } from './middleware/logger.js';

// Routes
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import movieRoutes from './routes/movie.routes.js';
import theaterRoutes from './routes/theater.routes.js';
import showtimeRoutes from './routes/showtime.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import adminRoutes from './routes/admin.routes.js';
import aiRoutes from './routes/ai.routes.js';

// Cron Jobs
import { startMovieSyncCron } from './cron/movie-sync.cron.js';
import { startShowtimeScheduler } from './cron/showtime-scheduler.cron.js';
import { startBookingExpiryJob } from './cron/booking-expiry.cron.js';

// ── Express App ─────────────────────────────────────────────────────────────
const app = express();

// ── Security Middleware ────────────────────────────────────────────────────────────
app.use(helmet({
  // Allow cross-origin image loading (TMDB posters)
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Strict referrer in prod, relaxed in dev
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  // Disable MIME sniffing
  noSniff: true,
  // XSS filter for older browsers
  xssFilter: true,
  // HSTS — only in production (not localhost)
  hsts: env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        // reCAPTCHA v3
        'https://www.google.com',
        'https://www.gstatic.com',
      ],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://image.tmdb.org', 'https://lh3.googleusercontent.com'],
      connectSrc: ["'self'", env.FRONTEND_URL],
      frameSrc: [
        // reCAPTCHA iframe
        'https://www.google.com',
        'https://recaptcha.google.com',
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
}));

// Additional headers not covered by helmet
app.use((_req, res, next) => {
  // Disable browser features we don't need
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  // Prevent caching of sensitive API responses
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Build allowed CORS origins based on environment
const CORS_ORIGINS = process.env.NODE_ENV === 'production'
  ? [env.FRONTEND_URL].filter(Boolean) // production: only the deployed frontend
  : [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (CORS_ORIGINS.includes(origin)) return callback(null, true);
    logger.warn(`CORS blocked origin: ${origin}`);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));


// ── Rate Limiting ───────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute
  max: 100,                // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT', message: 'Too many requests. Please try again later.' },
  },
});

app.use(globalLimiter);

// ── Body Parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ── HTTP Logging ────────────────────────────────────────────────────────────
app.use(morgan('dev', {
  stream: { write: (message: string) => logger.info(message.trim()) },
}));


// ── Booking Rate Limiter — prevent seat hoarding bots ───────────────────────
const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,               // 10 booking attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'BOOKING_RATE_LIMIT', message: 'Too many booking requests. Please slow down.' },
  },
});

// ── Payment Rate Limiter ────────────────────────────────────────────────────
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,               // 15 payment requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'PAYMENT_RATE_LIMIT', message: 'Too many payment requests. Please slow down.' },
  },
});

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/movies', movieRoutes);
app.use('/api/v1/theaters', theaterRoutes);
app.use('/api/v1/showtimes', showtimeRoutes);
app.use('/api/v1/bookings', bookingLimiter, bookingRoutes);
app.use('/api/v1/payments', paymentLimiter, paymentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/ai', aiRoutes);


// ── Error Handling ──────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start Server ────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  try {
    logger.info('🚀 Starting BookYourShow API...');

    // Connect to all databases
    await connectPostgres();
    await connectMongoDB();
    await connectRedis();
    await connectKafka();

    // Start HTTP server
    // Start cron jobs
    startMovieSyncCron();
    startShowtimeScheduler();
    startBookingExpiryJob();

    app.listen(env.API_PORT, () => {
      logger.info(`✅ API running on http://localhost:${env.API_PORT}`);
      logger.info(`📡 Health check: http://localhost:${env.API_PORT}/api/v1/health`);
      logger.info(`🎬 Movies: http://localhost:${env.API_PORT}/api/v1/movies`);
      logger.info(`🌍 Environment: ${env.NODE_ENV}`);

      // ── Cache Warm-Up ───────────────────────────────────────────────────
      // Pre-populate now-showing and movies list caches after server boots.
      // Runs asynchronously so it never delays startup.
      warmUpCache().catch((err) => logger.warn('Cache warm-up failed (non-fatal):', err));
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// ── Cache Warm-Up ────────────────────────────────────────────────────────────
// Called once after server starts. Hits internal API endpoints to populate
// Redis cache so first real user gets a fast cached response.
async function warmUpCache(): Promise<void> {
  const base = `http://localhost:${env.API_PORT}/api/v1`;
  const cities = ['Ahmedabad', 'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune'];

  logger.info('🔥 Warming up Redis cache...');

  const urls = [
    `${base}/movies/now-showing`,                // no-city fallback (also warms MongoDB cold start)
    ...cities.map((c) => `${base}/movies/now-showing?city=${encodeURIComponent(c)}`),
    `${base}/movies?sort=rating&order=desc&page=1&limit=12`,
  ];

  let warmed = 0;
  for (const url of urls) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(10_000) });
      warmed++;
    } catch {
      // Non-fatal — cache warm-up is best-effort
    }
  }

  logger.info(`🔥 Cache warm-up complete: ${warmed}/${urls.length} endpoints warmed`);
}

// ── Graceful Shutdown ───────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info(`\n${signal} received. Shutting down gracefully...`);

  const { disconnectPostgres } = await import('./config/database.js');
  const { disconnectMongoDB } = await import('./config/mongodb.js');
  const { disconnectRedis } = await import('./config/redis.js');
  const { disconnectKafka } = await import('./config/kafka.js');

  await disconnectPostgres();
  await disconnectMongoDB();
  await disconnectRedis();
  await disconnectKafka();

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Launch ──────────────────────────────────────────────────────────────────
bootstrap();

export default app;
