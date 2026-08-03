import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

// ── Prisma Client Singleton ─────────────────────────────────────────────────
// Prevents multiple instances during hot-reload in development

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
    datasourceUrl: env.DATABASE_URL,
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// ── Connection Test ─────────────────────────────────────────────────────────
export async function connectPostgres(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected');
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
    throw error;
  }
}

export async function disconnectPostgres(): Promise<void> {
  await prisma.$disconnect();
  console.log('🔌 PostgreSQL disconnected');
}
