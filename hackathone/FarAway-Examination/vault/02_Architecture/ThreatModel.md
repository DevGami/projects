# FortisExam — Threat Model (Post Architecture Review)

> **Last Updated:** 2026-06-08 (Updated with Architecture Review findings)
> **Phase:** Phase 4 Architecture Validation + Post-Review Update

---

## Threat Modeling Methodology

Using STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) applied to each trust zone boundary.

---

## Zone A → Zone B Boundary (Cloud → Distribution)

### T-001: Package Interception During Distribution
- **Category:** Information Disclosure
- **Threat:** Attacker intercepts exam package during transfer from cloud to distribution layer
- **Impact:** HIGH
- **Likelihood:** LOW (requires network position)
- **Mitigation:** Package is encrypted (AES-256-GCM). Intercepted package is unreadable without decryption key, which is delivered separately.
- **Residual Risk:** LOW

### T-002: Package Substitution
- **Category:** Tampering
- **Threat:** Attacker replaces legitimate exam package with modified version
- **Impact:** CRITICAL — Wrong questions delivered
- **Likelihood:** LOW (requires network position + timing)
- **Mitigation:** Package is signed (RSA-2048 for hackathon, RSA-4096 for production). Edge node verifies signature before accepting.
- **Residual Risk:** LOW (depends on key management integrity)

### T-003: Unauthorized Package Generation
- **Category:** Elevation of Privilege
- **Threat:** Unauthorized user triggers exam compilation
- **Impact:** HIGH — Unauthorized access to question selection
- **Likelihood:** MEDIUM (insider threat)
- **Mitigation:** RBAC on compilation endpoint. Compilation logged in audit chain.
- **Residual Risk:** MEDIUM — Insider with admin credentials could bypass

---

## Zone B → Zone C Boundary (Distribution → Edge)

### T-004: Key Interception
- **Category:** Information Disclosure
- **Threat:** Decryption key intercepted during delivery to edge node
- **Impact:** CRITICAL — Package can be decrypted prematurely
- **Likelihood:** LOW (key encrypted with center RSA public key)
- **Mitigation:** Key encrypted with center-specific RSA public key. Only the edge node's private key can decrypt.
- **Residual Risk:** LOW (if edge node private key is secure)

### T-005: Rogue Edge Node
- **Category:** Spoofing
- **Threat:** Attacker sets up a fake edge node to receive exam packages and keys
- **Impact:** CRITICAL — Full exam content compromise
- **Likelihood:** MEDIUM (hackathon: implicit trust on same network)
- **Mitigation:** Edge nodes are pre-registered with unique certificates. In production: HSM-backed node identity, mutual TLS.
- **Residual Risk:** MEDIUM (hackathon demo simplifies node authentication)

### T-006: Premature Key Release
- **Category:** Information Disclosure
- **Threat:** Keys are released or accessed before scheduled exam time
- **Impact:** HIGH — Questions accessible before exam start
- **Likelihood:** LOW (hackathon: admin-triggered release per D-012)
- **Mitigation:** Admin-triggered key release API (hackathon). Audit-logged. In production: TEE-based time enforcement.
- **Residual Risk:** LOW (human-in-the-loop for hackathon)

---

## Zone C Internal (Edge Node)

### T-007: Candidate Impersonation
- **Category:** Spoofing
- **Threat:** Proxy candidate uses stolen/forged QR code
- **Impact:** HIGH — Wrong person takes exam
- **Likelihood:** MEDIUM
- **Mitigation:** QR signature verification + face embedding comparison. QR tokens include nonce (anti-replay). Face match threshold configurable.
- **Residual Risk:** MEDIUM (face verification accuracy depends on model and conditions)

### T-008: Answer Tampering After Submission
- **Category:** Tampering
- **Threat:** Center insider modifies answers in SQLite after exam
- **Impact:** CRITICAL — Exam results corrupted
- **Likelihood:** MEDIUM (requires SQLite file access)
- **Mitigation:** Every answer submission is logged in hash-chained audit. Modifying SQLite without updating the audit chain creates detectable inconsistency. Answers are signed at submission.
- **Residual Risk:** LOW

### T-009: Audit Chain Corruption
- **Category:** Repudiation
- **Threat:** Attacker modifies or deletes audit events to cover tracks
- **Impact:** CRITICAL — Loss of accountability
- **Likelihood:** LOW (requires database access + understanding of chain structure)
- **Mitigation:** Hash chain: modifying any event breaks the chain. Chain replicated to multiple stores. In production: chain segments signed and uploaded periodically.
- **Residual Risk:** LOW (full chain replacement is detectable if any copy survives)

