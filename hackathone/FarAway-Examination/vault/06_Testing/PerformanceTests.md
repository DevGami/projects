# FortisExam — Performance Tests

> **Last Updated:** 2026-06-08

---

## Performance Targets

| Operation | Target | Test Method |
|---|---|---|
| Authentication (QR + face) | < 5 seconds | End-to-end timing |
| Question loading | < 2 seconds | API response time |
| Answer save | < 100 ms | API response time |
| State recovery | < 60 seconds | Crash-to-resume timing |
| Monitoring detection | < 2 seconds | Event-to-alert latency |
| Audit chain verification | < 5 seconds (10K events) | Batch verification timing |

---

## Test Cases

### PT-001: Answer Save Latency
**Test:** Submit 100 answer save requests sequentially. Measure p50, p95, p99 response times.
**Target:** p99 < 100 ms
**Setup:** Edge server with SQLite + Redis, single candidate session.

### PT-002: Question Load Time
**Test:** Request 50 different questions. Measure load time including decryption.
**Target:** p95 < 2 seconds
**Setup:** Edge server with pre-loaded exam package.

### PT-003: Authentication Throughput
**Test:** Authenticate 30 candidates sequentially (simulating a center's onboarding).
**Target:** Each authentication < 5 seconds. Total < 3 minutes for 30 candidates.
**Setup:** Edge server with pre-loaded candidate data and face embeddings.

### PT-004: Recovery Time
**Test:** Start exam, answer 20 questions, kill process, measure time from restart to full restoration.
**Target:** < 60 seconds total (including re-authentication).
**Setup:** Edge server + Electron app.

### PT-005: Audit Verification Speed
**Test:** Generate chain of 10,000 events. Measure full chain verification time.
**Target:** < 5 seconds
**Setup:** SQLite audit store.

### PT-006: Concurrent Sessions
**Test:** Simulate 30 concurrent exam sessions on one edge server. Measure answer save latency under load.
**Target:** p95 answer save < 200 ms (relaxed target under load)
**Setup:** Load testing tool (locust or similar).

---

## Execution

```bash
pytest tests/performance/ -v --benchmark-json=benchmark_results.json
```

---

## Related Documents

- [[TestPlan]] — Overall test strategy
- [[SuccessMetrics]] — Performance targets from PRD
