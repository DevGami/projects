<p align="center">
  <img src="https://img.shields.io/badge/FortisExam-Zero%20Trust%20Examination-0d47a1?style=for-the-badge&labelColor=1a237e" alt="FortisExam" />
</p>

<h1 align="center">🛡️ FortisExam</h1>
<h3 align="center">Zero-Trust, Edge-First, Cryptographically Accountable Examination Infrastructure</h3>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11-blue?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Electron-28-47848f?logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/AES--256--GCM-Encrypted-red?logo=letsencrypt&logoColor=white" />
</p>

<p align="center">
  <a href="https://far-away-examination.vercel.app"><strong>🌐 Live Admin Portal</strong></a> &nbsp;·&nbsp;
  <a href="https://far-away-examination-kisok.vercel.app"><strong>🖥️ Candidate Kiosk Demo</strong></a>
</p>

---

## 🎯 The Problem

Every year, millions of Indian students sit for life-changing examinations — **NEET, JEE, UPSC, SSC**. And every year, headlines scream about **paper leaks, impersonation, mass cheating, and cancelled exams**.

- **NEET-UG 2024:** Paper leak allegations affecting **24 lakh candidates**
- **UGC-NET 2024:** Exam cancelled nationwide after security breach
- **SSC, State-Level Exams:** Recurring irregularities across multiple states

**The root cause isn't technology — it's trust.** Current systems place enormous trust in central servers, network connectivity, and human processes. A single insider, a single network failure, or a single compromised server can compromise an entire national exam.

---

## 💡 Our Solution

> *What if the examination system trusted nobody — not even itself?*

**FortisExam** is a **Zero-Trust Examination Infrastructure** — not another proctoring tool. We eliminate the fundamental vectors of exam fraud through cryptography, not surveillance.

### Three Pillars

| Pillar | How It Works |
|---|---|
| 🔐 **Leak Prevention** | Questions encrypted with **AES-256-GCM**. Decryption keys are time-locked, center-specific, and delivered separately. No single person can access plaintext questions before exam time. |
| 🧩 **Cheat Prevention** | A **spatial graph coloring algorithm** ensures adjacent candidates receive entirely different question and option orderings. Copying is rendered mathematically useless. |
| 📜 **Cryptographic Accountability** | Every action — question creation, answer submission, face scan — is logged in a **SHA-256 hash-chained tamper-evident audit ledger**. Any modification is detectable. |

---

## 🏗️ Architecture

FortisExam uses an **Edge-First** architecture inspired by CDN and military communication patterns:

```
┌─────────────────────────────────────────────────────────────┐
│                        CLOUD TIER                           │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Admin Portal  │───▶│ Cloud Server │───▶│ PostgreSQL   │  │
│  │ (React+Clerk) │    │  (FastAPI)   │    │ (Neon Cloud)  │  │
│  └──────────────┘    └──────┬───────┘    └──────────────┘  │
│                             │                               │
│                   Encrypted Packages                        │
│                   + Wrapped AES Keys                        │
│                             │                               │
├─────────────────────────────┼───────────────────────────────┤
│                        EDGE TIER                            │
│                             ▼                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Kiosk App   │───▶│ Edge Server  │───▶│   SQLite     │  │
│  │ (Electron)   │    │  (FastAPI)   │    │  (WAL mode)  │  │
│  │ Kiosk Mode   │    │  RSA JWT     │    │  Offline DB  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                             │
│  🔒 Fully offline — no internet required during exam        │
└─────────────────────────────────────────────────────────────┘
```

**Before the exam:** Questions are authored, encrypted, compiled into packages, and distributed to centers — all while encrypted.

**During the exam:** Each center operates as an independent, secure edge node. No internet required. Authentication, exam delivery, monitoring, and answer storage all happen locally.

**After the exam:** Encrypted answer packages are synced back. The audit chain is verified end-to-end.

---

## ✨ Key Features

### 🔐 Cryptographic Question Security
- Questions encrypted at rest with **AES-256-GCM**
- Even database administrators cannot read plaintext questions
- RSA-2048 key wrapping for secure key distribution
- Content integrity verified via **SHA-256 hashing**

### 🧩 Spatial Anti-Cheating (Graph Coloring)
- Seating layout modeled as an **adjacency graph**
- **NetworkX graph coloring** ensures no two adjacent candidates see the same question order
- Both question sequence AND option labels are randomized per variant
- Copying from neighbors yields incorrect answers

### 👤 Dual-Factor Candidate Authentication
- **Factor 1:** Cryptographically signed QR token (RSA-2048)
- **Factor 2:** Real-time face verification (**InsightFace** embeddings)
- Single-use nonces prevent replay attacks
- Supervisor override mechanism (audit-logged)

