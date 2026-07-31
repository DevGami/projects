# FortisExam — Environment Setup (Post Architecture Review)

> **Last Updated:** 2026-06-08 (Updated per D-009, D-010, D-014)

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Server (cloud + edge modes) |
| Node.js | 18+ | Admin portal + desktop app |
| Docker | 24+ | Container orchestration |
| Docker Compose | 2.20+ | Multi-container setup |
| Git | 2.40+ | Version control |
| Clerk Account | Free tier | Admin portal authentication |

---

## Quick Start

```bash
# 1. Clone repository
git clone <repo-url>
cd fortis-exam

# 2. Copy environment template
cp docker/.env.example .env
# Edit .env → add CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY

# 3. Generate RSA key pairs
bash scripts/generate-keys.sh

# 4. Start all services
docker compose -f docker/docker-compose.yml up -d

# 5. Run database migrations
docker exec fortis-cloud-server alembic upgrade head

# 6. Seed demo data
python scripts/seed-demo-data.py

# 7. Start admin portal (separate terminal)
cd web && npm install && npm run dev

# 8. Start Electron app (separate terminal)
cd desktop && npm install && npm run dev
```

---

## Environment Variables

### Server (Cloud Mode)
| Variable | Description | Default |
|---|---|---|
| SERVER_MODE | Server mode | `cloud` |
| DATABASE_URL | PostgreSQL connection string | `postgresql://fortis:password@postgres:5432/fortisexam` |
| CLERK_SECRET_KEY | Clerk backend secret key | (from Clerk dashboard) |
| CLERK_PUBLISHABLE_KEY | Clerk frontend publishable key | (from Clerk dashboard) |
| RSA_PRIVATE_KEY_PATH | Path to RSA private key | `./keys/private.pem` |
| RSA_PUBLIC_KEY_PATH | Path to RSA public key | `./keys/public.pem` |

### Server (Edge Mode)
| Variable | Description | Default |
|---|---|---|
| SERVER_MODE | Server mode | `edge` |
| DATABASE_URL | SQLite connection string | `sqlite:///./data/edge.db` |
| RSA_PRIVATE_KEY_PATH | Edge node's RSA private key | `./keys/edge_private.pem` |
| RSA_PUBLIC_KEY_PATH | Cloud's RSA public key (for QR verification) | `./keys/cloud_public.pem` |
| FACE_SIMILARITY_THRESHOLD | Face match threshold | `0.6` |

### Admin Portal (web/)
| Variable | Description |
|---|---|
| VITE_CLERK_PUBLISHABLE_KEY | Clerk publishable key (same as above) |
| VITE_API_BASE_URL | Cloud server URL (`http://localhost:8000/api/v1`) |

### Candidate Kiosk (desktop/)
| Variable | Description |
|---|---|
| EDGE_SERVER_URL | Edge server URL (`http://localhost:8001/api/v1`) |

---

## Clerk Setup

1. Go to [clerk.com](https://clerk.com) → Create account (free tier)
2. Create a new application → "FortisExam"
3. Copy **Publishable Key** → `CLERK_PUBLISHABLE_KEY` / `VITE_CLERK_PUBLISHABLE_KEY`
4. Copy **Secret Key** → `CLERK_SECRET_KEY`
5. In Clerk Dashboard → Users → Create first admin user
6. Add custom claim for role: `admin`, `expert`, `center_admin`, `invigilator`, `auditor`

---

## Related Documents

- [[RepositoryStructure]] — Project layout
- [[ADR-002-ClerkAuthentication]] — Clerk decision record
- [[DeploymentPlan]] — Deployment procedures
- [[DeploymentArchitecture]] — Infrastructure design
