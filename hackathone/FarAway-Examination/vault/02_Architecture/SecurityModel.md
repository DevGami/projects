# FortisExam — Security Model

> **Last Updated:** 2026-06-08

---

## Security Philosophy

FortisExam follows a **Zero Trust, Defense in Depth** security model. No component trusts another without cryptographic verification. Security is layered so that the failure of any single control does not compromise the exam.

---

## Layer 1: Identity Security

**Purpose:** Ensure only authorized individuals interact with the system.

### Two Authentication Domains

| Domain | Users | Provider | Network |
|---|---|---|---|
| Admin Portal (Zone A) | Admins, experts, center admins, invigilators, auditors | **Clerk** (managed auth) | Online |
| Candidate Kiosk (Zone C) | Exam candidates | Custom QR + face verification | **Offline** |

### Controls

| Control | Description | Technology | Domain |
|---|---|---|---|
| Clerk Authentication | Admin portal login, sessions, MFA, user management | Clerk SDK (`@clerk/clerk-react`, Clerk JWKS) | Admin |
| Clerk JWT Verification | Cloud API routes protected by Clerk JWT middleware | Clerk Backend SDK / JWKS verification | Admin |
| Signed QR Tokens | Each candidate receives a cryptographically signed QR code | RSA-2048 signature | Candidate |
| Face Verification | Candidate face compared against stored embedding | Pre-computed embeddings, cosine similarity | Candidate |
| Edge-Local JWT Sessions | Candidate sessions use RSA-signed JWTs bound to edge node | Per-node RSA key pair | Candidate |
| Role-Based Access Control | 5 roles with least-privilege enforcement | Clerk metadata (admin) / FastAPI middleware (edge) | Both |

### Threat Coverage
- Admin account compromise → Clerk MFA, session management
- Candidate impersonation → QR + face dual-factor
- Session hijacking → Short-lived JWTs (Clerk for admin, edge-signed for candidate)
- Privilege escalation → RBAC enforcement via Clerk roles (admin) and middleware (edge)

---

## Layer 2: Content Security

**Purpose:** Ensure question content is never accessible in plaintext to unauthorized parties.

### Controls

| Control | Description | Technology |
|---|---|---|
| Question Encryption | All questions encrypted immediately on creation | AES-256-GCM |
| Key Separation | Encryption keys stored separately from encrypted content | RSA-2048 key wrapping |
| Key Generation | Direct AES key per package (HKDF in production) | `os.urandom(32)` / HKDF (production) |
| Package Signing | Exam packages are signed to detect tampering | RSA-2048 digital signatures |
| Admin-Triggered Key Release | Decryption keys released via admin API call at exam time | `POST /exams/{id}/release-key` (D-012) |

### Threat Coverage
- Paper leaks from database → Only ciphertext stored
- Key theft → Keys and content in different systems
- Package tampering → Signature verification on receipt
- Premature decryption → Admin-triggered release with audit logging

---

## Layer 3: Execution Security

**Purpose:** Ensure the exam environment cannot be compromised during exam execution.

### Controls

| Control | Description | Technology |
|---|---|---|
| Kiosk Mode | Candidate terminal locks down the desktop environment | Electron BrowserWindow config |
| Restricted Navigation | No address bar, no new tabs, no developer tools | Electron security settings |
| Process Isolation | Exam process runs with restricted system access | OS-level permissions |
| Local-Only Communication | Desktop app communicates only with local edge server | Network restriction |

### Threat Coverage
- Screen sharing → Kiosk mode prevents alt-tab
- Web browsing during exam → Restricted navigation
- Remote assistance tools → Process isolation
- Man-in-the-middle → Local network only, no internet

---

## Layer 4: Audit Security

**Purpose:** Ensure every critical action is recorded in a tamper-evident manner.

### Controls

| Control | Description | Technology |
|---|---|---|
| Event Logging | Every critical action generates an audit event | Custom event logger |
| Hash Chaining | Each event includes SHA-256 hash of previous event | SHA-256, chain linking |
| Event Signing | Events are signed by the generating service | RSA / HMAC |
| Chain Verification | Integrity of entire chain verifiable in O(n) | Sequential hash verification |

### Audit Event Types

| Event | Logged Data |
|---|---|
| Question Created | question_id, author, timestamp, content_hash |
| Question Modified | question_id, editor, timestamp, diff_hash |
| Package Generated | package_id, exam_id, timestamp, package_hash |
| Package Distributed | package_id, center_id, timestamp, delivery_hash |
| Candidate Authenticated | candidate_id, center_id, method, timestamp |
| Answer Submitted | session_id, question_id, answer_hash, timestamp |
| Exam Submitted | session_id, submission_hash, timestamp |
| Anomaly Detected | candidate_id, anomaly_type, severity, timestamp |

### Threat Coverage
- Log tampering → Hash chain breaks on any modification
- Event deletion → Missing link in chain is detectable
- Timestamp spoofing → Events are sequentially linked regardless of timestamp
- Evidence destruction → Chain replication to multiple stores

---

## Cryptographic Primitives

| Primitive | Usage | Standard |
|---|---|---|
| AES-256-GCM | Question/package encryption | NIST SP 800-38D |
| RSA-2048 | Key wrapping, QR signatures, edge JWT signing (RSA-4096 in production) | PKCS#1 v2.2 |
| SHA-256 | Audit hash chain, content hashing | FIPS 180-4 |
| JWT (Clerk) | Admin portal session tokens | RFC 7519, Clerk JWKS |
| JWT (custom) | Candidate edge session tokens | RFC 7519, per-node RSA signing |

---

## Related Documents

- [[ThreatModel]] — Detailed threat analysis
- [[ArchitectureSummary]] — Architecture overview
- [[Decisions]] — Security-related architecture decisions
