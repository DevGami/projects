# Module 03 — Authentication: Implementation Plan

> **Created:** 2026-06-10
> **Status:** ✅ APPROVED — EXECUTING
> **Author:** AI Lead Backend Engineer (FortisExam)
> **Module:** 03 — Authentication

---

## Scope

Module 03 covers **two distinct, non-overlapping authentication domains**:

### Domain 1: Admin Portal (Clerk — Cloud)
Cloud routes protected by Clerk JWT middleware. Already scaffolded as stubs (`clerk_auth.py`). Must implement JWKS verification, claims extraction, and RBAC enforcer.

### Domain 2: Candidate Kiosk (Custom — Edge, Offline)
Full offline pipeline: QR token verification → anti-replay nonce check → face embedding similarity → edge-local JWT session creation. No Clerk dependency.

---

## Goals

| Goal | Domain | Priority |
|---|---|---|
| Implement `JWTHandler` (create + verify RS256) | Edge | CRITICAL |
| Implement Clerk JWT JWKS verification | Cloud | HIGH |
| Implement RBAC `require_role` dependency | Cloud | HIGH |
| Implement QR token RSA signature verification | Edge | CRITICAL |
| Implement anti-replay nonce store (SQLite) | Edge | CRITICAL |
| Implement face embedding cosine similarity | Edge | HIGH |
| Implement `POST /auth/authenticate` edge route | Edge | CRITICAL |
| Implement `POST /auth/supervisor-override` route | Edge | HIGH |
| Implement Clerk sync `POST /users/sync` cloud route | Cloud | MEDIUM |
| Implement `GET /users/me` cloud route | Cloud | MEDIUM |
| Wire edge JWT middleware into exam routes | Edge | HIGH |

---

## APIs

### Cloud (Clerk-protected)
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | /api/v1/users/me | Any authenticated | Current user profile |
| POST | /api/v1/users/sync | admin | Sync Clerk user to local DB |

### Edge (Custom JWT / No-auth for login)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/v1/auth/authenticate | None (creates session) | QR + face → JWT |
| POST | /api/v1/auth/supervisor-override | None | Manual override + audit log |

---

## Data Structures

### QR Token (RSA-signed JSON payload)
```json
{
  "candidate_id": "uuid",
  "exam_id": "uuid",
  "center_id": "uuid",
  "nonce": "32-byte random hex",
  "issued_at": "ISO-8601",
  "expires_at": "ISO-8601",
  "signature": "base64(RSA-PSS-sign(sha256(payload_without_sig)))"
}
```

### Edge Session JWT (RS256)
```json
{
  "sub": "session_id",
  "candidate_id": "uuid",
  "exam_id": "uuid",
  "variant_id": 2,
  "iat": 1234567890,
  "exp": 1234567890
}
```

### UsedNonce (SQLite table)
```
used_nonces(id: TEXT PK, used_at: DATETIME)
```

### AuthenticateResponse
```json
{
  "session_id": "uuid",
  "token": "RS256 JWT",
  "variant_id": 2,
  "expires_at": "ISO-8601",
  "face_score": 0.87,
  "method": "qr_face" | "qr_only" | "supervisor_override"
}
```

---

## Dependencies

### Internal (already built)
- `shared/crypto/rsa.py` — RSA sign/verify (Module 02)
- `shared/crypto/hashing.py` — SHA-256 for QR payload hash
- `server/app/models/candidate.py` — `photo_embedding` column
- `server/app/models/session.py` — `ExamSession`
- `server/app/services/audit_service.py` — CANDIDATE_AUTHENTICATED event (Module 07)
- `server/app/config.py` — `face_similarity_threshold`, `rsa_public_key_path`

### External (already installed)
- `pyjwt[crypto]==2.13.0` — RS256 JWT sign/verify
- `httpx` — Clerk JWKS fetching
- `numpy` — cosine similarity for face embeddings
- `cryptography` — RSA PSS verify (already available)

### New SQLite model needed
- `UsedNonce` — anti-replay store

---

## Implementation Phases

### Phase 1 — Core JWT Handler (shared/crypto)
1. Implement `JWTHandler.create_token()` — RS256, configurable expiry
2. Implement `JWTHandler.verify_token()` — RS256, expiry check, returns payload
3. Implement `JWTHandler.decode_clerk_jwt()` — JWKS fetch + RS256 verify

