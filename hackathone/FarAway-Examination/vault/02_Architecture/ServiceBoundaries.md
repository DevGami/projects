# FortisExam — Service Boundaries

> **Last Updated:** 2026-06-08

---

## Service Map

| Service | Zone | Owns | Exposes | Consumes |
|---|---|---|---|---|
| Question Service | A (Cloud) | Questions table | REST: CRUD questions | Encryption Service |
| Encryption Service | A (Cloud) | Encryption keys | Internal: encrypt/decrypt/sign | — |
| Compilation Service | A (Cloud) | Exam blueprints | REST: compile exam | Question Service, Encryption Service |
| Package Generator | A (Cloud) | Exam packages | Internal: generate package | Compilation Service, Encryption Service |
| Distribution Service | B (Dist) | Package manifests | REST: distribute, verify | Package Generator |
| Key Distribution Service | B (Dist) | Time-locked keys | REST: release key | Encryption Service |
| Authentication Service | C (Edge) | Sessions | REST: authenticate | Face Verification |
| Face Verification Service | C (Edge) | Embeddings | Internal: compare faces | InsightFace model |
| Examination Service | C (Edge) | Active exams | REST: load exam, submit answer | Authentication Service |
| State Recovery Service | C (Edge) | Recovery snapshots | Internal: save/restore | SQLite, Redis |
| Monitoring Service | C (Edge) | Security events | REST: report event | MediaPipe |
| Audit Service | A+C | Audit chain | REST: log event, verify chain | — |

---

## Ownership Rules

1. **Each service owns its data.** No service directly accesses another service's database.
2. **Communication is through APIs.** Services interact via REST or internal function calls, never shared state.
3. **Audit is cross-cutting.** The Audit Service runs in both Cloud (Zone A) and Edge (Zone C) with eventual sync.
4. **Encryption is a shared library.** Crypto primitives are a shared module, not a network service, for performance.

---

## API Boundary Contracts

See [[APIContracts]] for full endpoint specifications.

---

## Related Documents

- [[ArchitectureSummary]] — Architecture overview
- [[DataFlow]] — How data moves between services
- [[APIContracts]] — Detailed API specifications
