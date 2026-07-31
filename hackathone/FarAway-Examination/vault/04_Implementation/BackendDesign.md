# FortisExam — Backend Design (Post Architecture Review)

> **Last Updated:** 2026-06-08 (Updated per D-009, D-010, D-014)

---

## Architecture Pattern

Single FastAPI application, mode-switchable via `SERVER_MODE` environment variable:

```
                   ┌─────────────────────────────┐
                   │  server/app/main.py          │
                   │  SERVER_MODE = cloud | edge  │
                   └─────────────┬───────────────┘
                                 │
            ┌────────────────────┴───────────────────┐
            │                                        │
   ┌────────▼────────┐                   ┌───────────▼────────┐
   │  Cloud Routes    │                   │  Edge Routes        │
   │  (questions,     │                   │  (auth, exam,       │
   │   exams, dist)   │                   │   recovery, monitor)│
   │  + Clerk JWT     │                   │  + Custom JWT       │
   │    middleware     │                   │    middleware        │
   └────────┬────────┘                   └───────────┬────────┘
            │                                        │
   ┌────────▼────────┐                   ┌───────────▼────────┐
   │  PostgreSQL 15   │                   │  SQLite (WAL mode)  │
   └─────────────────┘                   └────────────────────┘
```

---

## Cloud Mode (`SERVER_MODE=cloud`)

### Stack
- **Framework:** FastAPI (Python 3.11+)
- **ORM:** SQLAlchemy 2.0 (async)
- **Database:** PostgreSQL 15
- **Auth:** **Clerk** (JWT verification via JWKS)
- **Migrations:** Alembic

### Middleware
1. **Clerk JWT Verification** — Validates Clerk session token on every cloud API request
2. **RBAC Enforcement** — Extracts role from Clerk claims, enforces per-endpoint permissions
3. **CORS** — Allows requests from `web/` admin portal origin
4. **Audit Logging** — Logs API calls to hash chain

### Services
| Service | Purpose | Key Dependencies |
|---|---|---|
| Question Service | CRUD + auto-encryption | Encryption (shared/crypto) |
| Exam Service | Blueprint compilation + graph coloring | Question Service, Graph (shared/graph) |
| Package Service | Package generation + RSA-2048 signing | Encryption, Exam Service |
| Distribution Service | Package + key delivery to edge nodes | Package Service |
| Audit Service | Cloud audit hash chain | Hash chain (shared/audit) |
| ~~User Service~~ | ~~Admin user management~~ | **Replaced by Clerk** — no custom user management needed |

### Auth Flow (Cloud)
```
React Admin App (web/)
    │ Clerk session token in Authorization header
    ▼
FastAPI Middleware
    │ Verify Clerk JWT via JWKS endpoint
    │ Extract: clerk_user_id, role, email
    ▼
RBAC Check
    │ admin? expert? center_admin? auditor?
    ▼
Route Handler
```

---

## Edge Mode (`SERVER_MODE=edge`)

### Stack
- **Framework:** FastAPI (Python 3.11+)
- **Database:** SQLite (WAL mode) — sole datastore (no Redis)
- **Auth:** Custom RSA-signed JWT (per-node key pair, offline)
- **Face AI:** Pre-computed embeddings + cosine similarity (OpenCV for capture)

### Middleware
1. **Custom JWT Verification** — Validates per-node RSA-signed JWT for candidate sessions
2. **Audit Logging** — Logs API calls to edge hash chain

### Services
| Service | Purpose | Key Dependencies |
|---|---|---|
| Auth Service | QR validation + face embedding comparison | Crypto (shared), OpenCV |
| Exam Service | Variant loading, answer collection | SQLite |
| Recovery Service | State persistence + snapshot restoration | SQLite (sole source) |
| Monitoring Service | Security event management | MediaPipe (desktop-side, optional) |
| Audit Service | Edge audit hash chain | Hash chain (shared/audit) |

### Auth Flow (Edge — Offline)
```
Electron Kiosk (desktop/)
    │ QR code scanned
    ▼
Edge Auth Endpoint (no Clerk, no internet)
    │ Verify RSA-2048 signature on QR token
    │ Check nonce (anti-replay)
    │ Compare face embedding (cosine similarity)
    ▼
Create Session
    │ Sign JWT with edge node's RSA private key
    │ Store session in SQLite
    ▼
Return JWT to desktop app
```

---

## Key Design Differences: Cloud vs Edge Auth

| Aspect | Cloud (Clerk) | Edge (Custom) |
|---|---|---|
| Provider | Clerk (managed service) | Custom implementation |
| Network | Online (internet required) | **Offline** (no internet) |
| Users | Admins, experts, auditors | Exam candidates |
| Token format | Clerk session JWT | RSA-signed JWT (per-node) |
| Verification | Clerk JWKS endpoint | Local RSA public key |
| MFA | Clerk handles TOTP | Face verification |
| User storage | Clerk dashboard | SQLite (pre-loaded) |

---

## Related Documents

- [[ADR-002-ClerkAuthentication]] — Clerk decision record
- [[Module03_Authentication]] — Full auth specification
- [[RepositoryStructure]] — File layout
- [[DatabaseDesign]] — Schema details
- [[APIContracts]] — Endpoint specifications
