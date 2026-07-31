# FortisExam — Architectural Decisions Log

> **Last Updated:** 2026-06-08 (Post Architecture Review)

---

## Decision Format

Each decision records the context, choice made, alternatives considered, and consequences.

For formal Architecture Decision Records, see [[ADRs/]].

---

## D-001: Edge-First Architecture over Cloud-First

**Date:** 2026-06-08
**Status:** Accepted ✅
**Review Note:** Confirmed as the strongest architectural decision. Eliminates the scaling bottleneck entirely.

**Context:** National exams serve millions of candidates across thousands of centers. Internet connectivity is unreliable in many regions. Cloud-first designs create single points of failure during exam execution.

**Decision:** Each exam center operates as an independent edge node. The cloud is used only for pre-exam preparation (authoring, compilation, distribution) and post-exam aggregation. Exam execution is fully offline.

**Alternatives:**
- Cloud-first with offline fallback (rejected: fallback is a second-class experience)
- Hybrid with real-time cloud sync (rejected: network dependency during exams)

**Consequences:**
- ✅ Centers operate without internet during exams
- ✅ No cloud bottleneck during peak
- ⚠️ Edge nodes must be provisioned and secured independently
- ⚠️ Post-exam data aggregation is eventually consistent

---

## D-002: AES-256-GCM for Question Encryption

**Date:** 2026-06-08
**Status:** Accepted ✅ (with RSA simplification — see D-008)

**Context:** Questions must remain confidential until exam start. Encryption must be fast enough for batch operations and provide both confidentiality and integrity.

**Decision:** Use AES-256-GCM for symmetric encryption of question content and packages. Use RSA for key wrapping.

**Alternatives:**
- ChaCha20-Poly1305 (rejected: AES has broader hardware acceleration support)
- AES-256-CBC + HMAC (rejected: GCM provides authenticated encryption in one pass)

**Consequences:**
- ✅ AEAD ensures integrity + confidentiality
- ✅ Hardware-accelerated on most platforms
- ⚠️ GCM nonce reuse is catastrophic — must enforce unique nonces

---

## D-003: SQLite for Edge-Local Persistence

**Date:** 2026-06-08
**Status:** Accepted ✅ (Redis removed from edge — see D-010)

**Context:** Edge nodes need a local database for exam sessions, answers, and recovery snapshots. The database must work without a network and survive process crashes.

**Decision:** Use SQLite with WAL mode as the sole edge datastore.

**Alternatives:**
- Embedded PostgreSQL (rejected: heavier footprint, unnecessary for edge)
- LevelDB/RocksDB (rejected: no SQL interface, harder to query)
- SQLite + Redis dual-write (rejected in review: Redis adds complexity with zero demo benefit — see D-010)

**Consequences:**
- ✅ Zero-config, file-based, crash-resilient with WAL
- ✅ Well-understood, widely supported
- ✅ Single source of truth simplifies recovery logic
- ⚠️ Single-writer limitation (acceptable for per-node deployment at demo scale)

---

## D-004: Spatial Graph Coloring for Anti-Copying

**Date:** 2026-06-08
**Status:** Accepted ✅ (with pre-computation simplification — see D-011)

**Context:** Adjacent candidates can copy answers. Simple random shuffling doesn't guarantee that neighbors see different question orders.

**Decision:** Model the seating layout as a graph. Adjacent seats are connected by edges. Apply graph coloring to assign distinct exam variants to adjacent seats, ensuring neighbors never share question or option order.

