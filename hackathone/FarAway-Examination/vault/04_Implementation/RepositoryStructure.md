# FortisExam — Repository Structure

> **Last Updated:** 2026-06-08
> **Phase:** Phase 5 Repository Planning

---

## Directory Layout

```
fortis-exam/
│
├── backend/                          # Cloud backend (Zone A)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI application entry point
│   │   ├── config.py                 # Environment configuration
│   │   ├── dependencies.py           # Dependency injection
│   │   │
│   │   ├── api/                      # API route handlers
│   │   │   ├── __init__.py
│   │   │   ├── v1/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── questions.py      # Question CRUD endpoints
│   │   │   │   ├── exams.py          # Exam compilation endpoints
│   │   │   │   ├── packages.py       # Package generation endpoints
│   │   │   │   ├── distribution.py   # Distribution endpoints
│   │   │   │   ├── centers.py        # Center management endpoints
│   │   │   │   ├── users.py          # User management endpoints
│   │   │   │   └── audit.py          # Audit trail endpoints
│   │   │   └── router.py            # API router aggregation
│   │   │
│   │   ├── models/                   # SQLAlchemy ORM models
│   │   │   ├── __init__.py
│   │   │   ├── question.py
│   │   │   ├── exam.py
│   │   │   ├── package.py
│   │   │   ├── center.py
│   │   │   ├── user.py
│   │   │   ├── candidate.py
│   │   │   └── audit_event.py
│   │   │
│   │   ├── schemas/                  # Pydantic request/response schemas
│   │   │   ├── __init__.py
│   │   │   ├── question.py
│   │   │   ├── exam.py
│   │   │   ├── package.py
│   │   │   ├── auth.py
│   │   │   └── audit.py
│   │   │
│   │   ├── services/                 # Business logic layer
│   │   │   ├── __init__.py
│   │   │   ├── question_service.py
│   │   │   ├── exam_service.py
│   │   │   ├── package_service.py
│   │   │   ├── distribution_service.py
│   │   │   └── audit_service.py
│   │   │
│   │   └── db/                       # Database configuration
│   │       ├── __init__.py
│   │       ├── database.py           # Engine, session factory
│   │       └── migrations/           # Alembic migrations
│   │
│   ├── requirements.txt
│   ├── Dockerfile
│   └── alembic.ini
│
├── edge/                             # Edge server (Zone C)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI edge server entry point
│   │   ├── config.py
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py               # Authentication endpoints
│   │   │   ├── exam.py               # Exam execution endpoints
│   │   │   ├── monitoring.py         # Security event endpoints
│   │   │   ├── recovery.py           # State recovery endpoints
│   │   │   └── audit.py              # Edge audit endpoints
│   │   │
│   │   ├── models/                   # SQLite models (edge-local)
│   │   │   ├── __init__.py
│   │   │   ├── session.py
│   │   │   ├── answer.py
│   │   │   ├── recovery_snapshot.py
│   │   │   └── audit_event.py
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── exam_service.py
│   │   │   ├── recovery_service.py
│   │   │   ├── monitoring_service.py
│   │   │   └── audit_service.py
│   │   │
│   │   └── db/
│   │       ├── __init__.py
│   │       └── sqlite_db.py          # SQLite setup with WAL mode
│   │
│   ├── requirements.txt
│   └── Dockerfile
│
├── shared/                           # Shared libraries (cross-zone)
│   ├── __init__.py
│   ├── crypto/
│   │   ├── __init__.py
│   │   ├── aes.py                    # AES-256-GCM encrypt/decrypt
│   │   ├── rsa.py                    # RSA-4096 key management, signing
│   │   ├── hkdf.py                   # HKDF key derivation
│   │   ├── hashing.py                # SHA-256 utilities
│   │   └── jwt_handler.py            # JWT creation and validation
│   │
│   ├── audit/
│   │   ├── __init__.py
│   │   ├── event_logger.py           # Audit event creation
│   │   ├── hash_chain.py             # Hash chain generator
│   │   └── chain_verifier.py         # Chain integrity verification
│   │
│   ├── graph/
│   │   ├── __init__.py
│   │   ├── layout_engine.py          # Seating layout parser
│   │   ├── graph_builder.py          # Adjacency graph construction
│   │   ├── coloring.py               # Graph coloring algorithm
│   │   └── variant_generator.py      # Question/option shuffling
│   │
│   ├── models/                       # Shared Pydantic models
│   │   ├── __init__.py
│   │   └── common.py
│   │
│   └── utils/
│       ├── __init__.py
│       └── helpers.py
│
├── frontend/                         # Admin portal (React)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── questions/            # Question management UI
│   │   │   ├── exams/                # Exam configuration UI
│   │   │   ├── centers/              # Center management UI
│   │   │   ├── audit/                # Audit trail viewer
│   │   │   └── common/               # Shared UI components
│   │   │
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Questions.tsx
│   │   │   ├── Exams.tsx
│   │   │   ├── Centers.tsx
│   │   │   ├── Audit.tsx
│   │   │   └── Login.tsx
│   │   │
│   │   ├── services/                 # API client services
│   │   │   ├── api.ts
│   │   │   ├── questionService.ts
│   │   │   ├── examService.ts
│   │   │   └── auditService.ts
│   │   │
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── types/                    # TypeScript type definitions
│   │   ├── utils/                    # Utility functions
│   │   ├── App.tsx
│   │   └── index.tsx
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── desktop/                          # Candidate kiosk (Electron + React)
│   ├── electron/
│   │   ├── main.ts                   # Electron main process
│   │   ├── preload.ts                # Preload script (secure bridge)
│   │   ├── ipc/
│   │   │   ├── auth.ts               # Auth IPC handlers
│   │   │   ├── exam.ts               # Exam IPC handlers
│   │   │   └── monitoring.ts         # Monitoring IPC handlers
│   │   └── kiosk.ts                  # Kiosk mode configuration
│   │
│   ├── src/                          # React renderer process
│   │   ├── components/
│   │   │   ├── auth/                 # QR scanner, face capture
│   │   │   ├── exam/                 # Question display, navigation, timer
│   │   │   ├── monitoring/           # Webcam feed, alert display
│   │   │   └── common/               # Shared UI components
│   │   │
│   │   ├── pages/
│   │   │   ├── Auth.tsx              # Authentication page
│   │   │   ├── Exam.tsx              # Exam execution page
│   │   │   ├── Summary.tsx           # Pre-submission summary
│   │   │   └── Complete.tsx          # Post-submission confirmation
│   │   │
│   │   ├── services/
│   │   │   ├── edgeApi.ts            # Edge server API client
│   │   │   ├── qrScanner.ts          # QR code scanning
│   │   │   ├── faceCapture.ts        # Webcam face capture
│   │   │   └── monitoring.ts         # MediaPipe monitoring
│   │   │
│   │   ├── App.tsx
│   │   └── index.tsx
│   │
│   ├── package.json
│   └── electron-builder.yml
│
├── infrastructure/                   # Deployment & configuration
│   ├── docker-compose.yml            # Full stack compose
│   ├── docker-compose.dev.yml        # Development overrides
│   ├── docker-compose.edge.yml       # Edge-only compose
│   ├── .env.example                  # Environment variable template
│   ├── nginx/
│   │   └── nginx.conf                # Reverse proxy config
│   └── scripts/
│       ├── setup.sh                  # Initial setup script
│       ├── seed-data.sh              # Demo data seeding
│       └── generate-keys.sh          # RSA key pair generation
│
├── docs/                             # Source documents
│   ├── PRD.md
│   ├── TRD.md
│   ├── Architecture.md
│   └── PROMPT.md
│
├── vault/                            # Obsidian project memory vault
│   ├── 00_Project/
│   ├── 01_Product/
│   ├── 02_Architecture/
│   ├── 03_Modules/
│   ├── 04_Implementation/
│   ├── 05_Development/
│   ├── 06_Testing/
│   ├── 07_AI_Context/
│   └── 99_Archive/
│
├── tests/                            # Test suites
│   ├── backend/
│   │   ├── test_question_service.py
│   │   ├── test_encryption.py
│   │   ├── test_compilation.py
│   │   ├── test_audit.py
│   │   └── conftest.py
│   │
│   ├── edge/
│   │   ├── test_auth_service.py
│   │   ├── test_exam_service.py
│   │   ├── test_recovery.py
│   │   └── conftest.py
│   │
│   ├── shared/
│   │   ├── test_aes.py
│   │   ├── test_rsa.py
│   │   ├── test_hash_chain.py
│   │   ├── test_graph_coloring.py
│   │   └── conftest.py
│   │
│   ├── integration/
│   │   ├── test_e2e_exam_flow.py
│   │   ├── test_distribution.py
│   │   └── conftest.py
│   │
│   ├── security/
│   │   ├── test_package_tampering.py
│   │   ├── test_auth_bypass.py
│   │   └── test_replay_attack.py
│   │
│   └── performance/
│       ├── test_answer_save_latency.py
│       └── test_recovery_time.py
│
├── .gitignore
├── README.md
├── LICENSE
└── Makefile                          # Common commands (setup, test, run)
```

