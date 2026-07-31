# FortisExam — Architecture Review

> **Review Date:** 2026-06-08
> **Reviewers:** Principal Architect, Security Engineer, Hackathon Judge, DevOps Engineer
> **Scope:** Full system review across PRD, TRD, Architecture, and vault
> **Verdict:** Sound architecture with critical simplifications needed for hackathon viability

---

# Architecture Strengths

## S-01: Edge-First Is the Right Call
- **Description:** Pushing exam execution to local edge nodes is architecturally correct for the problem domain. CDN-inspired pre-distribution of encrypted packages eliminates the "1.5 million simultaneous connections" problem entirely.
- **Impact:** Eliminates the single biggest scaling bottleneck in competing architectures.
- **Reviewer:** Principal Architect

## S-02: Defense in Depth — Four Security Layers
- **Description:** The layered security model (Identity → Content → Execution → Audit) means no single compromise defeats the system. An attacker must breach multiple independent layers.
- **Impact:** Dramatically raises the cost of attack. Even a center-level insider can't silently tamper with results.
- **Reviewer:** Security Engineer

## S-03: Cryptographic Accountability Is the Killer Feature
- **Description:** The hash-chained audit ledger is the strongest differentiator against every proctoring competitor. It shifts the security model from "trust humans" to "trust math." This is provable in court, not just in demos.
- **Impact:** This alone justifies the project's existence. No AI proctoring tool offers tamper-evident audit trails.
- **Reviewer:** Hackathon Judge

## S-04: Spatial Graph Randomization Is Novel
- **Description:** Using graph coloring on seating adjacency to prevent copying is an elegant, non-obvious solution. It's visual (judges can see two screens side-by-side) and mathematically rigorous.
- **Impact:** Strong demo moment. Easy to explain, hard to refute.
- **Reviewer:** Hackathon Judge

## S-05: Crash Recovery as a Feature, Not an Edge Case
- **Description:** Making state recovery a first-class module with dual-write (SQLite WAL + Redis) and sub-60-second restoration is excellent. The demo of killing a process and recovering is dramatic.
- **Impact:** Shows production thinking. Judges love resilience engineering.
- **Reviewer:** Principal Architect

## S-06: Clean Separation of Concerns
- **Description:** The `shared/` crypto and audit libraries ensure identical behavior across cloud and edge. The layered architecture (API → Service → Data) in both backend and edge servers is clean.
- **Impact:** Enables parallel development and consistent security guarantees.
- **Reviewer:** Principal Architect

---

# Architecture Weaknesses

## W-01: Two Separate FastAPI Applications Is Premature Decomposition
- **Description:** The current design has `backend/` (cloud) and `edge/` (edge server) as two entirely separate FastAPI apps with separate models, services, and configurations. They share ~60% of their business logic patterns and depend on the same `shared/` library. For a hackathon, this doubles the scaffolding work, doubles the Docker images, and creates import path headaches.
- **Impact:** HIGH — wastes 4-6 hours of setup time, creates sync bugs between two codebases that should be one
- **Likelihood:** CERTAIN
- **Mitigation:** Merge into a single FastAPI app with a `--mode cloud|edge` flag. Use the same models/services with environment-driven database selection (PostgreSQL vs SQLite). The separation is a deployment concern, not a code concern.

## W-02: Redis on Edge Is Unnecessary for Demo Scale
- **Description:** Redis on the edge node is specified for "high-speed session sync" and as a recovery source. For a hackathon demo with 1 center and ~6 seats, SQLite alone handles all persistence needs. Redis adds a Docker container, configuration, and failure mode with zero demo benefit.
- **Impact:** MEDIUM — extra infra complexity, additional failure point
- **Likelihood:** HIGH
- **Mitigation:** Remove Redis from edge deployment. Use SQLite as the sole edge datastore. The dual-write pattern becomes unnecessary. Document Redis as a production enhancement for high-concurrency centers.

## W-03: No WebSocket for Real-Time Proctor Dashboard
- **Description:** The proctor dashboard needs real-time alerts (multiple faces detected, gaze deviation). The current API design is REST-only. Polling REST endpoints for real-time updates is inefficient and adds latency.
- **Impact:** MEDIUM — proctor dashboard feels sluggish, misses urgent alerts
- **Likelihood:** HIGH
- **Mitigation:** Add WebSocket endpoint on edge server for proctor event streaming. FastAPI supports WebSocket natively. Alternative: Server-Sent Events (SSE) for simpler one-directional push.

