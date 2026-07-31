# Architecture Design Document

# FortisExam

Version: 1.0

Status: Draft

Related Documents:

* PRD.md
* TRD.md

---

# 1. Architecture Vision

FortisExam follows an Edge-First, Zero-Trust architecture designed for conducting high-stakes examinations at national scale.

Unlike traditional examination systems that rely on centralized cloud infrastructure during examination execution, FortisExam treats each examination center as an independent secure execution environment.

Core principles:

* Offline First
* Zero Trust
* Defense In Depth
* Cryptographic Accountability
* Local Resilience
* Scalable Synchronization

---

# 2. Architectural Goals

## Security

Prevent unauthorized access to examination content.

---

## Reliability

Allow examination centers to continue operating without internet access.

---

## Auditability

Provide verifiable evidence of all critical actions.

---

## Scalability

Support millions of candidates and thousands of centers.

---

## Recoverability

Allow restoration of examination sessions after device failure.

---

# 3. System Zones

The platform is divided into three trust boundaries.

## Zone A

Secure Authoring Cloud

Responsibilities:

* Question creation
* Question encryption
* Exam compilation
* Package generation
* Audit logging

Actors:

* Examination Authority
* Subject Experts

---

## Zone B

Distribution Layer

Responsibilities:

* Package distribution
* Manifest verification
* Key delivery

Actors:

* Distribution Service

---

## Zone C

Center Edge Environment

Responsibilities:

* Authentication
* Exam execution
* Monitoring
* State recovery
* Submission packaging

Actors:

* Candidates
* Invigilators
* Center Administrators

---

# 4. High Level Architecture

```text
+------------------------------------------------+
|           Secure Authoring Cloud               |
+------------------------------------------------+
|                                                |
| Admin Portal                                   |
| Question Service                               |
| Encryption Service                             |
| Compilation Service                            |
| Audit Service                                  |
|                                                |
+------------------+-----------------------------+
                   |
                   |
                   v
+------------------------------------------------+
|            Distribution Layer                  |
+------------------------------------------------+
|                                                |
| Package Distribution Service                   |
| Key Distribution Service                       |
| Manifest Verification                          |
|                                                |
+------------------+-----------------------------+
                   |
                   |
                   v
+------------------------------------------------+
|            Center Edge Node                    |
+------------------------------------------------+
|                                                |
| Authentication Service                         |
| Examination Service                            |
| Monitoring Service                             |
| State Recovery Service                         |
| Local Database                                 |
| Audit Service                                  |
|                                                |
+------------------+-----------------------------+
                   |
                   |
      +------------+------------+
      |                         |
      v                         v

 Candidate Kiosk        Proctor Dashboard
```

---

# 5. Core Modules

## Module 01

Question Pool System

Purpose:

Secure question storage and management.

Components:

* Question Service
* Encryption Service

Input:

* Question Content

Output:

* Encrypted Question Objects

---

## Module 02

Secure Package Distribution

Purpose:

Deliver encrypted examination packages.

Components:

* Package Generator
* Distribution Service

Input:

* Compiled Examination

Output:

* Encrypted Package

---

## Module 03

Authentication System

Purpose:

Verify candidate identity.

Components:

* QR Verification
* Face Verification

Input:

* Candidate Token
* Face Image

Output:

* Authenticated Session

---

## Module 04

Spatial Graph Randomization

Purpose:

Prevent copying between nearby candidates.

Components:

* Layout Engine
* Graph Builder
* Variant Generator

Input:

* Seating Layout
* Question Bank

Output:

* Candidate-Specific Variant

---

## Module 05

State Recovery

Purpose:

Prevent answer loss.

Components:

* Local Cache
* Sync Service

Input:

* Candidate Events

Output:

* Recoverable Session State

---

## Module 06

Edge Monitoring

Purpose:

Detect suspicious activity.

Components:

* Webcam Processor
* Event Detector

Input:

* Video Stream

Output:

* Security Events

---

## Module 07

Audit Ledger

Purpose:

