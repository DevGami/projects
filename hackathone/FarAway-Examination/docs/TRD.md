# Technical Requirements Document (TRD)

# FortisExam

Version: 1.0

Status: Draft

Related Documents:

* PRD.md
* Architecture.md
* SecurityModel.md

---

# 1. Technical Overview

FortisExam is an edge-first examination platform designed to securely conduct high-stakes examinations.

The system minimizes trust in centralized infrastructure by pushing examination execution to local examination center nodes while maintaining cryptographic guarantees for confidentiality, integrity, and auditability.

The architecture follows:

* Zero Trust Principles
* Offline First Design
* Event Driven Auditing
* Edge Computing
* Defense in Depth

---

# 2. System Components

The platform consists of three primary zones:

## Zone A

Secure Authoring Cloud

Responsibilities:

* Question authoring
* Question encryption
* Exam compilation
* Package generation
* Audit logging

---

## Zone B

Distribution Layer

Responsibilities:

* Package delivery
* Key distribution
* Package verification

---

## Zone C

Center Edge Node

Responsibilities:

* Local authentication
* Exam execution
* State recovery
* Monitoring
* Submission packaging

---

# 3. High Level Architecture

```text
Admin Portal
     |
     v
Question Service
     |
     v
Encryption Service
     |
     v
Package Generator
     |
     v
Distribution Service
     |
     v
Center Edge Node
     |
     +---- Candidate Kiosk
     |
     +---- Local Database
     |
     +---- Audit Service
     |
     +---- Monitoring Service
```

---

# 4. Service Architecture

## Question Service

Purpose:

Manage examination questions.

Responsibilities:

* Create questions
* Update questions
* Version tracking
* Metadata management

Technology:

* FastAPI
* PostgreSQL

---

## Encryption Service

Purpose:

Protect examination content.

Responsibilities:

* Encrypt questions
* Encrypt exam packages
* Verify signatures

Technology:

* AES-256-GCM
* RSA-4096
* HKDF

---

## Compilation Service

Purpose:

Generate examination papers.

Responsibilities:

* Blueprint validation
* Question selection
* Variant generation

Technology:

* Python
* NetworkX

---

## Distribution Service

Purpose:

Deliver packages to centers.

Responsibilities:

* Package upload
* Package verification
* Key delivery

Technology:

* FastAPI
* Signed manifests

---

## Authentication Service

Purpose:

Candidate verification.

Responsibilities:

* QR validation
* Face verification
* Session creation

Technology:

* InsightFace
* OpenCV

---

## Examination Service

Purpose:

Exam execution.

Responsibilities:

* Question rendering
* Answer collection
* Timer management

Technology:

* Electron
* React

---

## State Recovery Service

Purpose:

Prevent data loss.

Responsibilities:

* Local persistence
* Recovery
* Synchronization

Technology:

* SQLite
* Redis

---

## Monitoring Service

Purpose:

Detect suspicious activity.

Responsibilities:

* Face count monitoring
* Gaze monitoring
* Event generation

Technology:

* MediaPipe

---

## Audit Service

Purpose:

Generate tamper-evident logs.

Responsibilities:

* Event logging
* Hash generation
* Verification

Technology:

* SHA256
* Merkle Tree

---

# 5. Module Definitions

## Module 01

Question Pool System

Inputs:

* Question Data

Outputs:

* Encrypted Questions

Dependencies:

* Encryption Service

---

## Module 02

Package Delivery System

Inputs:

* Compiled Exam

Outputs:

* Encrypted Package

Dependencies:

* Distribution Service

---

## Module 03

Authentication System

Inputs:

* QR Token
* Face Image

Outputs:

* Authenticated Session

Dependencies:

* Authentication Service

---

## Module 04

Spatial Randomization System

Inputs:

* Seating Layout
* Question Set

Outputs:

* Candidate Variant

Dependencies:

* Compilation Service

---

## Module 05

Recovery System

Inputs:

* Candidate Events

Outputs:

* Persistent State

Dependencies:

* Local Storage

---

## Module 06

Monitoring System