### T-010: Screen Capture During Exam
- **Category:** Information Disclosure
- **Threat:** Candidate uses screen capture to photograph questions
- **Impact:** MEDIUM — Questions exposed for specific variant only
- **Likelihood:** MEDIUM
- **Mitigation:** Kiosk mode disables screenshot tools, screen recording, and Alt-Tab. Spatial randomization limits impact (each candidate sees unique variant).
- **Residual Risk:** MEDIUM (hardware camera pointed at screen cannot be prevented)

### T-011: SQLite Data Loss
- **Category:** Denial of Service
- **Threat:** Device failure causes loss of exam state (answers, timer)
- **Impact:** HIGH — Candidate loses exam progress
- **Likelihood:** LOW (WAL mode provides crash safety)
- **Mitigation:** SQLite WAL mode for crash recovery. Recovery snapshot saved on every answer. (Note: Redis removed from edge per D-010 — SQLite is sole source of truth.)
- **Residual Risk:** LOW

### T-012: Monitoring Evasion
- **Category:** Tampering
- **Threat:** Candidate covers camera or positions it to avoid detection
- **Impact:** MEDIUM — Monitoring blind spot
- **Likelihood:** MEDIUM
- **Mitigation:** Camera missing detection triggers HIGH severity alert. Proctor is notified. Event logged in audit chain.
- **Residual Risk:** MEDIUM (physical camera manipulation is hard to prevent technically)

---

## Cross-Zone Threats

### T-013: Insider Threat (Question Author)
- **Category:** Information Disclosure
- **Threat:** Question author memorizes or photographs questions during authoring
- **Impact:** CRITICAL — Paper leak at source
- **Likelihood:** MEDIUM (human threat, hardest to mitigate)
- **Mitigation (hackathon):** Audit logging of all access. In production: authoring in secure rooms with monitored terminals, threshold cryptography (M-of-N authors required).
- **Residual Risk:** HIGH (hardest threat to mitigate technically; requires procedural controls)

### T-014: Clock Manipulation
- **Category:** Tampering
- **Threat:** Edge node system clock is advanced to trigger premature key release
- **Impact:** HIGH — Questions accessible before exam time
- **Likelihood:** LOW (hackathon: admin-triggered release eliminates this threat — see D-012)
- **Mitigation (hackathon):** Admin-triggered key release removes clock dependency. In production: NTP with signed time sources, TEE-based secure clock.
- **Residual Risk:** LOW (for hackathon, eliminated by design decision D-012)

---

## NEW Threats (from Architecture Review)

### T-015: Edge Node Private Key Extraction
- **Category:** Information Disclosure
- **Threat:** RSA private key stored as a file on the edge node is extracted by an attacker with filesystem access
- **Impact:** CRITICAL — total exam content compromise for that center
- **Likelihood:** MEDIUM (hackathon demo machine is physically accessible)
- **Mitigation (hackathon):** Accept risk, generate keys at startup. For production: HSM/TPM-backed key storage.
- **Residual Risk:** MEDIUM

### T-016: JWT Secret Compromise Enabling Cross-Node Session Forgery
- **Category:** Spoofing
- **Threat:** If JWT uses a shared HMAC secret, compromising one edge node's secret allows forging sessions for any node
- **Impact:** HIGH — cross-center session forgery
- **Likelihood:** LOW (hackathon is single-center)
- **Mitigation:** Use per-node RSA-signed JWTs. Each edge node signs with its own private key.
- **Residual Risk:** LOW

### T-017: Unencrypted Face Embeddings in Database
- **Category:** Information Disclosure
- **Threat:** Face embeddings stored as plain BYTEA in the candidates table. If DB is accessed, biometric data is exposed.
- **Impact:** MEDIUM (privacy violation, potential legal issue)
- **Likelihood:** LOW (hackathon uses test data only)
- **Mitigation (hackathon):** Use synthetic test data. For production: encrypt embeddings at rest with per-center key.
- **Residual Risk:** LOW (for hackathon)

### T-018: No TLS Between Desktop and Edge Server
- **Category:** Information Disclosure
- **Threat:** Desktop Electron app communicates with edge server over HTTP on local network. JWTs, face images, and answers are transmitted in plaintext.
- **Impact:** MEDIUM — local network sniffing could capture exam data
- **Likelihood:** LOW (requires LAN access at exam center)
- **Mitigation (hackathon):** Accept risk (local network, physical security assumed). For production: mTLS with pre-provisioned certificates.
- **Residual Risk:** LOW (for hackathon)

### T-019: Electron DevTools Bypass
- **Category:** Elevation of Privilege
- **Threat:** Even with kiosk mode, if devtools are not properly disabled, the exam app can be manipulated to view answers, modify timer, or bypass navigation restrictions.
- **Impact:** HIGH — exam environment fully compromised
- **Likelihood:** MEDIUM
- **Mitigation:** Disable `nodeIntegration`, use `contextIsolation: true`, remove devtools in production build, intercept all keyboard shortcuts (Ctrl+Shift+I, F12, Ctrl+Shift+J).
- **Residual Risk:** LOW (if properly hardened)