Create tamper-evident records.

Components:

* Event Logger
* Hash Chain Generator

Input:

* System Events

Output:

* Cryptographic Audit Chain

---

# 6. Service Communication

## Cloud Services

Communication Style:

REST APIs

Protocol:

HTTPS

---

## Edge Services

Communication Style:

REST APIs

Protocol:

Local Network

---

## Internal Desktop Communication

Communication Style:

IPC

Protocol:

Electron IPC

---

# 7. Authentication Flow

```text
Candidate Arrives
        |
        v

Scan QR Token
        |
        v

Validate Signature
        |
        v

Capture Face
        |
        v

Compare Face Embedding
        |
        v

Authentication Success
        |
        v

Create Session
```

---

# 8. Examination Flow

```text
Candidate Login
        |
        v

Load Variant
        |
        v

Start Timer
        |
        v

Answer Questions
        |
        v

Auto Save Answers
        |
        v

Submit Exam
        |
        v

Generate Submission Package
```

---

# 9. Recovery Flow

```text
Answer Updated
        |
        v

Write To SQLite
        |
        v

Sync To Edge Server
        |
        v

Create Recovery Snapshot
```

Failure:

```text
Device Failure
        |
        v

Candidate Reauthenticates
        |
        v

Load Snapshot
        |
        v

Restore State
```

---

# 10. Security Architecture

## Layer 1

Identity Security

Controls:

* Signed QR Tokens
* Face Verification

---

## Layer 2

Content Security

Controls:

* AES-256 Encryption
* Package Signatures

---

## Layer 3

Execution Security

Controls:

* Kiosk Mode
* Restricted Navigation

---

## Layer 4

Audit Security

Controls:

* Hash Chaining
* Signed Events

---

# 11. Data Architecture

## Cloud Database

Purpose:

Administrative Data

Technology:

PostgreSQL

Stores:

* Users
* Questions
* Exams
* Centers

---

## Edge Database

Purpose:

Local Operations

Technology:

SQLite

Stores:

* Sessions
* Answers
* Recovery Snapshots

---

## Cache Layer

Purpose:

High Speed Synchronization

Technology:

Redis

Stores:

* Active Sessions
* Temporary State

---

# 12. Monitoring Architecture

Input:

Webcam Feed

Processing:

MediaPipe

Detection Rules:

* Multiple Faces
* Looking Away
* Camera Missing

Output:

Security Event

Event Severity:

* Low
* Medium
* High

---

# 13. Audit Architecture

Every critical action generates:

```json
{
  "eventId": "uuid",
  "eventType": "string",
  "timestamp": "datetime",
  "payloadHash": "sha256",
  "previousHash": "sha256",
  "currentHash": "sha256"
}
```

Example Events:

* Question Created
* Question Modified
* Package Generated
* Candidate Authenticated
* Answer Submitted
* Exam Submitted

---

# 14. Deployment Architecture

## Cloud

Components:

* FastAPI Backend
* PostgreSQL
* Redis

Deployment:

Docker Compose

---

## Edge Node

Components:

* FastAPI Edge Server
* SQLite
* Redis

Deployment:

Docker Compose

---

## Candidate Terminal

Components:

* Electron Application
* React Frontend

Deployment:

Native Desktop Application

---

# 15. Hackathon Scope

Implemented:

* Question Management
* Package Encryption
* Candidate Authentication
* Spatial Randomization
* Exam Execution
* State Recovery
* Audit Ledger
* Monitoring Alerts

Mocked:

* Satellite Distribution
* Government Identity Integration
* Hardware Security Modules
* Trusted Execution Environments

---

# 16. Production Evolution

Future Enhancements:

* AWS Nitro Enclaves
* Threshold Cryptography
* Hardware Security Modules
* Kafka Event Streaming
* Distributed Sharding
* Multi-Region Deployment
* Advanced AI Monitoring

The hackathon implementation serves as a proof-of-concept demonstrating the architectural viability of a national-scale Zero Trust examination infrastructure.
