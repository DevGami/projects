# Module 02 — Cryptographic Package Delivery: Implementation Plan

> **Created:** 2026-06-10
> **Status:** ✅ COMPLETE
> **Author:** AI Lead Backend Engineer (FortisExam)
> **Module:** 02 — Crypto Delivery
> **Priority:** CRITICAL (Demo Act 1 — Encrypted questions + key release)

---

## Pre-Work Completed: Module 05 Docs Fixed

Your friend fully implemented Module 05 (State Recovery) but forgot to update `CurrentState.md`. I have:
- ✅ Updated `CurrentState.md` — Module 05 now shows 🟢 Complete
- ✅ Baseline confirmed: 120 tests pass across unit/security/integration suites
- ✅ `RecoveryService`, `SnapshotManager`, edge API routes — all implemented and verified

---

## Scope

Implement the Cryptographic Package Delivery module. This is the backbone of **Demo Act 1**:

> *"Watch me create exam questions. They're encrypted the moment I save them. Watch me compile the package and sign it. Now I deliver it to the center — they can't read a single character. Watch me click 'Release Key'. The exam is now live."*

### In Scope
- `AESCipher` — AES-256-GCM encrypt/decrypt (currently a stub)
- `RSASigner` — RSA-2048 sign/verify/key-wrap (currently a stub)
- `PackageService` — Generate encrypted+signed packages, verify
- `DistributionService` — Register/download packages, admin-triggered key release (D-012)
- Cloud API routes: package generation, distribution, key release
- Pydantic schemas for all request/response models
- Full test suite (unit, integration, security)

### Out of Scope
- Question authoring UI (Module 01 / frontend)
- Candidate authentication (Module 03)
- Edge-side package decryption at exam runtime (Module 03)
- HKDF per-center keys (production only — D-012 uses direct RSA wrapping for demo)

---

## Goals

| # | Goal | Source | Metric |
|---|---|---|---|
| G1 | AES-256-GCM encrypt/decrypt functional | D-002, TRD | Round-trip test passes |
| G2 | RSA-2048 sign/verify functional | D-008, TRD | Signature verification passes |
| G3 | RSA key wrapping functional | T-004 | AES key survives RSA wrap/unwrap |
| G4 | Package generation creates encrypted+signed artifact | Module02 spec | Package struct matches spec |
| G5 | Admin-triggered key release | D-012 | `POST /exams/{id}/release-key` works |
| G6 | Tampered package detected | Security test | Signature rejects tamper |
| G7 | ≥ 80% test coverage | TRD §11 | coverage report |
| G8 | Zero lint errors | Team standard | ruff check |

---

## Dependencies Analysis

| Dependency | Status | Assessment |
|---|---|---|
| `shared/crypto/aes.py` | ⚠️ **STUB** — all methods are `...` | **Must implement** |
| `shared/crypto/rsa.py` | ⚠️ **STUB** — all methods are `...` | **Must implement** |
| `shared/crypto/hashing.py` | ✅ Working | No change needed |
| `server/app/models/package.py` | ✅ Real model with all fields | No change needed |
| `server/app/models/question.py` | ✅ Real model with encrypted fields | No change needed |
| `server/app/services/package_service.py` | ⚠️ **STUB** — 3 TODO methods | **Must implement** |
| `server/app/services/distribution_service.py` | ⚠️ **STUB** | **Must implement** |
| `server/app/api/cloud/packages.py` | ⚠️ STUB routes | **Must implement** |
| `server/app/api/cloud/distribution.py` | ⚠️ STUB routes | **Must implement** |
| `tests/unit/test_crypto.py` | ⚠️ All TODOs | **Must implement** |
| `shared/audit/event_logger.py` | ✅ Working | Use for audit logging |
| `server/app/services/audit_service.py` | ✅ Full (Module 07) | Use for package events |
| `keys/` directory | ✅ Exists | Generate RSA key pair if absent |

**No architectural blockers. Primary work: implement all crypto stubs + services.**

---

## Architecture

### Crypto Chain (how it all fits together)

```
Cloud Admin creates question
    ↓
Question content → AESCipher.encrypt(content, master_key)
                → store encrypted_content + encryption_iv + content_hash in DB
    ↓
PackageService.generate(exam_id, questions, variant_mapping):
    1. Build manifest: { question_ids, content_hashes, variant_mapping, generated_at }
    2. Encrypt manifest: AESCipher.encrypt(manifest_json, package_aes_key)
    3. package_hash = SHA-256(encrypted_payload)
    4. signature = RSASigner.sign(package_hash, private_key_pem)
    5. Store Package: { encrypted_payload, encryption_iv, package_hash, signature }
    ↓
Distribution → Center downloads encrypted blob (unreadable without key)
    ↓
Admin clicks "Release Key" (D-012):
POST /api/v1/exams/{exam_id}/release-key
    → wrapped_key = RSASigner.encrypt_key(package_aes_key, center_public_key_pem)
    → Returns: { wrapped_key_b64: "..." }
    ↓
Edge node receives:
    → aes_key = RSASigner.decrypt_key(wrapped_key, edge_private_key_pem)
    → content = AESCipher.decrypt(encrypted_payload, aes_key, iv, tag)
    → Exam is live!
```

