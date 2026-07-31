# FortisExam — Regression Tests

> **Last Updated:** 2026-06-08

---

## Regression Suite

These tests verify that previously fixed bugs and core behaviors are not reintroduced.

---

### RT-001: Encryption Roundtrip
**Covers:** Core cryptographic integrity
**Test:** Encrypt → decrypt 100 random payloads. Verify all match.
**Frequency:** Every commit

### RT-002: Hash Chain Integrity
**Covers:** Audit ledger correctness
**Test:** Create 100-event chain. Verify all links. Modify one event. Verify detection.
**Frequency:** Every commit

### RT-003: Graph Coloring Correctness
**Covers:** Anti-copying guarantee
**Test:** Color 10 different layouts (3×3, 4×5, 5×6, 10×10). Verify no adjacent conflicts.
**Frequency:** Every commit

### RT-004: QR Nonce Uniqueness
**Covers:** Anti-replay protection
**Test:** Generate 1000 QR tokens. Verify all nonces unique.
**Frequency:** Every commit

### RT-005: Recovery Data Integrity
**Covers:** State recovery correctness
**Test:** Save 50 answers → create snapshot → restore → verify all 50 answers match.
**Frequency:** Every commit

### RT-006: Authentication Flow
**Covers:** End-to-end auth
**Test:** Valid QR + valid face → session created. Invalid QR → rejected. Invalid face → rejected.
**Frequency:** Every PR merge

### RT-007: Exam Submission Integrity
**Covers:** Answer integrity
**Test:** Submit exam → verify submission hash matches recomputed hash of answers.
**Frequency:** Every PR merge

---

## Execution

```bash
# Run regression suite
pytest tests/ -m regression -v
```

---

## Related Documents

- [[TestPlan]] — Overall strategy
- [[BugTracker]] — Bugs these tests guard against
- [[TestCases]] — Full test case registry
