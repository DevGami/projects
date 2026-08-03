import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { logger } from '../middleware/logger.js';
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
} from './auth.service.js';

// ═══════════════════════════════════════════════════════════════════════════
// Google OAuth 2.0 Service
// Handles authorization URL generation, token exchange, and user creation
// ═══════════════════════════════════════════════════════════════════════════

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  picture: string;
}

/**
 * Build the Google OAuth consent URL
 */
export function getGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID || '',
    redirect_uri: `${env.API_URL}/api/v1/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for Google tokens, then get user profile
 */
async function getGoogleUser(code: string): Promise<GoogleUserInfo> {
  // Exchange code for tokens
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID || '',
      client_secret: env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: `${env.API_URL}/api/v1/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    logger.error(`Google token exchange failed: ${tokenRes.status} ${errBody}`);
    throw new Error('Failed to exchange Google authorization code');
  }

  const tokens = await tokenRes.json() as { access_token: string };

  // Get user info
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    throw new Error('Failed to fetch Google user profile');
  }

  return userRes.json() as Promise<GoogleUserInfo>;
}

/**
 * Handle the full Google OAuth callback:
 * 1. Exchange code for user info
 * 2. Find or create user
 * 3. Generate JWT tokens
 * Returns { accessToken, refreshToken, user, isNewUser }
 */
export async function handleGoogleCallback(code: string) {
  const googleUser = await getGoogleUser(code);

  logger.info(`Google OAuth: ${googleUser.email} (${googleUser.name})`);

  // Find existing user by email
  let user = await prisma.user.findUnique({ where: { email: googleUser.email } });
  let isNewUser = false;

  if (!user) {
    // Create new user — Google-verified emails are already verified
    user = await prisma.user.create({
      data: {
        name: googleUser.name,
        email: googleUser.email,
        passwordHash: '', // No password for OAuth users
        emailVerified: true,
        avatarUrl: googleUser.picture,
      },
    });
    isNewUser = true;
    logger.info(`New Google user created: ${googleUser.email}`);
  } else {
    // Update existing user: mark email as verified, update avatar
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        avatarUrl: user.avatarUrl || googleUser.picture,
        lastLoginAt: new Date(),
      },
    });
  }

  // Generate JWT tokens
  const payload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  await storeRefreshToken(user.id, refreshToken);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: true,
    },
    isNewUser,
  };
}