### Phase 2 — Cloud Middleware (server/app/middleware)
4. Implement `verify_clerk_jwt()` in `clerk_auth.py` — real JWKS verification
5. Implement `require_role()` — RBAC enforcer as dependency factory

### Phase 3 — Edge Auth Infrastructure
6. Create `UsedNonce` SQLite model
7. Create `QRTokenService` — parse, verify sig, check nonce, check assignment
8. Create `FaceVerificationService` — numpy cosine similarity on embeddings
9. Create `AuthService` — orchestrate QR + face → session creation

### Phase 4 — Edge API Routes
10. Implement `POST /auth/authenticate` — full flow
11. Implement `POST /auth/supervisor-override` — bypass with audit log

### Phase 5 — Cloud API Routes
12. Implement `GET /users/me`
13. Implement `POST /users/sync`
14. Wire `verify_clerk_jwt` into existing cloud routes as optional dependency

### Phase 6 — Wire Edge Middleware
15. Implement `verify_edge_jwt()` in `edge_auth.py`
16. Add JWT protection to `exam.py` routes

### Phase 7 — Tests
17. Unit tests: JWT, QR validation, face similarity, nonce store
18. Integration tests: full auth flow (mock DB)
19. Security tests: replay, tamper, expired token

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Clerk JWKS URL not configured (no API keys) | HIGH | Fall-back: dev-mode bypass if `CLERK_SECRET_KEY` is empty |
| `photo_embedding` is LargeBinary but numpy operations needed | MEDIUM | Deserialize bytes → numpy array on load |
| Face verification with no camera (test env) | HIGH | Accept `face_image_base64: null` → skip face check (QR-only mode) |
| RSA public key file not found on edge | MEDIUM | `AuthService` checks key path at startup; raise clear error |

---

## Test Strategy

### Unit Tests (`tests/unit/test_auth.py`)
- `JWTHandler.create_token` → verifiable by `verify_token`
- `JWTHandler.verify_token` → expired token raises `ExpiredSignatureError`
- `JWTHandler.verify_token` → tampered payload raises `InvalidSignatureError`
- `QRTokenService.verify` → valid token passes
- `QRTokenService.verify` → tampered token fails
- `QRTokenService.verify` → expired token fails
- `QRTokenService.verify` → replayed nonce fails
- `FaceVerificationService.compare` → high-similarity embeddings pass
- `FaceVerificationService.compare` → low-similarity embeddings fail

### Integration Tests (`tests/integration/test_auth_integration.py`)
- Full auth flow: QR verify + face pass → session created
- Full auth flow: QR verify + face fail → 401
- Full auth flow: supervisor override → session created + audit logged
- Clerk middleware: valid JWT passes
- Clerk middleware: invalid JWT → 401
- Clerk middleware: wrong role → 403

### Security Tests (`tests/security/test_auth_security.py`)
- T-007: Replay attack — same nonce rejected second time
- T-008: Tampered QR → signature fails
- T-009: Expired QR → rejected
- T-010: Wrong RSA key → JWT verify fails
- T-011: RBAC bypass attempt → 403

---

## Manual Testing Strategy

See `ManualTestingChecklist.md` (to be created alongside implementation).

---

## Files To Create/Modify

| File | Action |
|---|---|
| `shared/crypto/jwt_handler.py` | MODIFY — implement all 3 methods |
| `server/app/models/used_nonce.py` | CREATE — SQLite anti-replay table |
| `server/app/services/qr_token_service.py` | CREATE — QR parse + verify |
| `server/app/services/face_verification_service.py` | CREATE — cosine similarity |
| `server/app/services/auth_service.py` | CREATE — orchestration |
| `server/app/middleware/clerk_auth.py` | MODIFY — implement JWKS verify |
| `server/app/middleware/edge_auth.py` | MODIFY — implement JWT verify |
| `server/app/api/edge/auth.py` | MODIFY — implement routes |
| `server/app/api/cloud/users.py` | CREATE — /users/me + /users/sync |
| `server/app/schemas/auth.py` | MODIFY — extend with new schemas |
| `server/app/main.py` | MODIFY — mount users router |
| `tests/unit/test_auth.py` | CREATE |
| `tests/integration/test_auth_integration.py` | CREATE |
| `tests/security/test_auth_security.py` | CREATE |
| `vault/03_Modules/Module03_Authentication/ManualTestingChecklist.md` | CREATE |
