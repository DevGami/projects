# FortisExam — Project Overview

> **Last Updated:** 2026-06-08
> **Status:** Pre-Development (Vault Initialization)

---

## What Is FortisExam?

FortisExam is a **Zero-Trust, Edge-First examination infrastructure** designed for conducting large-scale national examinations (NEET, JEE, UPSC, SSC, state boards) securely and reliably. It is **not** an AI proctoring tool — it is a cryptographic examination infrastructure.

---

## Core Problem

National examinations regularly suffer from:

- **Paper leaks** before exam start
- **Candidate impersonation** using proxies
- **Copying** between nearby candidates
- **Network outages** disrupting exam delivery
- **Lack of accountability** — no tamper-proof audit trail
- **Cloud bottlenecks** during peak load (millions of concurrent candidates)
- **Center-level collusion** by insiders

Current systems rely on centralized trust and real-time connectivity, both of which are single points of failure.

---

## Three Pillars

| Pillar | What It Solves | How |
|---|---|---|
| **Leak Prevention** | Questions exposed before exam start | AES-256-GCM encryption, time-locked decryption keys, package signatures |
| **Cheat Prevention** | Copying between nearby candidates | Spatial graph-based question/option randomization per seat |
| **Cryptographic Accountability** | Unverifiable exam operations | Hash-chained audit ledger (Merkle-tree style) for every critical event |

---

## Architecture Summary

### Three Trust Zones

| Zone | Name | Role | Technology |
|---|---|---|---|
| **A** | Secure Authoring Cloud | Question creation, encryption, compilation, packaging | FastAPI, PostgreSQL, Redis |
| **B** | Distribution Layer | Encrypted package delivery, key distribution | FastAPI, signed manifests |
| **C** | Center Edge Node | Authentication, exam execution, monitoring, recovery, auditing | FastAPI, SQLite, Redis, Electron/React |

### Key Architectural Principles

- **Offline-First:** Edge nodes operate independently during exams
- **Zero Trust:** No component trusts another without cryptographic verification
- **Defense in Depth:** 4 security layers (Identity → Content → Execution → Audit)
- **Edge Computing:** Critical exam operations happen locally, not in the cloud
- **Cryptographic Accountability:** Every action generates a hash-chained audit entry

---

## Seven Core Modules

| # | Module | Purpose | Key Technology |
|---|---|---|---|
| 01 | Question Pool System | Secure question storage & encryption | AES-256-GCM, RSA-4096, HKDF |
| 02 | Cryptographic Package Delivery | Encrypted exam distribution to centers | Signed manifests, package verification |
| 03 | Candidate Authentication | QR + face verification | InsightFace, OpenCV, JWT |
| 04 | Spatial Graph Randomization | Seat-aware question/option shuffling | NetworkX, graph coloring |
| 05 | State Recovery System | Crash-proof exam sessions | SQLite local cache, Redis sync |
| 06 | Edge AI Monitoring | Suspicious behavior detection | MediaPipe (face count, gaze tracking) |
| 07 | Cryptographic Audit Ledger | Tamper-evident event logging | SHA-256, Merkle trees |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy |
| Frontend | React, TypeScript |
| Desktop | Electron |
| Cloud DB | PostgreSQL |
| Edge DB | SQLite |
| Cache | Redis |
| AI/ML | MediaPipe, InsightFace, OpenCV |
| Crypto | AES-256-GCM, RSA-4096, HKDF, SHA-256 |
| Graphs | NetworkX |
| Deployment | Docker Compose |

---

## Performance Targets

| Operation | Target |
|---|---|
| Authentication | < 5 seconds |
| Question Loading | < 2 seconds |
| Answer Save | < 100 ms |
| Recovery from failure | < 60 seconds |
| Monitoring latency | < 2 seconds |

---

## Hackathon Demo Scope

The hackathon implementation demonstrates all 8 critical flows:

1. Secure question creation & encryption
2. Encrypted package generation
3. Candidate authentication (QR + face)
4. Spatial seat randomization
5. Offline examination execution
6. State recovery after failure
7. Tamper-evident audit logging
8. Real-time anomaly detection

**Mocked for demo:** Satellite distribution, government identity APIs, HSMs, TEEs.

---

## Success Metrics

- Zero successful paper leaks
- Zero unauthorized access
- 95%+ successful candidate authentication
- 99%+ successful answer submission
- < 1 minute recovery after device failure

---

## Production Future Scope

- AWS Nitro Enclaves / TEEs
- Threshold cryptography
- Hardware Security Modules (HSMs)
- Kafka event streaming
- Distributed sharding
- Multi-region deployment
- AI leak detection agents
- Center risk scoring
- Subjective answer evaluation
- Government identity integration

---

## Related Documents

- [[PRD_Summary]] — Product requirements detail
- [[ArchitectureSummary]] — Full architecture breakdown
- [[Roadmap]] — Development phases and timeline
- [[CurrentState]] — Live project status