### T-020: Answer Table Duplicate Rows on Re-Answer
- **Category:** Tampering (data integrity)
- **Threat:** Candidate changes answer to same question, creating duplicate rows in SQLite answers table. Recovery or scoring may select wrong row.
- **Impact:** MEDIUM — potential scoring error
- **Likelihood:** HIGH (candidates routinely change answers)
- **Mitigation:** Use `(session_id, question_id)` composite unique constraint with `INSERT OR REPLACE` (upsert) semantics.
- **Residual Risk:** LOW (if implemented correctly)

---

## Threat Summary Matrix (Updated)

| ID | Threat | Category | Impact | Likelihood | Residual Risk |
|---|---|---|---|---|---|
| T-001 | Package interception | Info Disclosure | HIGH | LOW | LOW |
| T-002 | Package substitution | Tampering | CRITICAL | LOW | LOW |
| T-003 | Unauthorized compilation | Elev. Privilege | HIGH | MEDIUM | MEDIUM |
| T-004 | Key interception | Info Disclosure | CRITICAL | LOW | LOW |
| T-005 | Rogue edge node | Spoofing | CRITICAL | MEDIUM | MEDIUM |
| T-006 | Premature key release | Info Disclosure | HIGH | LOW | LOW |
| T-007 | Candidate impersonation | Spoofing | HIGH | MEDIUM | MEDIUM |
| T-008 | Answer tampering | Tampering | CRITICAL | MEDIUM | LOW |
| T-009 | Audit chain corruption | Repudiation | CRITICAL | LOW | LOW |
| T-010 | Screen capture | Info Disclosure | MEDIUM | MEDIUM | MEDIUM |
| T-011 | SQLite data loss | DoS | HIGH | LOW | LOW |
| T-012 | Monitoring evasion | Tampering | MEDIUM | MEDIUM | MEDIUM |
| T-013 | Insider threat (author) | Info Disclosure | CRITICAL | MEDIUM | HIGH |
| T-014 | Clock manipulation | Tampering | HIGH | LOW | LOW |
| T-015 | Edge node key extraction | Info Disclosure | CRITICAL | MEDIUM | MEDIUM |
| T-016 | JWT cross-node forgery | Spoofing | HIGH | LOW | LOW |
| T-017 | Unencrypted face data | Info Disclosure | MEDIUM | LOW | LOW |
| T-018 | No TLS desktop↔edge | Info Disclosure | MEDIUM | LOW | LOW |
| T-019 | Electron devtools bypass | Elev. Privilege | HIGH | MEDIUM | LOW |
| T-020 | Answer table duplicates | Tampering | MEDIUM | HIGH | LOW |

---

## Over-Engineering Risks (Revised per Review)

| Finding | Risk | Decision |
|---|---|---|
| RSA-4096 for hackathon | Slower key operations | ✅ Downgraded to RSA-2048 (D-008) |
| Full Merkle tree for audit | Complex implementation | ✅ Using linear hash chain (D-005) |
| HKDF key derivation | Adds complexity for single-center | ✅ Direct key generation for hackathon (D-008) |
| Separate backend/edge apps | Double scaffolding work | ✅ Merged into single app (D-009) |
| Redis on edge | Extra container, zero demo benefit | ✅ Removed (D-010) |
| Runtime graph coloring on edge | Unnecessary NetworkX dependency | ✅ Pre-computed during compilation (D-011) |
| Nginx reverse proxy | Zero demo benefit | ✅ Removed from Docker Compose |
| Time-locked key mechanism | Underspecified, complex | ✅ Admin-triggered release (D-012) |

---

## Missing Components (Status)

| Component | Gap | Status |
|---|---|---|
| Demo reset script | No way to reset demo state | 🔴 Must build (Day 4) |
| Seed data script | No demo data generator | 🔴 Must build (Day 2) |
| Health endpoints | No `/health` on servers | 🔴 Must build (Day 4) |
| Structured logging | No logging strategy | 🟡 Should build |
| Admin page (minimal) | No UI for demo orchestration | 🟡 Should build (Day 4) |
| CORS middleware | Cross-origin requests will fail | 🔴 Must build (Day 4) |
| Proctor dashboard | No live event display | 🟢 Nice to have |
| Answer upsert constraint | Duplicate rows on re-answer | 🔴 Must fix in schema (T-020) |

---

## Related Documents

- [[ArchitectureReview]] — Full architecture review
- [[SecurityModel]] — Security controls
- [[Decisions]] — Architecture decisions addressing threats
- [[SecurityTests]] — Tests validating threat mitigations
