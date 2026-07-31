# Product Requirements Document (PRD)

# FortisExam

## Version

v1.0

## Status

Draft

## Last Updated

2026-06-08

---

# 1. Executive Summary

FortisExam is a secure, edge-first examination platform designed for large-scale, high-stakes examinations such as NEET, JEE, UPSC, SSC, and state-level competitive exams.

Unlike traditional centralized examination systems, FortisExam minimizes trust in central infrastructure by shifting critical examination execution to secure edge nodes deployed at examination centers.

The platform is designed to solve major challenges faced by examination authorities:

* Question paper leaks
* Center-level collusion
* Candidate impersonation
* Network dependency during examinations
* Infrastructure failures
* Lack of auditability
* Scalability challenges during nationwide examinations

FortisExam achieves this through cryptographic question delivery, offline examination execution, spatial anti-copying mechanisms, tamper-evident audit trails, and edge-based anomaly detection.

---

# 2. Problem Statement

National examinations regularly face operational and security failures including:

* Paper leaks before examination start
* Unauthorized access to question banks
* Candidate impersonation
* Copying between nearby candidates
* Network outages during examinations
* Difficulty proving accountability after incidents
* Large-scale cloud bottlenecks during peak examination periods

Current systems rely heavily on centralized trust and real-time connectivity.

FortisExam aims to redesign the examination lifecycle around Zero Trust and Edge Computing principles.

---

# 3. Product Vision

To become the most secure, auditable, and scalable digital examination platform capable of conducting nationwide examinations with minimal trust assumptions and maximum operational resilience.

---

# 4. Goals

## Primary Goals

### G1

Prevent question paper leakage before examination start.

### G2

Enable examination centers to operate completely offline during examinations.

### G3

Prevent candidate-to-candidate copying.

### G4

Provide cryptographically verifiable audit trails.

### G5

Ensure examination continuity during power or system failures.

### G6

Scale to millions of candidates across thousands of centers.

---

# 5. Non Goals

The following are explicitly out of scope for Version 1:

* Online remote examinations from home
* AI-based automatic grading of descriptive answers
* Integration with government identity APIs
* Blockchain-based storage systems
* Multilingual translation pipelines
* Real production deployment

These may be considered future enhancements.

---

# 6. Target Users

## Examination Authority

Examples:

* NTA
* UPSC
* SSC
* State Examination Boards

Responsibilities:

* Question management
* Center management
* Examination scheduling
* Audit review

---

## Examination Center Administrator

Responsibilities:

* Center setup
* Candidate onboarding
* Local server monitoring
* Incident management

---

## Invigilator

Responsibilities:

* Candidate verification
* Session supervision
* Incident reporting

---

## Candidate

Responsibilities:

* Authentication
* Examination participation
* Answer submission

---

## Auditor

Responsibilities:

* Investigation
* Compliance verification
* Incident review

---

# 7. Functional Requirements

## FR-01 Question Authoring

The system shall allow authorized experts to create examination questions.

Acceptance Criteria:

* Question creation supported
* Question editing supported
* Question metadata supported
* Version history maintained

---

## FR-02 Secure Question Storage

The system shall encrypt all question content before storage.

Acceptance Criteria:

* Questions stored encrypted
* Encryption keys separated from content
* Unauthorized users cannot access plaintext

---

## FR-03 Examination Compilation

The system shall generate examination papers from question pools.

Acceptance Criteria:

* Randomized question selection
* Configurable blueprint
* Repeatable generation process

---

## FR-04 Secure Distribution

The system shall distribute encrypted examination packages to centers.

Acceptance Criteria:

* Packages delivered before examination
* Packages unusable without decryption authorization
* Package integrity verification available

---

## FR-05 Candidate Authentication

The system shall authenticate candidates before examination access.

Acceptance Criteria:

* QR verification
* Face verification
* Supervisor override mechanism

---

## FR-06 Examination Execution

The system shall allow candidates to take examinations on secured terminals.

Acceptance Criteria:

* Full-screen kiosk mode
* Navigation controls
* Timer controls
* Auto-save support

---

## FR-07 Spatial Anti-Copying

The system shall generate seat-specific examination variants.

Acceptance Criteria:

* Nearby candidates receive different variants
* Question order randomization
* Option order randomization

---

## FR-08 State Recovery

The system shall recover examination state after failures.

Acceptance Criteria:

* Recovery within 60 seconds
* Answers restored
* Remaining time restored

---

## FR-09 Anomaly Detection

The system shall detect suspicious candidate behavior.

Acceptance Criteria:

* Multiple faces detected
* Excessive gaze deviation detected
* Incident flagged

---

## FR-10 Audit Logging

The system shall maintain a tamper-evident audit log.

Acceptance Criteria:

* Every critical action logged
* Logs cryptographically linked
* Audit trail export available

---

# 8. Non Functional Requirements

## Security

* Zero Trust architecture
* AES-256 encryption
* Signed payloads
* Role-based access control

---

## Scalability

* Support 1.5 million candidates
* Support 10,000+ centers
* Support asynchronous synchronization

---

## Reliability

* 99.9% examination completion success
* Offline center operation
* Automatic failover support

---

## Performance

### Authentication

Less than 5 seconds

### Question Loading

Less than 2 seconds

### Answer Save

Less than 100ms

### Recovery Time

Less than 60 seconds

---

# 9. Key Modules

## Module 1

Zero-Knowledge Question Pool

Purpose:

Protect question confidentiality.

---

## Module 2

Cryptographic Package Delivery

Purpose:

Secure examination distribution.

---

## Module 3

Candidate Authentication

Purpose:

Verify candidate identity.

---

## Module 4

Spatial Graph-Based Randomization

Purpose:

Prevent candidate copying.

---

## Module 5

State Resilience System

Purpose:

Guarantee examination continuity.

---

## Module 6

Edge AI Monitoring

Purpose:

Detect suspicious activity.

---

## Module 7

Cryptographic Audit Ledger

Purpose:

Provide accountability and traceability.

---

# 10. Success Metrics

## Security Metrics

* Zero successful paper leaks
* Zero unauthorized paper access
* Zero unauthorized result modifications

---

## Operational Metrics

* 95%+ successful candidate authentication
* 99%+ successful answer submission
* Less than 1 minute recovery after device failure

---

## Examination Metrics

* Reduced copying incidents
* Reduced center-level fraud
* Improved audit transparency

---

# 11. Risks

## R1

Compromised examination center hardware

Mitigation:

Cryptographic package isolation

---

## R2

Candidate impersonation

Mitigation:

Face verification

---

## R3

Network outage

Mitigation:

Offline-first architecture

---

## R4

Insider threats

Mitigation:

Audit logging and access control

---

# 12. Future Scope

* Threshold cryptography
* Secure enclaves
* Subjective answer evaluation
* Center risk scoring
* Fake leak detection agents
* Hardware security modules
* Multi-language support

---

# 13. Demo Scope (Hackathon)

The hackathon implementation will demonstrate:

* Secure question creation
* Encrypted package generation
* Candidate authentication
* Spatial seat randomization
* Offline examination workflow
* State recovery
* Audit logging
* Anomaly detection

The implementation represents a proof of concept for a production-scale examination platform.
