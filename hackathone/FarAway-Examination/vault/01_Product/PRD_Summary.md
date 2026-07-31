# FortisExam — PRD Summary

> **Last Updated:** 2026-06-08
> **Source:** [[docs/PRD.md]]

---

## Product Vision

To become the most secure, auditable, and scalable digital examination platform capable of conducting nationwide examinations with minimal trust assumptions and maximum operational resilience.

---

## Primary Goals

| ID | Goal |
|---|---|
| G1 | Prevent question paper leakage before examination start |
| G2 | Enable examination centers to operate completely offline |
| G3 | Prevent candidate-to-candidate copying |
| G4 | Provide cryptographically verifiable audit trails |
| G5 | Ensure examination continuity during power or system failures |
| G6 | Scale to millions of candidates across thousands of centers |

---

## Non-Goals (V1 Exclusions)

- Online remote examinations from home
- AI-based automatic grading of descriptive answers
- Government identity API integration
- Blockchain-based storage
- Multilingual translation pipelines
- Real production deployment

---

## Functional Requirements Summary

| ID | Requirement | Key Acceptance Criteria |
|---|---|---|
| FR-01 | Question Authoring | CRUD operations, metadata, version history |
| FR-02 | Secure Question Storage | Encrypted at rest, keys separated from content |
| FR-03 | Examination Compilation | Randomized selection, configurable blueprint |
| FR-04 | Secure Distribution | Encrypted packages, integrity verification |
| FR-05 | Candidate Authentication | QR verification, face verification, supervisor override |
| FR-06 | Examination Execution | Kiosk mode, navigation, timer, auto-save |
| FR-07 | Spatial Anti-Copying | Seat-specific variants, question/option randomization |
| FR-08 | State Recovery | Recovery < 60s, answers and timer restored |
| FR-09 | Anomaly Detection | Multi-face detection, gaze deviation |
| FR-10 | Audit Logging | Cryptographically linked events, exportable |

---

## Non-Functional Requirements

| Category | Requirement |
|---|---|
| Security | Zero Trust, AES-256, signed payloads, RBAC |
| Scalability | 1.5M candidates, 10K+ centers, async sync |
| Reliability | 99.9% exam completion, offline operation, auto failover |
| Performance | Auth < 5s, load < 2s, save < 100ms, recover < 60s |

---

## Target Users

| Role | Responsibilities |
|---|---|
| Examination Authority | Question management, center management, scheduling, audit review |
| Center Administrator | Setup, onboarding, monitoring, incident management |
| Invigilator | Candidate verification, session supervision, incident reporting |
| Candidate | Authentication, exam participation, answer submission |
| Auditor | Investigation, compliance verification, incident review |

---

## Risks & Mitigations

| ID | Risk | Mitigation |
|---|---|---|
| R1 | Compromised center hardware | Cryptographic package isolation |
| R2 | Candidate impersonation | Face verification |
| R3 | Network outage | Offline-first architecture |
| R4 | Insider threats | Audit logging + access control |

---

## Related Documents

- [[UserStories]] — Detailed user stories
- [[ProblemAnalysis]] — Root cause analysis
- [[SuccessMetrics]] — Measurable outcomes
