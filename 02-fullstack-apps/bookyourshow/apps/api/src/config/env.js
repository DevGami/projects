import { z } from 'zod';
import 'dotenv/config';
// ── Environment Schema ──────────────────────────────────────────────────────
const envSchema = z.object({
    // Server
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_PORT: z.coerce.number().default(5000),
    API_URL: z.string().url().default('http://localhost:5000'),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
    // PostgreSQL
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    // MongoDB
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    // Redis
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    // JWT
    JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
    JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
    JWT_ACCESS_EXPIRY: z.string().default('15m'),
    JWT_REFRESH_EXPIRY: z.string().default('7d'),
    // TMDB (optional for M01, required for M03)
    TMDB_API_KEY: z.string().optional(),
    TMDB_BASE_URL: z.string().url().default('https://api.themoviedb.org/3'),
    // Razorpay (optional for M01, required for M11)
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    // Groq (optional for M01, required for M10)
    GROQ_API_KEY: z.string().optional(),
    // Google OAuth (optional)
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    // SMTP (for OTP emails — MailHog in dev)
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().default(1025),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    // Kafka (optional for M01, required for M06)
    KAFKA_BROKERS: z.string().default('localhost:9092'),
});
// ── Parse & Validate ────────────────────────────────────────────────────────
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}
export const env = parsed.data;
