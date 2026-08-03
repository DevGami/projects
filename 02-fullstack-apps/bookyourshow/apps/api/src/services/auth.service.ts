import { hash, verify } from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../middleware/logger.js';
import type { Role } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// Argon2id Configuration
// ═══════════════════════════════════════════════════════════════════════════
const ARGON2_OPTIONS = {
  type: 2 as const,   // argon2id
  memoryCost: 19456,  // 19 MB (lowered to prevent memory allocation errors during dev testing)
  timeCost: 2,
  parallelism: 1,
};

// ═══════════════════════════════════════════════════════════════════════════
// Password Hashing
// ═══════════════════════════════════════════════════════════════════════════
export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

// ═══════════════════════════════════════════════════════════════════════════
// JWT Token Generation
// ═══════════════════════════════════════════════════════════════════════════
interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
  } catch {
    throw new AppError('Invalid or expired access token', 401, 'TOKEN_INVALID');
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    throw new AppError('Invalid or expired refresh token', 401, 'REFRESH_TOKEN_INVALID');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Refresh Token Storage (DB + Redis blacklist)
// ═══════════════════════════════════════════════════════════════════════════
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
}

export async function rotateRefreshToken(
  oldToken: string,
  userId: string,
  newPayload: JwtPayload
): Promise<{ accessToken: string; refreshToken: string }> {
  const oldTokenHash = hashToken(oldToken);

  // Find the old token
  const existingToken = await prisma.refreshToken.findFirst({
    where: {
      userId,
      tokenHash: oldTokenHash,
    },
  });

  if (!existingToken) {
    throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
  }

  if (existingToken.revoked) {
    let withinGracePeriod = false;

    // If it was replaced, check when the replacement was created
    if (existingToken.replacedBy) {
      const replacementToken = await prisma.refreshToken.findUnique({
        where: { id: existingToken.replacedBy },
      });
      if (replacementToken) {
        const timeSinceRevoked = Date.now() - replacementToken.createdAt.getTime();
        if (timeSinceRevoked < 30000) { // 30 seconds grace period
          withinGracePeriod = true;
          logger.info(`Token grace period invoked for user ${userId} (${timeSinceRevoked}ms)`);
        }
      }
    }

    if (!withinGracePeriod) {
      // Possible token reuse attack — revoke ALL tokens for this user
      logger.warn(`Possible token reuse attack for user ${userId}`);
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { revoked: true },
      });
      throw new AppError('Token reuse detected. All sessions have been revoked.', 401, 'TOKEN_REUSE');
    }
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken(newPayload);
  const newRefreshToken = generateRefreshToken(newPayload);
  const newTokenHash = hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Create new token and revoke old one in a transaction
  const newTokenRecord = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: newTokenHash,
      expiresAt,
    },
  });

  await prisma.refreshToken.update({
    where: { id: existingToken.id },
    data: {
      revoked: true,
      replacedBy: newTokenRecord.id,
    },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function revokeRefreshToken(token: string, userId: string): Promise<void> {
  const tokenHash = hashToken(token);

  await prisma.refreshToken.updateMany({
    where: {
      userId,
      tokenHash,
      revoked: false,
    },
    data: { revoked: true },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Account Lockout (Redis-backed)
// ═══════════════════════════════════════════════════════════════════════════
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds

export async function checkAccountLocked(email: string): Promise<void> {
  const attempts = await redis.get(`bys:login_attempts:${email}`);
  if (attempts && parseInt(attempts) >= MAX_LOGIN_ATTEMPTS) {
    const ttl = await redis.ttl(`bys:login_attempts:${email}`);
    throw new AppError(
      `Account locked due to too many failed attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`,
      429,
      'ACCOUNT_LOCKED'
    );
  }
}

export async function recordFailedLogin(email: string): Promise<void> {
  const key = `bys:login_attempts:${email}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) {
    await redis.expire(key, LOCKOUT_DURATION);
  }

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    // Also update PostgreSQL
    await prisma.user.updateMany({
      where: { email },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: new Date(Date.now() + LOCKOUT_DURATION * 1000),
      },
    });
  }
}

export async function clearFailedLogins(email: string): Promise<void> {
  await redis.del(`bys:login_attempts:${email}`);
  await prisma.user.updateMany({
    where: { email },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Verification & Reset Tokens
// ═══════════════════════════════════════════════════════════════════════════
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createVerificationToken(
  userId: string,
  type: 'EMAIL_VERIFY' | 'PASSWORD_RESET'
): Promise<string> {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + (type === 'EMAIL_VERIFY' ? 24 : 1) * 60 * 60 * 1000);

  await prisma.verificationToken.create({
    data: {
      userId,
      tokenHash,
      type,
      expiresAt,
    },
  });

  return token;
}

export async function validateVerificationToken(
  token: string,
  type: 'EMAIL_VERIFY' | 'PASSWORD_RESET'
): Promise<string> {
  const tokenHash = hashToken(token);

  const record = await prisma.verificationToken.findFirst({
    where: {
      tokenHash,
      type,
      used: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) {
    throw new AppError('Invalid or expired token', 400, 'TOKEN_INVALID');
  }

  // Mark as used
  await prisma.verificationToken.update({
    where: { id: record.id },
    data: { used: true },
  });

  return record.userId;
}
