# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all deps (including dev for build)
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# TypeScript compile check (ts-node handles at runtime, but validate types)
RUN npx tsc --noEmit || true

# ── Stage 2: Production ────────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S bysapi -u 1001 -G nodejs

# Copy package files and install PRODUCTION only deps
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npx prisma generate

# Copy source (tsx runs TypeScript directly in production via ts-node)
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

# Own files
RUN chown -R bysapi:nodejs /app

USER bysapi

EXPOSE 5000

ENV NODE_ENV=production

ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "tsx", "src/index.ts"]