**Alternatives:**
- Random shuffling only (rejected: doesn't guarantee neighbor differentiation)
- Pre-computed fixed variants (rejected: predictable, not scalable)

**Consequences:**
- ✅ Mathematically guarantees adjacent candidates see different variants
- ✅ Scales with center layout
- ⚠️ Requires seating layout input from center admin

---

## D-005: Hash-Chained Audit Ledger

**Date:** 2026-06-08
**Status:** Accepted ✅
**Review Note:** Identified as the #1 differentiating feature. Must be demo'd prominently.

**Context:** Every critical exam operation must be verifiable after the fact. Standard logging is mutable and untrustworthy.

**Decision:** Implement a linear hash chain where each audit event includes the SHA-256 hash of the previous event. Chain is verifiable end-to-end.

**Alternatives:**
- Blockchain (rejected: explicitly out of scope per PRD; overkill for this use case)
- Append-only log with periodic snapshots (rejected: no cryptographic integrity guarantee)
- Full Merkle tree (rejected for hackathon: linear chain is sufficient, Merkle tree is production enhancement)

**Consequences:**
- ✅ Any tampering breaks the hash chain and is detectable
- ✅ Lightweight, no consensus mechanism needed
- ⚠️ Chain must be verified during post-exam audit phase

---

## D-006: Electron for Candidate Kiosk

**Date:** 2026-06-08
**Status:** Accepted ✅

**Context:** Candidates use secured terminals in kiosk mode. The application must lock down the desktop environment, render exam UI, capture webcam for monitoring, and communicate with the local edge server.

**Decision:** Use Electron with React frontend. Electron provides kiosk mode, IPC, and native API access. React provides component-based UI.

**Alternatives:**
- Native app (C++/Qt) — (rejected: slower development, smaller team skill match)
- Progressive Web App (rejected: insufficient OS-level lockdown capability)

**Consequences:**
- ✅ Cross-platform, full kiosk mode support
- ✅ React ecosystem for rapid UI development
- ⚠️ Larger binary size than native
- ⚠️ Electron security hardening needed (disable devtools, restrict navigation)

---

## D-007: MediaPipe for Edge AI Monitoring

**Date:** 2026-06-08
**Status:** Accepted with Caution ⚠️
**Review Note:** HIGH demo risk. Must test Electron + MediaPipe WASM compatibility on Day 1. Have OpenCV Haar cascade fallback ready.

**Context:** Monitoring must run locally on edge nodes without cloud inference. Models must be lightweight and run on commodity hardware.

**Decision:** Use Google MediaPipe for face detection (multiple faces) and face mesh (gaze tracking). Runs entirely client-side.

**Alternatives:**
- TensorFlow Lite custom models (rejected: higher development effort)
- OpenCV DNN module (rejected: less accurate for face mesh/gaze)
- OpenCV Haar cascades (kept as fallback: less accurate but guaranteed Electron compatibility)
- Cloud-based inference (rejected: violates offline-first principle)

**Consequences:**
- ✅ Runs offline on commodity hardware
- ✅ Well-documented, actively maintained
- ⚠️ WASM compatibility with Electron is untested — HIGH RISK
- ⚠️ Detection accuracy may vary with camera quality and lighting

---

## D-008: RSA-2048 for Hackathon (NEW — from Architecture Review)

**Date:** 2026-06-08
**Status:** Accepted ✅

**Context:** RSA-4096 key operations are 5-8x slower than RSA-2048. For a hackathon demo, the additional key strength provides zero practical benefit (both are unbreakable with current technology). The slowdown is noticeable during batch signing.

**Decision:** Use RSA-2048 for the hackathon implementation. Document RSA-4096 as the production target.

**Consequences:**
- ✅ Faster key generation, signing, and verification
- ✅ Simpler for demo
- ⚠️ Must upgrade to RSA-4096 for production (documented in TechnicalDebt)

---

## D-009: Single Server Application with Mode Flag (NEW — from Architecture Review)

**Date:** 2026-06-08
**Status:** Accepted ✅

**Context:** The original design had two separate FastAPI applications (backend/ and edge/) that shared ~60% of their patterns and both depended on the same shared/ library. This doubles scaffolding effort, creates two Docker images, and introduces import path complexity — all unnecessary for a hackathon.

**Decision:** Merge into a single FastAPI application (`server/`) that runs in either `cloud` or `edge` mode based on the `SERVER_MODE` environment variable. Cloud mode mounts cloud routes and connects to PostgreSQL. Edge mode mounts edge routes and connects to SQLite.

**Alternatives:**
- Keep separate apps (rejected: 4-6 hours of wasted scaffolding for identical patterns)
- Microservices (rejected: overkill for hackathon, correct for production)

**Consequences:**
- ✅ Single scaffold, single Docker image, single test suite
- ✅ Shared SQLAlchemy models work across both databases
- ✅ Saves 4-6 hours of setup time
- ⚠️ Must be split into separate services for production deployment

---

## D-010: Remove Redis from Edge Deployment (NEW — from Architecture Review)

**Date:** 2026-06-08
**Status:** Accepted ✅

**Context:** Redis on the edge was intended for high-speed session caching and as a secondary recovery source. For a hackathon demo with 6 seats, SQLite handles all reads and writes with sub-millisecond latency. Redis adds a Docker container, configuration, and dual-write complexity with zero observable benefit.

**Decision:** Remove Redis from edge deployment. SQLite is the sole edge datastore. Recovery reads from SQLite only.

**Alternatives:**
- Keep Redis as secondary cache (rejected: adds container, config, failure mode, zero demo benefit)

**Consequences:**
- ✅ One fewer Docker container
- ✅ Simpler recovery logic (single source of truth)
- ✅ Simpler Docker Compose
- ⚠️ Production deployment should add Redis for centers with 30+ concurrent candidates

---

## D-011: Pre-Compute Graph Coloring During Compilation (NEW — from Architecture Review)

**Date:** 2026-06-08
**Status:** Accepted ✅

**Context:** The original design ran graph coloring at the edge during exam setup. However, the seating layout is known at compilation time. Running NetworkX at the edge adds a runtime dependency that's unnecessary.

**Decision:** Compute graph coloring during exam compilation (cloud-side). Include `seat_id → variant_id` mapping in the exam package. Edge server performs a simple lookup.

**Consequences:**
- ✅ No NetworkX dependency on edge server
- ✅ Simpler edge runtime
- ✅ Coloring is verified before distribution
- ⚠️ Layout changes after compilation require recompilation

---

## D-012: Admin-Triggered Key Release Instead of Time-Lock (NEW — from Architecture Review)

**Date:** 2026-06-08
**Status:** Accepted ✅

**Context:** Multiple documents reference "time-locked keys" but the mechanism was never specified. The time-lock concept requires either TEE-based clock enforcement or HSM-backed time checks — both are production features.

**Decision:** For the hackathon, replace time-locked keys with an admin-triggered API call: `POST /api/v1/exams/{id}/release-key`. The admin clicks a button at exam start time, and the decryption key is sent to the edge node.

**Alternatives:**
- Server-side time check (rejected: clock manipulation risk, added complexity)
- TEE-based enforcement (rejected: production feature, not available for demo)

**Consequences:**
- ✅ Simple, demonstrable, honest
- ✅ Eliminates the clock-sync problem
- ✅ Can be shown live in demo ("Watch me release the key now")
- ⚠️ Production must implement automated time-locked release via TEE/HSM

---

## D-013: Three-Act Demo Structure (NEW — from Architecture Review)

**Date:** 2026-06-08
**Status:** Accepted ✅

**Context:** The original 5-act, 8-10 minute demo tries to show everything and risks showing nothing deeply. Hackathon demos are typically 3-5 minutes plus Q&A. The strongest differentiators are: encryption, spatial randomization, crash recovery, and audit tamper detection.

**Decision:** Reduce demo to 3 focused acts in 6 minutes:
1. Encrypted questions → key release → decryption (2 min)
2. Exam execution with spatial randomization + crash recovery (3 min)
3. Audit trail tamper detection (1 min)

Face verification and monitoring are mentioned in Q&A, not shown live.

**Consequences:**
- ✅ Each act gets deep attention
- ✅ Fits standard hackathon time slots
- ✅ Strongest features showcased
- ⚠️ Face verification and monitoring code exists but isn't demoed live

---

## D-014: Clerk for Admin Portal Authentication (NEW — User Decision)

**Date:** 2026-06-08
**Status:** Accepted ✅
**ADR:** [[ADR-002-ClerkAuthentication]]

**Context:** FortisExam has two authentication domains: (1) Admin portal — standard web auth for exam authorities, and (2) Candidate kiosk — offline QR+face auth at edge nodes. Building custom admin auth (password hashing, email verification, session management, MFA, RBAC) is estimated at 8-12 hours of commodity work that is not a differentiator.

**Decision:** Use **Clerk** (`@clerk/clerk-react` + Clerk JWT verification on backend) for all admin portal authentication. Candidate authentication at the edge remains fully custom and offline.

**Scope:**
- ✅ Clerk handles: Admin login, signup, sessions, MFA, user management, JWT issuance
- ❌ Clerk does NOT touch: Candidate QR auth, face verification, edge sessions (all offline/custom)

**Integration:**
- Frontend (`web/`): `<ClerkProvider>`, `<SignIn>`, `<UserButton>`, `useAuth()`
- Backend (`server/ --mode cloud`): Clerk JWT verification middleware on all cloud API routes
- Database: `users` table simplified — stores `clerk_user_id`, `role`, `name` (no `password_hash`)

**Alternatives:**
- Custom auth (bcrypt + JWT) — rejected: 8-12h commodity work, potential security bugs
- Auth0 — rejected: more complex setup
- Supabase Auth — viable but Clerk has better React DX

**Consequences:**
- ✅ Saves 8-12 hours of auth development
- ✅ Production-grade auth from Day 1 (MFA, session mgmt)
- ✅ Pre-built React components accelerate admin portal
- ⚠️ Cloud backend requires internet for Clerk JWT verification (acceptable)
- ⚠️ Edge server does NOT use Clerk — must remain fully offline
- ⚠️ Free tier: 10,000 MAU (more than enough for hackathon)

---

## Architecture Validation Summary (Post-Review)

### Confirmed Strengths
1. Edge-first architecture — correct for the problem domain
2. Hash-chained audit ledger — #1 differentiator
3. Graph coloring for anti-copying — novel, visual, rigorous
4. Crash recovery as first-class feature — dramatic demo moment
5. Clean separation of concerns via shared libraries

### Addressed Weaknesses
1. Two separate FastAPI apps → merged into one (D-009)
2. Redis on edge → removed (D-010)
3. RSA-4096 → RSA-2048 for demo (D-008)
4. Time-lock underspecified → admin-triggered release (D-012)
5. Runtime graph coloring → pre-computed (D-011)
6. 5-act demo → 3-act demo (D-013)

### Remaining Gaps (Accepted for Hackathon)
1. No TLS between desktop and edge (local network assumption)
2. RSA key stored as file (no HSM)
3. Face embeddings stored unencrypted (demo data only)
4. No rate limiting on APIs
5. Electron devtools bypass risk

---

## Related Documents

- [[ArchitectureReview]] — Full architecture review
- [[ThreatModel]] — Security threat analysis
- [[ADRs/]] — Formal architecture decision records
- [[Roadmap]] — Impact of decisions on timeline
