# FortisExam — Test Plan

> **Last Updated:** 2026-06-08

---

## Testing Strategy

### Test Pyramid

```
        /  E2E Tests  \           ← Few, high-value integration flows
       / Integration    \         ← API contract verification
      / Security Tests    \       ← Threat mitigation validation
     / Performance Tests    \     ← Latency & throughput targets
    /   Unit Tests           \    ← Foundation, 80%+ coverage
```

---

## Test Categories

### 1. Unit Tests (80% coverage target)

| Module | Test Focus | Framework |
|---|---|---|
| `shared/crypto/aes.py` | Encrypt/decrypt roundtrip, GCM auth tag validation | pytest |
| `shared/crypto/rsa.py` | Key generation, signing, verification | pytest |
| `shared/crypto/hkdf.py` | Key derivation determinism | pytest |
| `shared/audit/hash_chain.py` | Chain generation, verification, tamper detection | pytest |
| `shared/graph/coloring.py` | Graph coloring validity (no adjacent same color) | pytest |
| `shared/graph/variant_generator.py` | Variant uniqueness per seed | pytest |
| `backend/services/question_service.py` | CRUD operations, encryption on save | pytest |
| `backend/services/audit_service.py` | Event creation, chain append | pytest |
| `edge/services/auth_service.py` | QR validation, session creation | pytest |
| `edge/services/recovery_service.py` | Snapshot save/restore | pytest |

### 2. Integration Tests

| Test | Description | Scope |
|---|---|---|
| Question lifecycle | Create → encrypt → store → retrieve | Cloud API |
| Exam compilation | Blueprint → select → compile → package | Cloud API |
| Package distribution | Generate → sign → distribute → verify | Cloud → Edge |
| Authentication flow | QR scan → validate → face verify → session | Edge API |
| Exam execution | Load variant → answer → auto-save → submit | Edge API |
| State recovery | Save state → kill process → recover | Edge API |
| Audit verification | Log events → verify chain integrity | Cross-zone |

### 3. Security Tests

See [[SecurityTests]] for detailed security test cases.

### 4. Performance Tests

See [[PerformanceTests]] for latency and throughput benchmarks.

### 5. Regression Tests

See [[RegressionTests]] for regression test suite.

---

## Test Execution

```bash
# Run all unit tests
pytest tests/ -v --cov=shared --cov=backend --cov=edge --cov-report=html

# Run integration tests
pytest tests/integration/ -v

# Run security tests
pytest tests/security/ -v

# Run performance tests
pytest tests/performance/ -v --benchmark
```

---

## CI/CD Integration

- All unit tests run on every commit
- Integration tests run on PR merge to `dev`
- Security tests run nightly
- Performance tests run on release candidate

---

## Related Documents

- [[SecurityTests]] — Security test cases
- [[PerformanceTests]] — Performance benchmarks
- [[RegressionTests]] — Regression suite
- [[TestCases]] — Detailed test case registry
- [[BugTracker]] — Bug reports