---

## Directory Responsibilities

| Directory | Responsibility | Owner Track |
|---|---|---|
| `backend/` | Cloud-side APIs: questions, exams, packages, distribution, audit | Backend Core |
| `edge/` | Edge-side APIs: auth, exam execution, recovery, monitoring, edge audit | Backend Core |
| `shared/` | Shared crypto, audit, and graph libraries used by both backend and edge | Security + AI/ML |
| `frontend/` | Admin portal React app for exam authorities | Frontend |
| `desktop/` | Electron + React candidate kiosk application | Desktop |
| `infrastructure/` | Docker Compose, configs, scripts, deployment | Documentation & DevOps |
| `docs/` | Source of truth documents (PRD, TRD, Architecture) | Read-only reference |
| `vault/` | Obsidian project memory vault | Documentation & DevOps |
| `tests/` | All test suites organized by target | All tracks |

---

## Key Design Decisions

1. **Separate `backend/` and `edge/`:** They deploy to different environments (cloud vs. center) and have different dependencies (PostgreSQL vs. SQLite).
2. **`shared/` library:** Crypto and graph code is shared between backend and edge to avoid duplication and ensure consistent behavior.
3. **`tests/` at root:** Tests are separate from source code for cleaner packaging and CI/CD configuration.
4. **`infrastructure/` contains all deployment config:** Single source for Docker, nginx, scripts.

---

## Related Documents

- [[BackendDesign]] — Backend architecture detail
- [[FrontendDesign]] — Frontend architecture detail
- [[DatabaseDesign]] — Schema design
- [[EnvironmentSetup]] — Getting started guide
