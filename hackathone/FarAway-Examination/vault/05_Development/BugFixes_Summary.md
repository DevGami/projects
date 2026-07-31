# Summary of Code Changes (AI Setup Fixes)

> **Date:** 2026-06-12
> **Context:** These changes were made by the AI assistant to fix local environment setup issues, correct Clerk integration bugs, and get the application running properly for manual testing.

---

## 1. Fixed Electron Kiosk Launch Errors
**Files Changed:** 
- `desktop/electron/main.js` → renamed to `main.cjs`
- `desktop/electron/preload.js` → renamed to `preload.cjs`
- `desktop/package.json`

**Why:** The `desktop/package.json` had `"type": "module"`, which tells Node.js to treat all `.js` files as modern ES Modules (using `import`). However, Electron's core (`main` and `preload` scripts) heavily relies on older CommonJS (`require()`). This caused a `ReferenceError: require is not defined` crash. Renaming the files to `.cjs` forced Node.js to treat them correctly as CommonJS.

## 2. Fixed Vite + Electron Dev Server Integration
**Files Changed:** 
- `desktop/package.json`

**Why:** Once the ESM bug was fixed, Electron launched but showed a white screen with `ERR_FILE_NOT_FOUND` looking for `dist/index.html`. In `main.cjs`, the code checks if `process.env.NODE_ENV === 'development'`; if true, it loads the live Vite dev server instead of the static build. I added the `cross-env` package and updated the `dev:electron` script to explicitly set `NODE_ENV=development` so Electron would correctly bridge to Vite.

## 3. Configured Clerk Authentication
**Files Changed:** 
- `web/.env`
- `docker/.env`

**Why:** The repository had placeholder keys (`YOUR_KEY_HERE`). I injected the actual Clerk Publishable and Secret keys. Without the Publishable key, the frontend login page wouldn't render. Without the Secret key, the cloud backend couldn't verify the session and would reject all API calls.

## 4. Fixed Clerk JWT Validation Bug in Backend
**Files Changed:** 
- `server/app/middleware/clerk_auth.py`

**Why:** When the backend tried to verify the login session, it crashed with a `404 Not Found`. This was caused by a hardcoded, outdated Clerk V1 URL (`https://api.clerk.dev/.well-known/jwks.json`). I rewrote this logic to dynamically decode the `CLERK_PUBLISHABLE_KEY` and automatically derive the correct, instance-specific URL for the Clerk dashboard (`profound-chow-40.clerk.accounts.dev`).

## 5. Initialized the Database Schema
**Commands Run:** 
- `docker exec fortis-cloud-server alembic upgrade head`

**Why:** When Docker started the PostgreSQL database, it was completely empty. The backend API crashed with `relation "questions" does not exist` because the tables weren't there. I ran Alembic (the Python database migration tool) inside the container to build the required tables based on the code models.

## 6. Generated Required Cryptographic Keys
**Commands Run:** 
- `python scripts/generate_keys.py`

**Why:** FortisExam uses advanced security (AES-GCM and RSA signatures) to encrypt questions and exam packages. The repository didn't include these keys. I ran the included script to generate `cloud_private.pem`, `cloud_public.pem`, and `edge_private.pem` in the `keys/` directory so the backend services could start up and encrypt data.

## 7. Seeded Test Data
**Commands Run:** 
- Direct SQL `INSERT` commands via `docker exec fortis-postgres psql`

**Why:** The `scripts/seed-demo-data.py` script included in the vault was just an empty stub containing `TODO` comments. To allow testing of the search and filtering capabilities of the Question Bank UI, I manually injected 3 encrypted question records directly into the PostgreSQL database using raw SQL.
