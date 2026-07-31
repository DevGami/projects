# FortisExam — Security Tests

> **Last Updated:** 2026-06-08

---

## Security Test Suite

### ST-001: Encryption at Rest
**Threat:** T-001 (Package interception)
**Test:** Query PostgreSQL `questions` table directly. Verify `encrypted_content` column contains no plaintext question text.
**Expected:** All content is AES-256-GCM ciphertext.

---

### ST-002: Key Separation
**Threat:** T-001
**Test:** Verify encrypted content and encryption keys are stored in different columns/tables. Attempt to decrypt content using only data from the `questions` table (without master key).
**Expected:** Decryption impossible without master private key.

---

### ST-003: Package Tampering Detection
**Threat:** T-002
**Test:** Generate signed package. Modify one byte. Verify signature on edge node.
**Expected:** Signature verification fails, package rejected.

---

### ST-004: QR Token Forgery
**Threat:** T-007
**Test:** Create QR token with valid format but signed with wrong key. Attempt authentication.
**Expected:** Signature verification fails, authentication rejected.

---

### ST-005: QR Replay Attack
**Threat:** T-007
**Test:** Authenticate with valid QR token (success). Attempt to authenticate again with same token.
**Expected:** Second attempt fails (nonce already used).

---

### ST-006: Session Hijacking
**Threat:** T-007
**Test:** Create valid session JWT. Attempt to use it from a different edge node / IP.
**Expected:** Session rejected (node binding, if implemented).

---

### ST-007: Answer Tampering Detection
**Threat:** T-008
**Test:** Submit answers during exam. Modify answer directly in SQLite. Run audit chain verification.
**Expected:** Audit chain verification detects inconsistency.

---

### ST-008: Audit Chain Deletion
**Threat:** T-009
**Test:** Create audit chain. Delete event #10 from database. Run chain verification.
**Expected:** Verification fails (gap in chain).

---

### ST-009: Audit Chain Modification
**Threat:** T-009
**Test:** Create audit chain. Modify event #10 payload. Run chain verification.
**Expected:** Verification fails at event #10 (hash mismatch).

---

### ST-010: Unauthorized API Access
**Threat:** T-003
**Test:** Call admin-only endpoints (e.g., POST /compile-exam) without authentication / with candidate-role JWT.
**Expected:** 401 Unauthorized or 403 Forbidden.

---

### ST-011: Kiosk Mode Escape
**Threat:** T-010
**Test:** In Electron kiosk mode, attempt: Alt-Tab, Ctrl+Alt+Del, F11, Ctrl+Shift+I, Windows key.
**Expected:** All shortcuts blocked or handled.

---

### ST-012: GCM Nonce Reuse Prevention
**Threat:** Content security
**Test:** Encrypt 10,000 questions. Verify all IVs are unique.
**Expected:** Zero IV collisions.

---

## Execution

```bash
pytest tests/security/ -v --tb=long
```

---

## Related Documents

- [[ThreatModel]] — Threats being tested
- [[SecurityModel]] — Security controls
- [[TestPlan]] — Overall test strategy
