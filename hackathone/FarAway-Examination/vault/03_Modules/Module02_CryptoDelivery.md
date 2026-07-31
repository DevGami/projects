# Module 02 — Cryptographic Package Delivery

> **Last Updated:** 2026-06-08
> **Status:** 🔴 Not Started

---

## Purpose

Generate encrypted, signed exam packages and deliver them securely to examination centers. Packages are unusable without time-locked decryption keys delivered separately.

---

## Components

| Component | Responsibility |
|---|---|
| Compilation Service | Blueprint-based question selection, variant generation |
| Package Generator | Bundle encrypted questions into signed packages |
| Distribution Service | Deliver packages to centers, verify receipt |
| Key Distribution Service | Time-locked key delivery to centers |

---

## Package Structure

```json
{
  "packageId": "uuid",
  "examId": "uuid",
  "version": "int",
  "manifest": {
    "questionCount": "int",
    "subjects": ["string"],
    "blueprint": { "subject_distribution": {}, "difficulty_distribution": {} },
    "generatedAt": "datetime",
    "manifestHash": "sha256"
  },
  "encryptedQuestions": ["base64 (AES-256-GCM)"],
  "packageSignature": "base64 (RSA-4096 signature of manifest + content hash)"
}
```

---

## Compilation Flow

```
Blueprint input: { subjects: [...], difficulty_mix: {...}, question_count: N }
    ↓
Query Question Pool → filter by subject, difficulty
    ↓
Random selection per blueprint constraints
    ↓
Bundle selected questions (still encrypted from Module 01)
    ↓
Generate manifest with content hashes
    ↓
Sign package (RSA-4096 private key)
    ↓
Output: Encrypted, signed exam package
```

---

## Distribution Flow

```
Package generated
    ↓
Register package for target centers
    ↓
Push package to center edge nodes (pre-exam, days before)
    ↓
Edge node receives → verify manifest signature
    ↓
Store encrypted package locally
    ↓
(At exam time) Key Distribution Service releases center-specific key
    ↓
Key = HKDF(master_key, center_id, exam_id)
    ↓
Edge node decrypts package → exam is live
```

---

## Dependencies

- Module 01 (Question Pool) — source of encrypted questions
- Encryption Service — signing and key derivation
- Audit Service — logging package generation and distribution events

---

## Testing Requirements

- Unit: Package generation produces valid signed manifest
- Unit: Tampered package fails signature verification
- Integration: End-to-end compile → distribute → verify on edge
- Security: Package without key is undecryptable

---

## Related Documents

- [[Module01_QuestionPool]] — Question source
- [[Module03_Authentication]] — Session creation after package decryption
- [[SecurityModel]] — Encryption and signing standards
