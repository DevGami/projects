# FortisExam — Roadmap (Post Architecture Review)

> **Last Updated:** 2026-06-08 (Revised per Architecture Review)
> **Context:** Hackathon with production-evolution path
> **Methodology:** Simplified stack, merged server, 3-act demo

---

## Development Phases (Revised)

### Phase 0: Foundation ✅ COMPLETE
**Duration:** Day 1 (first half)
**Goal:** Vault, analysis, planning, architecture review

| Task | Status |
|---|---|
| Create project vault (53 files) | ✅ Done |
| Analyze PRD/TRD/Architecture | ✅ Done |
| Architecture review (4 perspectives) | ✅ Done |
| Design revised repository structure | ✅ Done |
| Generate revised sprint plan | ✅ Done |

---

### Phase 1: Core Crypto + Server Scaffold
**Duration:** Day 1 (second half) — ~11 hours
**Goal:** All crypto primitives, server scaffold, database, Docker

| # | Task | Priority | Effort | Depends On |
|---|---|---|---|---|
| 1 | AES-256-GCM encrypt/decrypt module (`shared/crypto/aes.py`) | P0 | 2h | — |
| 2 | RSA-2048 sign/verify module (`shared/crypto/rsa.py`) | P0 | 2h | — |
| 3 | SHA-256 hashing + JWT handler (`shared/crypto/`) | P0 | 1h | — |
| 4 | Hash chain generator + verifier (`shared/audit/`) | P0 | 3h | SHA-256 |
| 5 | FastAPI server scaffold with mode flag (`server/`) | P0 | 2h | — |
| 6 | SQLAlchemy models + PostgreSQL schema | P0 | 3h | Server scaffold |
| 7 | Docker Compose (server-cloud, server-edge, postgres) | P0 | 2h | Server scaffold |
| 8 | Unit tests for crypto + audit modules | P0 | 2h | Modules 1-4 |

**Day 1 Deliverable:** Server starts in both modes, crypto tests pass, DB migrated.

**Parallelization:** Tasks 1-3 (crypto) are independent of tasks 5-6 (server). Two developers can work simultaneously.

---

### Phase 2: APIs + Compilation + Auth
**Duration:** Day 2 — ~13 hours
**Goal:** Question API, exam compilation, graph coloring, QR authentication

| # | Task | Priority | Effort | Depends On |
|---|---|---|---|---|
| 9 | Question CRUD API with auto-encryption | P0 | 4h | Phase 1 |
| 10 | Graph builder + coloring (`shared/graph/`) | P0 | 3h | — | ✅ Done |
| 11 | Variant generator (question/option shuffle) | P0 | 2h | Graph coloring | ✅ Done |
| 12 | Exam compilation + package generation + signing | P0 | 4h | Questions, Graph |
| 13 | QR token generation + signing | P0 | 2h | RSA module |
| 14 | Edge auth endpoint (QR validate + session creation) | P0 | 3h | Edge mode, QR |
| 15 | Admin key release API (`POST /exams/{id}/release-key`) | P0 | 1h | Phase 1 |
| 16 | Seed demo data script (`scripts/seed-demo-data.py`) | P0 | 2h | APIs working |

**Day 2 Deliverable:** Questions created + encrypted, exam compiled with graph coloring, package generated, QR auth works, demo data loaded.

**Parallelization:** Tasks 10-11 (graph) are independent of task 9 (question API). Tasks 13-14 (auth) can start as soon as RSA module exists.

---

### Phase 3: Desktop App + Recovery
**Duration:** Day 3 — ~17 hours
**Goal:** Electron kiosk, exam UI, answer flow, crash recovery

| # | Task | Priority | Effort | Depends On |
|---|---|---|---|---|
| 17 | Electron scaffold + kiosk mode + preload | P0 | 4h | — |
| 18 | React exam UI: question display + option selection | P0 | 4h | Electron |
| 19 | Navigation (prev/next/jump) + progress indicator | P0 | 2h | Exam UI |
| 20 | Timer component | P0 | 1h | Exam UI |
| 21 | Answer submission API (edge) + auto-save to SQLite | P0 | 3h | Edge server |
| 22 | Recovery snapshot save (on every answer) | P0 | 2h | Auto-save |
| 23 | Recovery restore endpoint + UI flow | P0 | 3h | Snapshot save |
| 24 | Face embedding comparison (pre-computed, demo mode) | P1 | 2h | OpenCV |

**Day 3 Deliverable:** Full exam flow works end-to-end, crash recovery demo works, face comparison works with pre-loaded embeddings.

**Parallelization:** Tasks 17-20 (desktop) and tasks 21-23 (edge server recovery) can be done by different developers.

---

### Phase 4: Polish + Demo Prep
**Duration:** Day 4 — ~13 hours
**Goal:** Admin page, audit viewer, demo scripts, rehearsal

