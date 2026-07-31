# ADR-002: Clerk for Admin Portal Authentication

> **Date:** 2026-06-08
> **Status:** Accepted
> **Deciders:** Architecture Team

---

## Context

FortisExam has two distinct authentication domains:

1. **Admin Portal (Zone A):** Examination authorities, subject experts, center admins, invigilators, and auditors access the cloud web portal. This is standard web authentication — login, sessions, RBAC, user management.
2. **Candidate Kiosk (Zone C):** Candidates authenticate at exam terminals using QR tokens + face verification. This is offline, edge-local, and custom.

Building a custom authentication system for the admin portal (password hashing, email verification, session management, password reset, MFA, RBAC) is estimated at 8-12 hours of development — time better spent on exam-specific security features.

## Decision

Use **Clerk** as the authentication provider for the admin portal (Zone A). Candidate authentication at the edge (Zone C) remains custom (QR + face).

### Clerk Handles (Admin Portal)
- User signup/login (email + password, social login)
- Session management (Clerk session tokens)
- Multi-factor authentication (TOTP)
- User metadata (role, organization)
- JWT issuance for API calls to cloud backend
- Pre-built React components (`<SignIn>`, `<UserButton>`, etc.)

### Custom Handles (Candidate Kiosk)
- QR token generation + RSA signature verification
- Face embedding comparison (InsightFace/cosine similarity)
- Edge-local JWT session (per-node RSA-signed)
- Offline operation — no dependency on Clerk

## Integration Points

### Frontend (web/)
```
Clerk React SDK (@clerk/clerk-react)
├── <ClerkProvider> wraps the app
├── <SignIn /> — login page
├── <SignUp /> — registration (if needed)
├── <UserButton /> — user menu
├── useUser() — current user hook
├── useAuth() — session token hook
└── <Protect> — role-based route protection
```

### Backend (server/ — cloud mode)
```
Clerk Python SDK (clerk-backend-api) or JWT verification
├── Middleware: verify Clerk JWT on every cloud API request
├── Extract user_id, role from Clerk session claims
├── Map Clerk roles to internal RBAC (admin, expert, center_admin, invigilator, auditor)
└── No password storage, no session table — Clerk handles it
```

### Database Impact
- The `users` table can be simplified: drop `password_hash`, `email` (managed by Clerk). Keep `id` (synced with Clerk user ID), `role`, `name`, and app-specific fields.
- Or: remove `users` table entirely and rely on Clerk user metadata for roles. Simpler but less flexible.
- **Recommended:** Keep a lightweight `users` table that syncs with Clerk via webhook or first-login initialization. Stores `clerk_user_id`, `role`, `name`.

## Alternatives Considered

1. **Custom auth (bcrypt + JWT)** — Rejected: 8-12 hours of commodity work, not a differentiator, potential security bugs
2. **Auth0** — Rejected: more complex setup, pricing model less hackathon-friendly
3. **Firebase Auth** — Rejected: ties to Google ecosystem, Clerk has better React DX
4. **Supabase Auth** — Viable alternative, but Clerk's pre-built components are faster to integrate

## Consequences

- ✅ Save 8-12 hours of auth development
- ✅ Production-grade auth from Day 1 (MFA, session management, security)
- ✅ Pre-built React components accelerate admin portal development
- ✅ Clerk handles user management UI (invite users, manage roles)
- ⚠️ Adds external dependency (Clerk account required)
- ⚠️ Cloud backend requires internet for Clerk JWT verification (acceptable — cloud is online)
- ⚠️ Edge server does NOT use Clerk — must remain fully offline
- ⚠️ Free tier limits apply (10,000 MAU — more than enough for hackathon)

---

## Related Documents

- [[Decisions]] — D-014: Clerk for Admin Authentication
- [[Module03_Authentication]] — Candidate auth remains custom
- [[SecurityModel]] — Layer 1 Identity Security updated