## W-04: Time-Locked Key Release Is Underspecified
- **Description:** Multiple documents reference "time-locked keys" but the mechanism is never defined. Who enforces the time lock? The cloud server's clock? The edge node's clock? What prevents clock manipulation? The TRD mentions "time-based key release" without specifying the protocol.
- **Impact:** HIGH — this is a core security claim with no implementation path
- **Likelihood:** CERTAIN (it's simply missing from the design)
- **Mitigation:** For hackathon: simplify to an admin-triggered "release key" API call. The admin clicks a button at exam time, and the key is sent to the edge. Document automated time-lock as a production feature (TEE-based or HSM-based). This is honest and demonstrable.

## W-05: Answers Table Lacks Upsert Semantics
- **Description:** The SQLite `answers` table uses `id` as PK with a new row per answer event. If a candidate changes their answer to the same question, this creates duplicate rows. The recovery snapshot stores `answers_json` but the live `answers` table can have conflicts.
- **Impact:** MEDIUM — data inconsistency during recovery, scoring errors
- **Likelihood:** HIGH
- **Mitigation:** Use `(session_id, question_id)` as a composite unique constraint. Use `INSERT OR REPLACE` (upsert) semantics. Keep the `answers` table as the source of truth, not the snapshot.

## W-06: No Error Handling Strategy
- **Description:** Neither the API contracts nor the module specs define error responses, error codes, or failure behavior. What happens when encryption fails? When face verification times out? When SQLite is locked?
- **Impact:** MEDIUM — fragile demo, cryptic errors in front of judges
- **Likelihood:** HIGH
- **Mitigation:** Define standard error response format: `{ "error": string, "code": string, "details": {} }`. Add error handling to all API endpoints. For the demo, ensure graceful degradation with user-friendly messages.

---

# Security Risks

## SR-01: Edge Node Private Key Storage
- **Description:** Each edge node has an RSA private key for decrypting center-specific exam keys. The current design stores this as a local file. If the edge node's filesystem is accessed (which is trivial in a hackathon demo environment), the private key is compromised.
- **Impact:** CRITICAL — total exam content compromise for that center
- **Likelihood:** MEDIUM (hackathon demo machine is physically accessible)
- **Mitigation:** For hackathon: accept the risk, document it as a known limitation. Generate keys at startup, store in memory only. For production: HSM or TPM-backed key storage.

## SR-02: JWT Secret Shared Across Edge Nodes
- **Description:** If JWT signing uses a shared secret (HMAC), compromising one edge node's secret compromises all sessions across all nodes. The design doesn't specify whether JWT uses HMAC (shared secret) or RSA (per-node key pair).
- **Impact:** HIGH — cross-center session forgery
- **Likelihood:** LOW (hackathon is single-center)
- **Mitigation:** Use per-node RSA-signed JWTs (the node already has an RSA key pair). Each edge node signs with its private key, validates with its own public key. No shared secrets.

## SR-03: Face Embedding Storage Is Unencrypted
- **Description:** The `candidates` table stores `photo_embedding` as plain BYTEA. Face embeddings are biometric data. In production this would be a GDPR/data protection violation.
- **Impact:** MEDIUM (hackathon only uses test data, but judges may ask)
- **Likelihood:** LOW (demo concern, not functional)
- **Mitigation:** Encrypt embeddings at rest using the per-center AES key. Document as a production requirement. Have a prepared answer for judges.

## SR-04: No TLS Between Desktop App and Edge Server
- **Description:** The desktop Electron app communicates with the edge server over HTTP on the local network. The data flow includes JWTs, face images, and exam answers — all in plaintext on the wire.
- **Impact:** MEDIUM — local network sniffing could capture exam data
- **Likelihood:** LOW (local network, physical security assumed)
- **Mitigation:** For hackathon: accept (local network assumption). For production: mTLS between desktop and edge server using pre-provisioned certificates.

## SR-05: Electron DevTools and Debug Bypass
- **Description:** Electron apps can be reverse-engineered. Even with kiosk mode, if `nodeIntegration` is misconfigured or devtools are not properly disabled, the exam app can be manipulated.
- **Impact:** HIGH — exam environment compromise
- **Likelihood:** MEDIUM
- **Mitigation:** Electron hardening checklist: disable `nodeIntegration`, use `contextIsolation`, disable `devtools` in production builds, disable keyboard shortcuts (Ctrl+Shift+I, F12), sign the Electron binary.

## SR-06: Nonce Storage for QR Anti-Replay Has No Expiry
- **Description:** Used QR nonces are stored to prevent replay, but the design doesn't specify storage location, cleanup, or capacity. Over time (or across exams), the nonce store grows unbounded.
- **Impact:** LOW — storage concern, not security breach
- **Likelihood:** MEDIUM
- **Mitigation:** Store nonces in SQLite with exam_id scope. Purge nonces when exam is completed. Each exam has its own nonce space.

---

# Scalability Risks

## SC-01: SQLite Single-Writer Bottleneck Under Load
- **Description:** SQLite supports only one writer at a time. In a center with 30+ concurrent candidates all submitting answers, write contention is possible. WAL mode helps reads but doesn't eliminate the single-writer constraint.
- **Impact:** MEDIUM — answer save latency spikes above 100ms target
- **Likelihood:** LOW for hackathon (6 demo seats), HIGH for production (30+ seats)
- **Mitigation:** For hackathon: not a concern. For production: batch writes, write-ahead queue, or move to embedded PostgreSQL. Test with simulated load early.

## SC-02: Package Size for Large Question Banks
- **Description:** A real national exam with 200+ questions per subject across multiple subjects could produce large encrypted packages (10s of MB). Distribution to 10,000+ centers multiplies bandwidth requirements.
- **Impact:** LOW for hackathon, HIGH for production
- **Likelihood:** LOW (hackathon uses 20 questions)
- **Mitigation:** Compress question content before encryption. Use delta distribution for package updates. CDN distribution for production.

## SC-03: Audit Chain Length Impacts Verification Time
- **Description:** Audit chain verification is O(n) — every event must be checked sequentially. A center running 30 candidates with ~100 events each generates 3,000+ events. Verification at that scale is fine but national aggregation (30M events) is slow.
- **Impact:** LOW for hackathon, MEDIUM for production
- **Likelihood:** LOW
- **Mitigation:** Segment chains per center + exam. Verify independently. Use Merkle tree structure in production for O(log n) partial verification.

---

# Demo Risks

## DR-01: InsightFace Model Download and Compatibility (CRITICAL)
- **Description:** InsightFace requires downloading pre-trained models (~300MB) and has complex dependency chains (onnxruntime, platform-specific binaries). Model download can fail in restricted networks. Performance varies drastically with hardware. The model may not work on the demo laptop's webcam quality.
- **Impact:** CRITICAL — face verification is Act 2 of the demo, if it fails, 30% of the demo is lost
- **Likelihood:** HIGH
- **Mitigation:** **DO NOT rely on live InsightFace for the demo.** Pre-compute face embeddings during setup. Use cosine similarity comparison with a pre-loaded reference embedding. Display the comparison score. If live capture fails, use a pre-captured image. Have a "simulated mode" toggle that always succeeds.

## DR-02: MediaPipe WASM Compatibility with Electron (HIGH)
- **Description:** MediaPipe's JavaScript API uses WebAssembly (WASM) and WebGL. Electron's Chromium build may have compatibility issues with specific WASM features or GPU acceleration. This is a known pain point in the Electron ecosystem.
- **Impact:** HIGH — monitoring demo (Act 5) fails
- **Likelihood:** MEDIUM
- **Mitigation:** Test MediaPipe in Electron early (Day 1). If incompatible: run MediaPipe in a separate Python process that receives webcam frames via IPC. Alternative: use OpenCV's Haar cascades for basic face counting (much simpler, less impressive but reliable).

## DR-03: Demo Environment Instability (MEDIUM)
- **Description:** Running 4 Docker containers (backend, edge, PostgreSQL, Redis) + an Electron app + webcam on a single laptop is resource-intensive. RAM, CPU, and disk I/O contention can cause slowdowns or crashes during the demo.
- **Impact:** MEDIUM — sluggish demo, judges notice delays
- **Likelihood:** MEDIUM
- **Mitigation:** Pre-warm all containers. Pre-load all data. Close all unnecessary applications. Test on the actual demo laptop under full load. Have a pre-recorded video backup.

## DR-04: 5-Act Demo Is Too Long (MEDIUM)
- **Description:** The current DemoFlow.md specifies 5 acts across 8-10 minutes. Hackathon demos are typically 3-5 minutes with Q&A. Trying to show everything means showing nothing deeply.
- **Impact:** MEDIUM — rushed demo, judges don't absorb the key insights
- **Likelihood:** HIGH
- **Mitigation:** Cut to 3 core acts: (1) Encrypted question → decryption at exam time, (2) Exam with spatial randomization visible, (3) Crash recovery with audit trail. Total: 5 minutes. Drop face verification and monitoring to Q&A answers ("Yes, we built it, here's the code").

## DR-05: No Demo Reset Script (HIGH)
- **Description:** If the demo needs to be rerun (second judging round, practice run), there's no one-command reset to return everything to a clean starting state.
- **Impact:** HIGH — second demo fails because data is stale
- **Likelihood:** CERTAIN (demos always need reruns)
- **Mitigation:** Create `scripts/demo-reset.sh` that: drops and recreates databases, re-seeds test data, regenerates keys, and restarts all services. Must complete in < 30 seconds.

---

# Overengineered Components

## OE-01: RSA-4096 → Use RSA-2048
- **Description:** RSA-4096 key operations are 5-8x slower than RSA-2048. For a hackathon proof-of-concept, RSA-2048 provides identical security guarantees for practical purposes (both are unbreakable with current technology).
- **Savings:** Faster key generation, faster signing/verification. Simpler mental model.
- **Recommendation:** Use RSA-2048 for hackathon. Document RSA-4096 as production target.

## OE-02: HKDF Key Derivation → Use Direct Key Generation
- **Description:** HKDF derives center-specific keys from a master key. For a single-center demo, this adds cryptographic complexity with zero observable benefit. The derivation chain is invisible to judges.
- **Savings:** Remove 1 module (`shared/crypto/hkdf.py`). Simplify key management to: one AES key per package, one RSA key pair per node.
- **Recommendation:** Generate AES keys directly with `os.urandom(32)`. Store and distribute them alongside packages (encrypted with center's RSA public key). Document HKDF as production enhancement.

## OE-03: Separate Backend and Edge Applications → Single App with Mode Flag
- **Description:** Two separate FastAPI applications share the same patterns, the same `shared/` library, and much of the same code structure. Maintaining two separate `main.py`, two sets of models, two Dockerfiles, and two sets of dependencies is excessive for a hackathon.
- **Savings:** 4-6 hours of scaffolding time, 1 Docker image instead of 2, simpler imports.
- **Recommendation:** Single FastAPI app: `python -m server --mode cloud` (PostgreSQL) or `python -m server --mode edge` (SQLite). Routes are conditionally mounted based on mode. Shared models, shared services.

## OE-04: Redis on Edge → SQLite Only
- **Description:** Redis on the edge node serves as a secondary session cache. For a demo with 6 seats, SQLite handles all reads and writes with sub-millisecond latency. Redis adds a Docker container, config, and a failure mode.
- **Savings:** 1 fewer Docker container, simpler Docker Compose, simpler recovery logic (one source of truth).
- **Recommendation:** Remove Redis from edge deployment. Use SQLite as the only edge datastore. Recovery reads from SQLite only.

## OE-05: Full Graph Coloring at Runtime → Pre-Compute During Compilation
- **Description:** Running NetworkX graph coloring during exam setup is unnecessary if the seating layout is known at compilation time. The coloring can be pre-computed and included in the exam package.
- **Savings:** Remove runtime dependency on NetworkX from edge node. Simpler edge server.
- **Recommendation:** Compute graph coloring during exam compilation (cloud-side). Include seat→variant mapping in the package. Edge server simply looks up the mapping.

## OE-06: Nginx Reverse Proxy → Not Needed for Demo
- **Description:** The infrastructure includes nginx configuration. For a hackathon demo, all services are accessed directly by port. Nginx adds configuration complexity with zero demo benefit.
- **Savings:** Remove nginx from Docker Compose. Direct port access.
- **Recommendation:** Remove nginx. Access backend on :8000, edge on :8001, frontend on :3000 directly.

---

# Missing Components

## MC-01: Demo Reset Script (CRITICAL)
- **Description:** No script to reset the demo environment to a clean state. Essential for practice runs and re-demos.
- **Required:** `scripts/demo-reset.sh` — drops DBs, re-seeds, regenerates keys, restarts services.

## MC-02: Seed Data Generator (HIGH)
- **Description:** No script to create realistic demo data: 20 questions across 3 subjects, 1 exam, 1 center with 6 seats, 6 candidates with pre-computed face embeddings, seating assignments.
- **Required:** `scripts/seed-demo-data.py` — idempotent, runnable at any time.

## MC-03: Health Check Endpoints (MEDIUM)
- **Description:** No `/health` endpoint on either server. Docker Compose health checks, demo troubleshooting, and readiness detection all need health endpoints.
- **Required:** `GET /health` returning `{ "status": "ok", "mode": "cloud|edge", "db": "connected|error" }`.

## MC-04: Structured Logging (MEDIUM)
- **Description:** No logging strategy defined. In a demo, when something breaks, you need structured logs to diagnose quickly.
- **Required:** Python `structlog` or standard `logging` with JSON formatter. Log all API requests, errors, and crypto operations.

## MC-05: Admin Dashboard for Demo Orchestration (MEDIUM)
- **Description:** The TRD specifies an Admin Portal but no implementation is planned until Sprint 4 (last day). Without it, the demo requires curl/Postman for question creation and exam compilation — not impressive for judges.
- **Required:** Minimal admin page with 3 buttons: "Create Questions", "Compile Exam", "Release Key". Can be a single HTML page.

## MC-06: CORS Configuration (LOW)
- **Description:** The React frontend and desktop app make cross-origin requests to the FastAPI backend. Without CORS middleware, all browser requests will fail.
- **Required:** Add `fastapi.middleware.cors.CORSMiddleware` with appropriate origins.

## MC-07: Proctor Dashboard for Live Monitoring (LOW)
- **Description:** Security events are logged but there's no UI to display them during the demo. The monitoring demo (Act 5) needs a visible dashboard.
- **Required:** Minimal proctor page showing a live event feed. WebSocket or SSE-driven.

---

# Production vs Hackathon Gaps

| Feature | Hackathon Implementation | Production Requirement | Gap Severity |
|---|---|---|---|
| Key Management | RSA key files on disk | HSM / AWS KMS / Azure Key Vault | HIGH |
| Key Derivation | Direct AES key generation | HKDF with master key hierarchy | MEDIUM |
| Package Distribution | Direct HTTP transfer | CDN + signed URLs + resumable downloads | MEDIUM |
| Node Authentication | Implicit trust (same network) | Mutual TLS + certificate pinning | HIGH |
| Time-Locked Keys | Admin-triggered release button | TEE-based time enforcement / HSM timestamp | HIGH |
| Face Verification | Pre-computed embedding comparison | Live InsightFace + liveness detection | MEDIUM |
| Monitoring | Basic MediaPipe face counting | Custom ML models + behavioral analysis | LOW |
| Audit Storage | Single SQLite file per edge node | Replicated across multiple stores + cloud sync | MEDIUM |
| Deployment | Docker Compose on single machine | K8s with Nitro Enclaves per center | HIGH |
| Scale Testing | 6 seats, 1 center | 30+ seats per center, 10K centers | HIGH |
| Data Protection | No encryption at SQLite level | Full disk encryption + application-level encryption | MEDIUM |
| Disaster Recovery | None | Automated backup + cross-region replication | HIGH |
| Observability | Print statements | Prometheus + Grafana + ELK stack | MEDIUM |
| Load Balancing | None | Per-center with failover | MEDIUM |
| Compliance | None | DPDPA/GDPR-like data protection, audit retention | HIGH |

---

# Recommended Simplifications

## 1. Merge Backend and Edge into One Server Application

**Current:** Two separate FastAPI projects (`backend/` and `edge/`) with separate models, services, Dockerfiles.

**Proposed:** One FastAPI app (`server/`) that runs in either `cloud` or `edge` mode based on environment variable.

```
server/
├── app/
│   ├── main.py          # Mode-switchable entry point
│   ├── config.py         # DATABASE_URL picks PostgreSQL or SQLite
│   ├── api/
│   │   ├── cloud/        # Cloud-only routes (questions, compilation, distribution)
│   │   ├── edge/         # Edge-only routes (auth, exam, recovery, monitoring)
│   │   └── common/       # Shared routes (audit, health)
│   ├── models/           # Single model set, DB-agnostic via SQLAlchemy
│   ├── services/         # Single service set
│   └── db/
│       └── database.py   # Async engine from DATABASE_URL
```

**Benefits:** One scaffold, one Docker image, one test suite, shared models. `mode=cloud` mounts cloud routes + connects to PostgreSQL. `mode=edge` mounts edge routes + connects to SQLite.

## 2. Drop Redis from Edge — SQLite Only

Simplify recovery to single-source: SQLite with WAL. Recovery snapshot stored in the same SQLite database. No Redis container, no dual-write, no source-priority logic.

## 3. Simplify Face Verification to Embedding Comparison

Don't load InsightFace at runtime. Pre-compute embeddings during data seeding. At auth time, capture a face image, compute a basic embedding (or use a pre-captured one for demo), and compare using cosine similarity. This is reliable and fast.

## 4. Pre-Compute Graph Coloring During Compilation

Move graph coloring from edge runtime to cloud compilation time. The package includes `seat_id → variant_id` mapping. Edge server just looks up the mapping.

## 5. Admin-Triggered Key Release Instead of Time-Lock

Replace the underspecified "time-lock" with a simple admin API: `POST /api/v1/exams/{id}/release-key`. Admin clicks a button at exam time. Key is sent to edge. This is honest, demonstrable, and avoids the clock-sync problem entirely.

## 6. Three-Act Demo Instead of Five

Focus demo on the three strongest differentiators:
- **Act 1:** Encrypted questions → key release → decryption (2 min)
- **Act 2:** Exam with spatial randomization + crash recovery (3 min)
- **Act 3:** Audit trail tamper detection (1 min)

Total: 6 minutes. Face verification and monitoring shown via code walkthrough or pre-recorded clip during Q&A.

---

# Recommended MVP Scope

## Must Build (Demo Blockers)

| # | Feature | Estimated Effort | Justification |
|---|---|---|---|
| 1 | AES-256-GCM encryption/decryption module | 3 hours | Foundation for all security claims |
| 2 | RSA-2048 signing/verification module | 2 hours | Package integrity + QR signing |
| 3 | Hash-chained audit ledger | 3 hours | Core differentiator (#1 feature) |
| 4 | PostgreSQL schema + SQLAlchemy models | 3 hours | Data foundation |
| 5 | Question CRUD API with auto-encryption | 4 hours | First visible demo feature |
| 6 | Exam compilation + package generation | 4 hours | Connects questions to exam |
| 7 | Graph coloring variant generator | 3 hours | Second differentiator |
| 8 | Edge server with SQLite | 2 hours | Exam execution platform |
| 9 | QR token auth (simplified, no face) | 3 hours | Session gating |
| 10 | Electron app + kiosk mode + exam UI | 10 hours | The user-facing experience |
| 11 | Answer submission + auto-save | 3 hours | Core exam function |
| 12 | State recovery from SQLite snapshot | 4 hours | Third differentiator (dramatic demo) |
| 13 | Demo seed data script | 2 hours | Demo reliability |
| 14 | Demo reset script | 1 hour | Demo repeatability |
| 15 | Docker Compose (3 containers) | 2 hours | Deployment |

**Total Must-Build:** ~49 hours

## Should Build (Enhances Demo)

| # | Feature | Estimated Effort |
|---|---|---|
| 16 | Minimal admin page (3 buttons) | 4 hours |
| 17 | Audit trail viewer (read-only page) | 3 hours |
| 18 | Face embedding comparison (pre-computed) | 4 hours |
| 19 | Proctor event feed (WebSocket) | 3 hours |

**Total Should-Build:** ~14 hours

## Nice to Have (If Time Permits)

| # | Feature | Estimated Effort |
|---|---|---|
| 20 | MediaPipe face detection in Electron | 6 hours |
| 21 | Gaze tracking | 4 hours |
| 22 | Full admin dashboard | 8 hours |
| 23 | Result scoring | 3 hours |

**Total Nice-to-Have:** ~21 hours

---

# Recommended Demo Scope

## The 6-Minute Demo

### Act 1: "The Paper That Can't Leak" (2 min)
1. Show admin page → Create question → Show DB: only ciphertext stored
2. Compile exam → Show signed package
3. Click "Release Key" → Edge receives key → Package decrypted

### Act 2: "The Exam That Can't Be Cheated or Crashed" (3 min)
4. QR scan → Session created → Exam loads in kiosk mode
5. Side-by-side: Seat A and Seat B see different question orders
6. Answer 3 questions → Kill Electron process → Restart → All answers recovered

### Act 3: "The Record That Can't Be Altered" (1 min)
7. Show audit trail → All events hash-chained
8. Tamper one event → Chain verification fails → Tampering detected

### Closing (30 sec)
> "Zero Trust. Edge-First. Cryptographically Accountable."

---

# Recommended Build Order

```
WEEK 1 — DAY 1 (Foundation + Crypto)
───────────────────────────────────
1. [3h] shared/crypto: AES-256-GCM + RSA-2048 + SHA-256 + JWT
2. [3h] shared/audit: hash chain generator + verifier
3. [3h] server: FastAPI scaffold + SQLAlchemy models + PostgreSQL schema
4. [2h] infrastructure: Docker Compose (server + postgres + sqlite)

DAY 1 DELIVERABLE: Server starts, crypto tests pass, DB migrated
───────────────────────────────────

WEEK 1 — DAY 2 (APIs + Compilation)
───────────────────────────────────
5. [4h] Question CRUD API with auto-encryption
6. [4h] Exam compilation + graph coloring + package generation
7. [3h] QR token generation + signing + validation
8. [2h] Edge mode: SQLite setup, auth endpoint, session creation

DAY 2 DELIVERABLE: Questions created, exam compiled, package generated, QR auth works
───────────────────────────────────

WEEK 1 — DAY 3 (Desktop + Recovery)
───────────────────────────────────
9.  [4h] Electron scaffold + kiosk mode + preload
10. [6h] React exam UI: question display, navigation, timer
11. [3h] Answer submission API + auto-save to SQLite
12. [4h] State recovery: snapshot save + restore + re-auth flow

DAY 3 DELIVERABLE: Full exam flow works end-to-end, recovery demo works
───────────────────────────────────

WEEK 1 — DAY 4 (Polish + Demo)
───────────────────────────────────
13. [4h] Minimal admin page + audit viewer
14. [3h] Face embedding comparison (pre-computed, demo fallback)
15. [2h] Seed data + reset scripts
16. [2h] Demo rehearsal + timing
17. [2h] Bug fixes + polish
18. [1h] Documentation update

DAY 4 DELIVERABLE: Demo-ready, all scripts work, presentation rehearsed
```

---

# Recommended Technology Stack (Revised)

## Final Stack

| Layer | Technology | Justification |
|---|---|---|
| **Server** | Python 3.11 + FastAPI | Async, fast, great docs, team knows it |
| **ORM** | SQLAlchemy 2.0 (async) | Supports both PostgreSQL and SQLite from same models |
| **Cloud DB** | PostgreSQL 15 | Robust, ACID, JSONB support |
| **Edge DB** | SQLite (WAL mode) | Zero-config, crash-safe, file-based |
| **Cache** | ❌ Redis removed from edge | Simplification — SQLite is sufficient |
| **Admin Auth** | **Clerk** (`@clerk/clerk-react` + JWKS verification) | Pre-built auth, saves 8-12h, production-grade MFA |
| **Candidate Auth** | Custom (QR + face embedding + per-node RSA JWT) | Offline-first, no external dependency |
| **Crypto** | `cryptography` library (Python) | AES-256-GCM, RSA-2048, SHA-256 |
| **JWT (edge)** | PyJWT | Lightweight, per-node RSA signing |
| **Graph** | NetworkX (cloud-side only) | Graph coloring during compilation |
| **Frontend** | React 18 + TypeScript + Vite | Modern, fast build, component-based |
| **Desktop** | Electron 28+ + React | Kiosk mode, IPC, webcam access |
| **Face AI** | OpenCV (basic) + cosine similarity | Reliable; InsightFace as optional enhancement |
| **Monitoring** | MediaPipe (optional) | Only if Electron compatibility confirmed Day 1 |
| **Deployment** | Docker Compose (3 containers) | Server (cloud), server (edge), PostgreSQL |
| **Build** | Makefile | One-command setup, test, run, reset |

## Containers (Simplified)

```yaml
services:
  cloud-server:     # FastAPI --mode cloud (port 8000)
    depends_on: [postgres]
  edge-server:      # FastAPI --mode edge (port 8001, SQLite volume)
  postgres:         # PostgreSQL 15 (port 5432)
  # Electron desktop app runs natively (not containerized)
```

**From 5 containers to 3.** Redis removed. Nginx removed.

---

# Recommended Monorepo Structure (Revised)

```
fortis-exam/
│
├── server/                           # Single FastAPI app (cloud + edge modes)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # Entry point, mode selection
│   │   ├── config.py                 # Environment-driven config
│   │   ├── api/
│   │   │   ├── cloud/                # Cloud-only routes
│   │   │   │   ├── questions.py
│   │   │   │   ├── exams.py
│   │   │   │   ├── packages.py
│   │   │   │   └── distribution.py
│   │   │   ├── edge/                 # Edge-only routes
│   │   │   │   ├── auth.py
│   │   │   │   ├── exam.py
│   │   │   │   ├── recovery.py
│   │   │   │   └── monitoring.py
│   │   │   └── common/               # Shared routes
│   │   │       ├── audit.py
│   │   │       └── health.py
│   │   ├── models/                   # DB-agnostic SQLAlchemy models
│   │   ├── schemas/                  # Pydantic schemas
│   │   ├── services/                 # Business logic
│   │   └── db/
│   │       └── database.py           # Async engine (PostgreSQL or SQLite)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── alembic.ini
│
├── shared/                           # Shared Python libraries
│   ├── crypto/                       # AES, RSA, JWT, hashing
│   ├── audit/                        # Hash chain, verification
│   └── graph/                        # Layout, coloring, variants
│
├── web/                              # Admin portal (React + Vite + Clerk)
│   ├── src/
│   │   ├── components/               # Clerk-wrapped pages + admin UI
│   │   ├── middleware/               # Clerk auth guards
│   │   └── ...
│   ├── package.json                  # @clerk/clerk-react, react, vite
│   └── vite.config.ts
│
├── desktop/                          # Candidate kiosk (Electron + React)
│   ├── electron/                     # Main process
│   ├── src/                          # Renderer (React)
│   ├── package.json
│   └── electron-builder.yml
│
├── scripts/                          # Automation
│   ├── setup.sh                      # First-time setup
│   ├── seed-demo-data.py             # Populate demo data
│   ├── demo-reset.sh                 # Reset to clean demo state
│   └── generate-keys.sh              # RSA key generation
│
├── docker/                           # Docker configs
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   └── .env.example
│
├── tests/                            # All tests
│   ├── unit/
│   ├── integration/
│   ├── security/
│   └── conftest.py
│
├── docs/                             # Source documents (read-only)
├── vault/                            # Project memory vault
├── Makefile                          # make setup, make run, make test, make demo, make reset
├── .gitignore
└── README.md
```

**Key changes from original:**
1. `backend/` + `edge/` → `server/` (single app, mode-switchable)
2. `frontend/` → `web/` (shorter, clearer)
3. `infrastructure/` → `docker/` + `scripts/` (separated concerns)
4. Added `scripts/demo-reset.sh` and `scripts/seed-demo-data.py`
5. Flattened `tests/` (unit/integration/security instead of by-module)
6. Added `Makefile` at root

---

# Estimated Effort Per Module

| Module | Scope | Estimated Hours | Complexity | Risk |
|---|---|---|---|---|
| **Shared Crypto** (AES, RSA, JWT, SHA-256) | 4 files, ~300 LoC | 5h | Medium | Low |
| **Shared Audit** (hash chain + verifier) | 3 files, ~200 LoC | 3h | Medium | Low |
| **Shared Graph** (layout, coloring, variants) | 4 files, ~250 LoC | 4h | Medium | Low |
| **Server Scaffold** (FastAPI + SQLAlchemy + config) | 5 files, ~200 LoC | 3h | Low | Low |
| **Database Schema** (PostgreSQL + SQLite models) | 7 models, ~400 LoC | 3h | Low | Low |
| **Question API** (CRUD + auto-encrypt) | 2 files, ~300 LoC | 4h | Medium | Low |
| **Exam Compilation** (blueprint + package gen) | 2 files, ~300 LoC | 4h | Medium | Low |
| **QR Auth** (generate, sign, validate, session) | 3 files, ~250 LoC | 3h | Medium | Low |
| **Face Verification** (pre-computed embedding match) | 1 file, ~100 LoC | 2h | Low | **Medium** |
| **Electron Scaffold** (kiosk, preload, IPC) | 4 files, ~300 LoC | 4h | Medium | Medium |
| **Exam UI** (questions, nav, timer, auto-save) | 6 components, ~800 LoC | 10h | **High** | Medium |
| **State Recovery** (snapshot save/restore) | 2 files, ~200 LoC | 4h | Medium | Low |
| **Monitoring** (MediaPipe + events) | 2 files, ~200 LoC | 5h | Medium | **High** |
| **Admin Page** (Clerk + 3 action buttons) | 2 components, ~200 LoC | 3h | Low | Low |
| **Audit Viewer** (read-only chain display) | 2 components, ~200 LoC | 3h | Low | Low |
| **Docker + Scripts** (compose, seed, reset) | 5 files | 3h | Low | Low |
| **Testing** (unit + integration) | 15 test files | 8h | Medium | Low |
| | | **TOTAL: ~72h** | | |

**For a 4-person team over 4 days (roughly 16h/day each = 256 person-hours available):** This is comfortably achievable with margin for debugging and polish.

---

## Related Documents

- [[Decisions]] — Updated with review findings
- [[Roadmap]] — Updated with revised build order
- [[ThreatModel]] — Updated with new threats
- [[RepositoryStructure]] — Superseded by revised monorepo structure above
- [[DemoFlow]] — Should be updated to reflect 3-act structure