### Key Architectural Decision: D-012 (Admin-triggered, not time-locked)
The `release-key` endpoint is a deliberate simplification for the hackathon. Production would use TEE-enforced time locks. This can be *shown live* in the demo.

---

## Proposed Changes

---

### Component 1: Crypto Primitives (`shared/crypto/`)

#### [IMPLEMENT] `shared/crypto/aes.py`
Full AES-256-GCM using `cryptography.hazmat.primitives.ciphers.aead.AESGCM`:
- `generate_key() → bytes` — `os.urandom(32)`
- `encrypt(plaintext: bytes, key: bytes) → tuple[bytes, bytes, bytes]` — returns `(ciphertext, nonce, tag)`. Uses 12-byte random nonce per call.
- `decrypt(ciphertext: bytes, key: bytes, nonce: bytes, tag: bytes) → bytes` — raises `cryptography.exceptions.InvalidTag` on tamper.

#### [IMPLEMENT] `shared/crypto/rsa.py`
Full RSA-2048 using `cryptography.hazmat.primitives.asymmetric.rsa`:
- `generate_key_pair() → (private_pem, public_pem)` — 2048-bit, e=65537
- `sign(data: bytes, private_key_pem: bytes) → bytes` — PSS padding + SHA-256
- `verify(data: bytes, signature: bytes, public_key_pem: bytes) → bool` — returns False on invalid (does not raise)
- `encrypt_key(aes_key: bytes, public_key_pem: bytes) → bytes` — OAEP + SHA-256 (key wrapping)
- `decrypt_key(encrypted_key: bytes, private_key_pem: bytes) → bytes` — OAEP unwrapping
- `load_private_key(path: str) → bytes` — reads PEM file from disk
- `load_public_key(path: str) → bytes` — reads PEM file from disk

---

### Component 2: Package Service

#### [IMPLEMENT] `server/app/services/package_service.py`
Replace all 3 stubs with full async implementations:
- `generate(exam_id, db, private_key_pem) → Package` — builds manifest, encrypts with fresh AES key, signs, persists to DB, logs `PACKAGE_GENERATED` audit event
- `get(package_id, db) → Package | None` — load from DB
- `verify_signature(package_id, db, public_key_pem) → bool` — load package, verify RSA signature
- `get_wrapped_key(package_id, center_public_key_pem) → bytes` — unwrap stored AES key, re-wrap with center public key
- `download_payload(package_id, db) → tuple[bytes, str]` — returns (encrypted_bytes_b64, iv_hex)

#### [IMPLEMENT] `server/app/services/distribution_service.py`
- `release_key(exam_id, center_public_key_pem, db) → dict` — D-012: find package for exam, wrap AES key with center pub key, log `KEY_RELEASED` audit event
- `list_packages(db) → list[Package]`
- `get_delivery_status(package_id, db) → dict`

---

### Component 3: Cloud API Routes

#### [IMPLEMENT] `server/app/api/cloud/packages.py`
- `POST /packages/generate` — `GeneratePackageRequest` → calls `PackageService.generate()`
- `GET /packages/{package_id}` — metadata (no encrypted payload)
- `GET /packages/{package_id}/download` — returns `PackageDownloadResponse`
- `POST /packages/{package_id}/verify` — returns `PackageVerifyResponse`

#### [IMPLEMENT] `server/app/api/cloud/distribution.py`
- `GET /distribution/packages` — list all packages with status
- `GET /distribution/status/{package_id}` — single package delivery status

#### [MODIFY] `server/app/api/cloud/exams.py`
- Add `POST /exams/{exam_id}/release-key` endpoint (D-012 admin key release)

---

### Component 4: Schemas

#### [NEW] `server/app/schemas/packages.py`
```python
class GeneratePackageRequest(BaseModel):
    exam_id: str
    center_public_key_pem: str   # PEM string of center's RSA public key

class PackageResponse(BaseModel):
    id: str; exam_id: str; package_hash: str
    status: str; created_at: str

class PackageVerifyResponse(BaseModel):
    package_id: str; valid: bool; package_hash: str; checked_at: str

class PackageDownloadResponse(BaseModel):
    package_id: str; encrypted_payload_b64: str; iv_b64: str; package_hash: str

class ReleaseKeyRequest(BaseModel):
    center_public_key_pem: str   # PEM string of center's RSA public key

class ReleaseKeyResponse(BaseModel):
    exam_id: str; package_id: str; wrapped_key_b64: str; released_at: str
```

---

### Component 5: Key Bootstrap Script

#### [NEW] `scripts/generate_keys.py`
Generates RSA-2048 key pair to `keys/private.pem` + `keys/public.pem` if they don't exist. Used for demo setup.

---

### Component 6: Tests

#### [IMPLEMENT] `tests/unit/test_crypto.py`
Replace all 9 TODO stubs with real tests:
- `TestAESCipher` — encrypt/decrypt roundtrip, unique nonces, tamper detection (`InvalidTag`), wrong key fails
- `TestRSASigner` — sign/verify roundtrip, wrong key fails, key wrapping roundtrip, load key files
- `TestHashChain` — already covered in audit tests, add basic HashUtils tests here