Inputs:

* Webcam Stream

Outputs:

* Security Events

Dependencies:

* Monitoring Service

---

## Module 07

Audit Ledger

Inputs:

* System Events

Outputs:

* Audit Chain

Dependencies:

* Audit Service

---

# 6. Data Models

## Candidate

```json
{
  "id": "uuid",
  "name": "string",
  "centerId": "uuid",
  "photoEmbedding": "vector",
  "qrToken": "string",
  "status": "enum"
}
```

---

## Question

```json
{
  "id": "uuid",
  "subject": "string",
  "difficulty": "enum",
  "encryptedContent": "string",
  "metadata": {}
}
```

---

## Exam

```json
{
  "id": "uuid",
  "slot": "datetime",
  "packageId": "uuid",
  "status": "enum"
}
```

---

## Candidate Session

```json
{
  "id": "uuid",
  "candidateId": "uuid",
  "examId": "uuid",
  "startTime": "datetime",
  "endTime": "datetime",
  "status": "enum"
}
```

---

## Answer

```json
{
  "id": "uuid",
  "sessionId": "uuid",
  "questionId": "uuid",
  "selectedOption": "string",
  "timestamp": "datetime"
}
```

---

## Audit Event

```json
{
  "id": "uuid",
  "eventType": "string",
  "timestamp": "datetime",
  "payloadHash": "string",
  "previousHash": "string",
  "currentHash": "string"
}
```

---

# 7. API Contracts

## POST /questions

Create Question

Request

```json
{
  "subject": "Physics",
  "content": "Question"
}
```

Response

```json
{
  "questionId": "uuid"
}
```

---

## POST /compile-exam

Compile Exam

Response

```json
{
  "examId": "uuid",
  "packageId": "uuid"
}
```

---

## POST /authenticate

Authenticate Candidate

Request

```json
{
  "qrToken": "string",
  "faceImage": "base64"
}
```

Response

```json
{
  "sessionId": "uuid",
  "authenticated": true
}
```

---

## POST /submit-answer

Request

```json
{
  "sessionId": "uuid",
  "questionId": "uuid",
  "answer": "B"
}
```

Response

```json
{
  "saved": true
}
```

---

## POST /submit-exam

Response

```json
{
  "submissionId": "uuid"
}
```

---

# 8. Security Requirements

## Authentication

* JWT based sessions
* Signed QR tokens

---

## Encryption

At Rest

* AES-256-GCM

In Transit

* TLS 1.3

---

## Integrity

* SHA256 hashes
* Signed manifests

---

## Auditability

Every critical event must generate:

```text
event
previous_hash
current_hash
timestamp
signature
```

---

# 9. Performance Requirements

Question Load

< 2 seconds

---

Answer Save

< 100 ms

---

Authentication

< 5 seconds

---

Recovery

< 60 seconds

---

Monitoring Latency

< 2 seconds

---

# 10. Development Standards

Backend

* Python
* FastAPI
* SQLAlchemy

Frontend

* React
* TypeScript

Desktop

* Electron

Database

* PostgreSQL
* SQLite
* Redis

---

# 11. Testing Requirements

Unit Tests

Minimum 80% coverage

---

Integration Tests

All API contracts

---

Security Tests

* Package tampering
* Signature validation
* Unauthorized access

---

Recovery Tests

* Power failure
* Process crash
* Session recovery

---

# 12. Demo Scope

The proof-of-concept implementation must demonstrate:

1. Question Creation
2. Package Encryption
3. Candidate Authentication
4. Spatial Seat Randomization
5. Exam Execution
6. State Recovery
7. Audit Logging
8. Monitoring Alerts

Anything not required for the demo should be mocked, simulated, or documented as a production extension.

---

# 13. Future Production Enhancements

* AWS Nitro Enclaves
* Hardware Security Modules
* Threshold Cryptography
* Kafka Event Streaming
* Distributed Sharding
* Multi-region Deployment
* AI Leak Detection Agent
* Center Risk Scoring
* Subjective Answer Evaluation
* Government Identity Integration

```
```
