# FortisExam — Test Cases

> **Last Updated:** 2026-06-08

---

## Test Case Registry

### TC-001: Question Creation with Encryption
**Module:** Module 01 (Question Pool)
**Type:** Integration
**Steps:**
1. POST /api/v1/questions with plaintext content
2. Verify response returns question ID
3. Query database directly
4. Assert stored content is encrypted (not plaintext)
5. Assert encrypted_key, iv, auth_tag are present
**Expected:** Question stored as ciphertext only

---

### TC-002: Question Decryption Roundtrip
**Module:** Module 01
**Type:** Unit
**Steps:**
1. Generate AES-256-GCM key
2. Encrypt sample content
3. Decrypt with same key
4. Compare plaintext
**Expected:** Decrypted content matches original

---

### TC-003: Tampered Ciphertext Rejection
**Module:** Module 01
**Type:** Unit
**Steps:**
1. Encrypt content
2. Modify one byte of ciphertext
3. Attempt decryption
**Expected:** GCM authentication failure, decryption rejected

---

### TC-004: Package Signature Verification
**Module:** Module 02
**Type:** Integration
**Steps:**
1. Generate exam package
2. Sign package with RSA private key
3. Verify signature with RSA public key
**Expected:** Signature valid

---

### TC-005: Tampered Package Rejection
**Module:** Module 02
**Type:** Security
**Steps:**
1. Generate and sign package
2. Modify package content
3. Verify signature
**Expected:** Signature invalid, package rejected

---

### TC-006: QR Token Validation
**Module:** Module 03
**Type:** Unit
**Steps:**
1. Generate signed QR token
2. Validate signature on edge server
3. Check nonce is unused
**Expected:** Token validated, nonce marked as used

---

### TC-007: QR Replay Prevention
**Module:** Module 03
**Type:** Security
**Steps:**
1. Generate and validate QR token (success)
2. Attempt to validate same token again
**Expected:** Second validation rejected (nonce reused)

---

### TC-008: Face Verification Match
**Module:** Module 03
**Type:** Unit
**Steps:**
1. Generate embedding from reference photo
2. Generate embedding from live capture (same person)
3. Compare cosine similarity
**Expected:** Similarity ≥ threshold (0.6)

---

### TC-009: Face Verification Mismatch
**Module:** Module 03
**Type:** Unit
**Steps:**
1. Generate embedding from reference photo (person A)
2. Generate embedding from live capture (person B)
3. Compare cosine similarity
**Expected:** Similarity < threshold

---

### TC-010: Graph Coloring Validity
**Module:** Module 04
**Type:** Unit
**Steps:**
1. Create 5×6 seating grid
2. Build adjacency graph (including diagonals)
3. Apply graph coloring
4. For every edge (u,v), check color(u) ≠ color(v)
**Expected:** No two adjacent seats share a variant

---

### TC-011: Variant Uniqueness
**Module:** Module 04
**Type:** Unit
**Steps:**
1. Generate variants for 4 different variant IDs
2. Compare question orders
**Expected:** All question orders differ

---

### TC-012: State Recovery After Crash
**Module:** Module 05
**Type:** Integration
**Steps:**
1. Start exam session
2. Answer 5 questions
3. Simulate process crash (kill)
4. Restart and recover
5. Verify all 5 answers present
6. Verify timer position correct
**Expected:** Full state recovered, no data loss

---

### TC-013: Audit Chain Integrity
**Module:** Module 07
**Type:** Unit
**Steps:**
1. Create chain with 50 events
2. Verify chain
**Expected:** All 50 events verify, chain intact

---

### TC-014: Audit Chain Tamper Detection
**Module:** Module 07
**Type:** Security
**Steps:**
1. Create chain with 50 events
2. Modify event #25 payload
3. Verify chain
**Expected:** Verification fails at event #25

---

## Related Documents

- [[TestPlan]] — Testing strategy
- [[SecurityTests]] — Security-specific tests
- [[BugTracker]] — Bug tracking
