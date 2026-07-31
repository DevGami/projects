# Module 03 — Authentication

> **Last Updated:** 2026-06-08 (Updated with Clerk + Architecture Review)
> **Status:** 🔴 Not Started

---

## Purpose

FortisExam has **two separate authentication domains** that use different technologies:

| Domain | Users | Technology | Network | Location |
|---|---|---|---|---|
| **Admin Portal** (Zone A) | Admins, experts, center admins, invigilators, auditors | **Clerk** (managed auth) | Online | Cloud |
| **Candidate Kiosk** (Zone C) | Exam candidates | Custom QR + face verification | **Offline** | Edge |

---

## Domain 1: Admin Portal Authentication (Clerk)

### What Clerk Handles
- User signup / login (email + password, social login)
- Session management (Clerk session tokens)
- Multi-factor authentication (TOTP)
- User metadata and role management
- JWT issuance for API calls to cloud backend
- Pre-built React components (`<SignIn>`, `<UserButton>`, `<Protect>`)

### Integration Points

**Frontend (`web/`)**
```
<ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
  <SignedIn>  → Dashboard, Questions, Exams, Audit pages
  <SignedOut> → <SignIn /> page
</ClerkProvider>
```

**Backend (`server/ --mode cloud`)**
```
# Middleware on all cloud API routes:
1. Extract Bearer token from Authorization header
2. Verify Clerk JWT signature (Clerk public JWKS)
3. Extract user_id, role from session claims
4. Enforce RBAC per endpoint
```

### Roles (mapped from Clerk user metadata)
| Role | Permissions |
|---|---|
| admin | Full access: questions, exams, compilation, distribution, users, audit |
| expert | Questions: create, edit, view |
| center_admin | Centers: manage, view packages, view candidates |
| invigilator | Edge auth: supervisor override, monitoring events |
| auditor | Audit: view chain, verify integrity |

### Database Impact
- `users` table simplified: `clerk_user_id` (TEXT), `role` (TEXT), `name` (TEXT)
- No `password_hash` — Clerk manages credentials
- Sync on first login or via Clerk webhook

---

## Domain 2: Candidate Authentication (Custom, Offline)

### Components

| Component | Responsibility |
|---|---|
| QR Token Generator | Create signed, single-use tokens with candidate identity |
| QR Token Validator | Verify RSA signature, check nonce, validate assignment |
| Face Verification Service | Generate face embeddings, compare similarity |
| Session Manager | Create edge-local JWT sessions |

### Authentication Flow

```
1. Candidate presents QR code to scanner
    ↓
2. QR decoded → { candidate_id, exam_id, center_id, nonce, timestamp, signature }
    ↓
3. Verify RSA-2048 signature on token payload
    ↓
4. Check nonce (anti-replay: must be unused)
    ↓
5. Verify candidate is assigned to this center + exam
    ↓
6. Webcam captures candidate face
    ↓
7. Compare face embedding against stored embedding (cosine similarity)
    ↓
8. Similarity ≥ threshold → AUTHENTICATED
    ↓
9. Create edge-local JWT: { session_id, candidate_id, exam_id, exp }
    (signed with edge node's RSA private key, NOT Clerk)
    ↓
10. Audit log: CANDIDATE_AUTHENTICATED { candidate_id, method, score }
```

### QR Token Structure

```json
{
  "candidateId": "uuid",
  "examId": "uuid",
  "centerId": "uuid",
  "nonce": "random-string",
  "issuedAt": "datetime",
  "expiresAt": "datetime",
  "signature": "base64 (RSA-2048 signature of above fields)"
}
```

### Face Verification

| Parameter | Value |
|---|---|
| Model | Pre-computed embeddings (cosine similarity) |
| Embedding size | 512-dimensional vector |
| Comparison metric | Cosine similarity |
| Threshold (default) | 0.6 (configurable) |
| Fallback | Supervisor override (audit-logged) |
| Production upgrade | Live InsightFace + liveness detection |

---

## API Endpoints

### Cloud APIs (Clerk-protected)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/v1/users/me | Clerk JWT | Get current user profile |
| POST | /api/v1/questions | Clerk JWT (admin, expert) | Create question |
| POST | /api/v1/exams/{id}/compile | Clerk JWT (admin) | Compile exam |

### Edge APIs (Custom auth)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/v1/auth/authenticate | None (creates session) | Full QR + face auth |
| POST | /api/v1/auth/supervisor-override | Invigilator JWT | Manual override |
| GET | /api/v1/exam/session/{id} | Candidate JWT | Load exam session |

---

## Dependencies

### Admin Portal (Clerk)
- `@clerk/clerk-react` — Frontend React SDK
- `clerk-backend-api` or manual JWKS verification — Backend JWT validation
- Clerk Dashboard — User and role management

### Candidate Kiosk (Custom)
- `shared/crypto/rsa.py` — QR signature verification (RSA-2048)
- `shared/crypto/jwt_handler.py` — Edge-local JWT creation
- OpenCV — image capture and preprocessing
- SQLite — session storage on edge
- Audit Service — authentication event logging

---

## Testing Requirements

### Clerk (Admin)
- Integration: Clerk sign-in → API call with JWT → authorized response
- Integration: Invalid/expired Clerk JWT → 401 Unauthorized
- Integration: Role mismatch → 403 Forbidden

### Candidate (Custom)
- Unit: Valid QR token passes signature verification
- Unit: Tampered QR token fails verification
- Unit: Expired/replayed nonce is rejected
- Unit: Face match above threshold → success
- Unit: Face mismatch below threshold → failure
- Integration: Full auth flow from QR scan to session creation
- Security: Stolen QR token cannot be replayed (nonce)

---

## Related Documents

- [[ADR-002-ClerkAuthentication]] — Decision record for Clerk adoption
- [[Module04_GraphRandomization]] — Variant assignment after authentication
- [[Module05_StateRecovery]] — Session recovery after failure
- [[SecurityModel]] — Authentication security controls
