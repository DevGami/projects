# Module 01 — Question Pool System

> **Last Updated:** 2026-06-08
> **Status:** 🔴 Not Started

---

## Purpose

Secure storage and management of examination questions with automatic encryption. Ensures question content is never stored in plaintext and cannot be leaked from the database.

---

## Components

| Component | Responsibility |
|---|---|
| Question Service (FastAPI) | CRUD operations, metadata management, version tracking |
| Encryption Service | AES-256-GCM content encryption, RSA-4096 key wrapping |

---

## Data Model

```json
{
  "id": "uuid",
  "subject": "string (e.g., Physics, Chemistry, Math)",
  "difficulty": "enum (easy, medium, hard)",
  "encryptedContent": "base64 (AES-256-GCM ciphertext)",
  "encryptedKey": "base64 (RSA-wrapped per-question key)",
  "iv": "base64 (GCM initialization vector)",
  "authTag": "base64 (GCM authentication tag)",
  "metadata": { "topic": "string", "marks": "int", "type": "mcq" },
  "version": "int",
  "createdBy": "uuid",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /api/v1/questions | Create new question (auto-encrypted) |
| GET | /api/v1/questions/{id} | Get question metadata (content remains encrypted) |
| PUT | /api/v1/questions/{id} | Update question (re-encrypted) |
| DELETE | /api/v1/questions/{id} | Soft-delete question |
| GET | /api/v1/questions?subject=X&difficulty=Y | List questions (metadata only) |

---

## Encryption Flow

```
Input: plaintext question content
    ↓
Generate random AES-256 key (per question)
    ↓
Encrypt content with AES-256-GCM (key, random IV)
    ↓
Wrap AES key with RSA-4096 master public key
    ↓
Store: encrypted_content, wrapped_key, IV, auth_tag
    ↓
Audit log: QUESTION_CREATED { question_id, content_hash }
```

---

## Dependencies

- Encryption Service (internal library, not network call)
- PostgreSQL (storage)
- Audit Service (event logging)

---

## Testing Requirements

- Unit: Encrypt → Decrypt roundtrip produces original content
- Unit: Tampered ciphertext fails GCM authentication
- Integration: POST /questions → GET /questions returns encrypted content
- Security: Direct DB query returns only ciphertext

---

## Related Documents

- [[Module02_CryptoDelivery]] — Consumes questions for package compilation
- [[SecurityModel]] — Encryption standards
- [[APIContracts]] — Full API specification