### 💥 Crash-Resilient Exam Execution
- All answers auto-saved to **SQLite WAL** on every submission
- Application crash → restart → re-authenticate → resume in < 60 seconds
- **Zero answers lost**, timer resumes from exact position

### 📜 Tamper-Evident Audit Ledger
- Hash-chained event log (SHA-256, Merkle-style)
- Every event references the previous event's hash
- Modifying any historical event **breaks the chain** — mathematically detectable
- Covers: question creation, authentication, answer submission, key release

### 🤖 Edge AI Monitoring
- **MediaPipe** face mesh for gaze deviation detection
- Multiple-face detection (phone-friend scenarios)
- Runs **entirely on-device** — no cloud dependency, no privacy concerns

### 🌐 Offline-First Design
- Exam centers operate independently as edge nodes
- Network outages don't cancel exams
- Post-exam sync with conflict resolution

---

## 🖥️ Live Deployment

| Component | URL | Description |
|---|---|---|
| **Admin Portal** | [far-away-examination.vercel.app](https://far-away-examination.vercel.app) | Full admin dashboard — question bank, exam builder, package management, distribution, audit explorer, live monitoring |
| **Candidate Kiosk** | [far-away-examination-kisok.vercel.app](https://far-away-examination-kisok.vercel.app) | Web-based kiosk demo — candidate authentication, exam execution, answer submission *(also accessible via "Kiosk Demo" button in admin portal)* |
| **Cloud API** | [far-away-examination.onrender.com](https://far-away-examination.onrender.com) | FastAPI backend — REST API with Clerk JWT auth, PostgreSQL (Neon) |

> **Note:** The Kiosk is designed as an air-gapped **Electron** desktop application with kiosk mode lockdown. The web version above is hosted for judges' convenience.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | Python 3.11, FastAPI | Async API server (cloud + edge modes) |
| **Cloud Auth** | Clerk | Admin panel authentication + RBAC |
| **Edge Auth** | Custom RSA-2048 JWT | Offline candidate authentication |
| **Cloud DB** | PostgreSQL 15 (Neon) | Admin data, question bank, exam metadata |
| **Edge DB** | SQLite (WAL mode) | Zero-config embedded database for offline operation |
| **Crypto** | AES-256-GCM, RSA-2048, SHA-256 | Question encryption, key wrapping, audit hashing |
| **Frontend** | React 18, TypeScript, Vite | Admin portal + Kiosk UI |
| **Desktop** | Electron 28 | Locked-down kiosk mode for exam centers |
| **Graph** | NetworkX | Seating adjacency modeling + graph coloring |
| **Face AI** | InsightFace | Face embedding extraction + comparison |
| **Monitoring** | MediaPipe | On-device gaze tracking + anomaly detection |
| **Deployment** | Vercel, Render, Neon, Docker | Cloud hosting + containerized local dev |

---

## 📂 Project Structure

```
FortisExam/
├── server/                    # FastAPI backend (dual-mode: cloud + edge)
│   ├── app/
│   │   ├── api/
│   │   │   ├── cloud/         # Admin endpoints (questions, exams, packages, distribution)
│   │   │   ├── edge/          # Exam endpoints (auth, exam execution, recovery, monitoring)
│   │   │   └── common/        # Shared endpoints (health, audit)
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── services/          # Business logic layer
│   │   ├── middleware/        # Clerk JWT verification
│   │   └── db/                # Database configuration
│   └── requirements.txt
│
├── web/                       # Admin Portal (React + Vite + Clerk)
│   └── src/
│       ├── pages/             # Dashboard, Questions, Exams, Audit, Monitoring, etc.
│       ├── components/        # Reusable UI components (design system)
│       └── services/          # API client layer
│
├── desktop/                   # Candidate Kiosk (Electron + React)
│   ├── electron/              # Main process (kiosk mode, window management)
│   └── src/
│       ├── pages/             # Auth, Exam, Results pages
│       └── services/          # Edge API client
│
├── shared/                    # Shared Python libraries
│   ├── crypto/                # AES-256-GCM, RSA key management, JWT handler
│   ├── audit/                 # Hash-chained ledger implementation
│   └── graph/                 # Seating graph + variant generator (NetworkX)
│
├── scripts/                   # Automation scripts
│   ├── seed_demo.py           # Full demo data seeder (30 questions, 9 candidates, 3 centers)
│   ├── keygen.py              # RSA key pair generator
│   └── reset_demo.py          # Clean reset for demo environment
│
├── tests/                     # Test suite
│   ├── unit/                  # Unit tests (crypto, graph, audit)
│   ├── integration/           # API integration tests
│   └── security/              # Security-specific tests
│
├── docker/                    # Docker Compose configuration
│   ├── docker-compose.yml
│   └── Dockerfile
│
├── docs/                      # Source documentation
│   ├── PRD.md                 # Product Requirements Document
│   └── TechnicalDesign.md     # Technical Design Document
│
└── vault/                     # Project knowledge vault (Obsidian)
    ├── 00_Project/            # Elevator pitch, judge narrative, demo flow
    ├── 01_Product/            # PRD summary, user stories
    ├── 02_Architecture/       # Architecture diagrams, security model
    ├── 03_Modules/            # Per-module documentation (8 modules)
    ├── 04_Implementation/     # Deployment plan, API specs
    ├── 05_Development/        # Sprint board, changelog, known issues
    ├── 06_Testing/            # Bug tracker, testing checklist
    └── 08_Frontend/           # UI/UX documentation, design system
```

---

## 🚀 Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15 (or use Docker)

### Quick Start

```bash
# 1. Clone
git clone https://github.com/Harsh15505/FarAway-Examination.git
cd FarAway-Examination

# 2. Backend setup
cd server
pip install -r requirements.txt
# Set environment variables (DATABASE_URL, CLERK_SECRET_KEY, etc.)
# See server/.env.example

# 3. Seed demo data
python scripts/seed_demo.py

# 4. Start cloud server
$env:SERVER_MODE="cloud"
python -m uvicorn server.app.main:app --port 8000 --reload

# 5. Start admin portal (new terminal)
cd web
npm install
npm run dev    # → http://localhost:5173

# 6. Start edge server (new terminal)
$env:SERVER_MODE="edge"
python -m uvicorn server.app.main:app --port 8001 --reload

# 7. Start kiosk (new terminal)
cd desktop
npm install
npm run dev    # → Electron kiosk app
```

### Docker (Alternative)

```bash
docker compose -f docker/docker-compose.yml up --build
```

---

## 🔒 Security Model

```
Layer 1 — Identity
├── Admin: Clerk JWT (RBAC: admin, expert, supervisor)
└── Candidate: QR Token (RSA-2048 signed) + Face Verification (InsightFace)

Layer 2 — Content Protection
├── Questions: AES-256-GCM encryption at rest
├── Keys: RSA-4096 key wrapping, time-locked delivery
└── Packages: SHA-256 integrity verification

Layer 3 — Execution Isolation
├── Electron kiosk mode (no Alt-Tab, no DevTools, no browser chrome)
├── Edge-local operation (no internet attack surface)
└── SQLite WAL (crash-resilient state persistence)

Layer 4 — Audit & Accountability
├── SHA-256 hash-chained event ledger (Merkle-style)
├── Every action cryptographically linked to previous
└── Tamper detection: any modification breaks the chain
```

---

## 📊 Implementation Status

| Module | Feature | Status |
|---|---|---|
| **M01** | Question Authoring + AES-256-GCM Encryption | ✅ Implemented |
| **M02** | Exam Blueprint + Package Compilation | ✅ Implemented |
| **M03** | QR Authentication + Face Verification | ✅ Implemented |
| **M04** | Spatial Randomization (Graph Coloring) | ✅ Implemented |
| **M05** | Exam Execution + Crash Recovery | ✅ Implemented |
| **M06** | Edge AI Monitoring (MediaPipe) | ✅ Implemented |
| **M07** | Tamper-Evident Audit Ledger | ✅ Implemented |
| **M08** | Admin Dashboard + Distribution | ✅ Implemented |
| — | Satellite Distribution | 📋 Mocked |
| — | Government ID Integration (Aadhaar) | 📋 Mocked |
| — | HSM Key Management | 📋 Documented |
| — | Multi-Region Deployment | 📋 Documented |

---

## 🧪 Testing

```bash
# Run all tests
python -m pytest tests/ -v

# Unit tests only
python -m pytest tests/unit/ -v

# Integration tests
python -m pytest tests/integration/ -v

# Security tests
python -m pytest tests/security/ -v
```

---

## 🔮 Future Roadmap

1. **Threshold Cryptography** — M-of-N key holders required to decrypt (no single point of compromise)
2. **AWS Nitro Enclaves** — Hardware-isolated secure enclaves for exam execution
3. **Center Risk Scoring** — ML model to score centers based on historical anomaly patterns
4. **Canary Questions** — Unique marker questions that reveal the source of leaks
5. **Aadhaar Integration** — Government identity verification for production deployment

---

## 👥 Team

Team C3I2 (Ayaan Goel, Dev Gami, Harsh Bhavsar, Nishu Shukla)

---

## 📄 License

Proprietary — Hackathon Project © 2026