| # | Task | Priority | Effort | Depends On |
|---|---|---|---|---|
| 25 | Minimal admin page (create questions, compile, release key) | P1 | 4h | Cloud APIs |
| 26 | Audit trail viewer (read-only, show hash chain) | P1 | 3h | Audit API |
| 27 | Demo reset script (`scripts/demo-reset.sh`) | P0 | 1h | All |
| 28 | CORS middleware + health endpoints | P0 | 1h | Server |
| 29 | MediaPipe face detection (if Electron-compatible) | P2 | 4h | Electron |
| 30 | End-to-end integration testing | P0 | 3h | All |
| 31 | Demo rehearsal + timing (3-act structure) | P0 | 2h | All |
| 32 | Bug fixes + polish | P0 | 3h | Integration |
| 33 | Vault + documentation finalization | P0 | 1h | All |

**Day 4 Deliverable:** Demo-ready system, all scripts work, presentation rehearsed, vault updated.

---

## Critical Path (Revised)

```
Crypto modules → Server scaffold → DB schema → Question API → Compilation
→ Package generation → Edge mode → QR auth → Electron app → Exam UI
→ Answer save → Recovery → Demo prep
```

**Parallel tracks:**
- Track A: Server + APIs (critical path)
- Track B: Crypto + Audit (foundations, feeds into Track A)
- Track C: Graph coloring + Variants (independent, feeds into compilation)
- Track D: Electron + UI (starts Day 3, consumes Track A's APIs)

---

## Module Dependency Graph (Revised)

```
shared/crypto (AES, RSA, JWT, SHA-256)
    ↓
shared/audit (hash chain)          shared/graph (coloring, variants)
    ↓                                   ↓
server (cloud mode)                 server (edge mode)
    ↓                                   ↓
Question API → Compilation → Package    QR Auth → Exam API → Recovery
                    ↓                        ↓
              Distribution ──────→ Edge receives package
                                         ↓
                                   desktop (Electron + React)
                                   Exam UI → Answer save → Recovery UI
```

---

## Risk Areas (Revised)

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| InsightFace model download fails | HIGH | HIGH | Use pre-computed embeddings + cosine similarity |
| MediaPipe WASM incompatible with Electron | MEDIUM | MEDIUM | Test Day 1; fallback to OpenCV Haar cascades |
| SQLAlchemy model compatibility (PostgreSQL ↔ SQLite) | MEDIUM | MEDIUM | Test both backends early; avoid PostgreSQL-specific features |
| Electron kiosk bypass on demo machine | LOW | LOW | Disable devtools, keyboard shortcuts in build config |
| Demo laptop resource contention (Docker + Electron) | MEDIUM | MEDIUM | Pre-warm containers, pre-load data, close background apps |
| Demo data inconsistency after failed rehearsal | HIGH | CERTAIN | Demo reset script (P0, build on Day 4) |

---

## Demo Priorities (Revised — 3-Act Structure)

1. **🔴 Act 1 (MUST):** Encrypted question → admin releases key → decryption at exam time
2. **🔴 Act 2 (MUST):** QR auth → exam in kiosk mode → spatial randomization visible → crash → recovery
3. **🔴 Act 3 (MUST):** Audit trail → hash chain verification → tamper detection
4. **🟡 Q&A Material:** Face verification (show code/pre-recorded clip)
5. **🟡 Q&A Material:** Anomaly detection (show code/pre-recorded clip)
6. **🟢 Backup:** Admin dashboard walkthrough
7. **🟢 Backup:** Post-exam scoring

---

## Hackathon vs Production Scope (Revised)

| Feature | Hackathon | Production |
|---|---|---|
| Server architecture | Single FastAPI app, mode-switchable | Separate microservices per zone |
| RSA key size | RSA-2048 | RSA-4096 |
| Key derivation | Direct AES key generation | HKDF from master key |
| Key release | Admin-triggered button | TEE/HSM time-locked |
| Edge database | SQLite only | SQLite + Redis |
| Face verification | Pre-computed embedding + cosine similarity | Live InsightFace + liveness detection |
| Graph coloring | Pre-computed during compilation | Same (correct approach) |
| Monitoring | Basic MediaPipe (if compatible) | Custom ML models |
| Audit | Linear hash chain | Merkle tree + replication |
| Deployment | Docker Compose (3 containers) | K8s + Nitro Enclaves |
| Scale | 1 center, 6 seats | 10,000+ centers, 30+ seats each |
| Containers | 3 (cloud-server, edge-server, postgres) | Many (per-service, per-center) |

---

## Estimated Timeline

| Day | Phase | Hours | Deliverable |
|---|---|---|---|
| 1 (first half) | Phase 0: Foundation | 4h | ✅ Vault + review complete |
| 1 (second half) | Phase 1: Crypto + Scaffold | 11h | Server runs, crypto works |
| 2 | Phase 2: APIs + Compilation | 13h | Questions, packages, auth |
| 3 | Phase 3: Desktop + Recovery | 17h | Full exam flow, recovery |
| 4 | Phase 4: Polish + Demo | 13h | Demo-ready |
| **Total** | | **~58h of work** | 4 developers = ~15h each |

---

## Related Documents

- [[ArchitectureReview]] — Full architecture review driving these changes
- [[SprintBoard]] — Detailed sprint breakdown (to be updated)
- [[TeamAssignments]] — Developer allocation (to be updated)
- [[Decisions]] — Key architectural decisions (D-008 through D-013 added)