#### [NEW] `tests/unit/test_package_service.py`
Unit tests for PackageService (mock DB via `AsyncMock`):
- `generate()` returns a Package with non-empty fields
- `package_hash` = SHA-256 of `encrypted_payload`
- Signature is verifiable with matching public key
- Tampered payload fails signature verification
- `get_wrapped_key()` round-trips through RSA OAEP

#### [NEW] `tests/integration/test_package_integration.py`
Integration tests using in-memory SQLite (same pattern as audit/recovery):
- Full pipeline: generate → DB persist → retrieve → verify signature
- download → decrypt → readable content
- Key release → wrapped key → unwrap → decrypt works
- Wrong center key cannot unwrap

#### [NEW] `tests/security/test_package_security.py`
- T-001: Correct key decrypts; wrong key raises `InvalidTag`
- T-002: Tampered encrypted payload → signature verification fails
- T-003: Tampered signature → `verify()` returns False
- T-004: Center A's wrapped key cannot decrypt for center B
- T-005: Two encryptions of same plaintext produce different ciphertext (nonce uniqueness)

---

## APIs

| Method | Path | Mode | Description |
|---|---|---|---|
| `POST` | `/api/v1/packages/generate` | Cloud | Generate encrypted+signed package |
| `GET` | `/api/v1/packages/{id}` | Cloud | Get package metadata |
| `GET` | `/api/v1/packages/{id}/download` | Cloud | Download encrypted payload |
| `POST` | `/api/v1/packages/{id}/verify` | Cloud | Verify RSA signature |
| `GET` | `/api/v1/distribution/packages` | Cloud | List all packages |
| `GET` | `/api/v1/distribution/status/{id}` | Cloud | Delivery status |
| `POST` | `/api/v1/exams/{exam_id}/release-key` | Cloud | **D-012** Admin key release |

---

## Data Structures

### Package Manifest (content of `encrypted_payload`)
```json
{
  "exam_id": "uuid",
  "question_ids": ["uuid", "..."],
  "content_hashes": {"uuid": "sha256hex"},
  "variant_mapping": {"seat_id": "variant_id"},
  "generated_at": "2026-06-10T00:00:00Z",
  "manifest_hash": "sha256 of all above"
}
```

### ReleaseKeyResponse
```json
{
  "exam_id": "uuid",
  "package_id": "uuid",
  "wrapped_key_b64": "<RSA-OAEP encrypted AES key, base64>",
  "released_at": "2026-06-10T00:00:00Z"
}
```

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| AES nonce reuse | Security failure | LOW | Always `os.urandom(12)` per call |
| RSA key files missing at startup | Server crash | MEDIUM | `generate_keys.py` script + check at startup |
| `cryptography` lib missing | ImportError | LOW | Already installed (used in audit security tests) |
| Demo center key not available | Key release fails | MEDIUM | Generate test center key pair during implementation |
| Package payload too large | Slow DB operations | LOW | Text column handles up to 1GB |

---

## Open Questions

> [!IMPORTANT]
> **Q1: Individual question encryption scope?**
> The `Question` model already has `encrypted_content` and `encryption_iv` fields. Should Module 02 also implement per-question AES encryption (so questions are stored encrypted from creation), or is that Module 01 scope?
> **My recommendation:** Include per-question encryption in Module 02 since we're already implementing `AESCipher`. This avoids needing to revisit `shared/crypto/` again.

> [!NOTE]
> **Q2: Center RSA key for demo?**
> I'll generate a second RSA key pair (`keys/center_private.pem`, `keys/center_public.pem`) to simulate the exam center's key pair. The `release-key` endpoint will wrap against this. Is that acceptable for the demo?

---

## Verification Plan

### Automated Tests
```bash
# All new tests
python -m pytest tests/unit/test_crypto.py tests/unit/test_package_service.py tests/integration/test_package_integration.py tests/security/test_package_security.py -v

# Coverage
python -m coverage run -m pytest tests/unit/test_crypto.py tests/unit/test_package_service.py tests/integration/test_package_integration.py tests/security/test_package_security.py
python -m coverage report --include="shared/crypto/*,server/app/services/package_service.py,server/app/services/distribution_service.py,server/app/api/cloud/packages.py,server/app/api/cloud/distribution.py,server/app/schemas/packages.py"

# Lint
python -m ruff check shared/crypto/ server/app/services/package_service.py server/app/services/distribution_service.py server/app/api/cloud/ server/app/schemas/packages.py
```

### Manual Verification (Demo Act 1)
1. Start server in cloud mode
2. `POST /packages/generate` → see encrypted blob in response
3. `GET /packages/{id}/download` → unreadable ciphertext
4. `POST /packages/{id}/verify` → `{"valid": true}`
5. `POST /exams/{id}/release-key` → `{"wrapped_key_b64": "..."}`
6. Manually unwrap + decrypt → see readable manifest content
