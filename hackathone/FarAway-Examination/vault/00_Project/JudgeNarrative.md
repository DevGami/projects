# FortisExam — Judge Narrative

> **Last Updated:** 2026-06-08

---

## The Story

### The Problem That Won't Go Away

Every year, millions of Indian students sit for life-changing examinations — NEET, JEE, UPSC, SSC. And every year, headlines scream about **paper leaks, impersonation, mass cheating, and cancelled exams**.

In 2024 alone, NEET-UG was embroiled in paper leak allegations affecting **24 lakh candidates**. The human cost is staggering: students who studied for years see their futures derailed by systemic failures in exam security.

**The root cause isn't technology — it's trust.**

Current examination systems place enormous trust in central servers, network connectivity, and human processes. A single insider, a single network failure, a single compromised server can compromise an entire national exam.

---

### Our Insight: Zero Trust Is the Answer

We asked: **What if the examination system trusted nobody — not even itself?**

What if every question was encrypted so that no single person could read it before exam time? What if every answer was cryptographically signed so that no one could alter it after submission? What if every exam center could operate completely offline, independent of any cloud server?

**FortisExam was born from this insight.**

---

### What FortisExam Actually Is

FortisExam is **not** another AI proctoring tool. The market is flooded with those, and they solve the wrong problem.

FortisExam is a **Zero-Trust Examination Infrastructure** built on three pillars:

| Pillar | What It Means |
|---|---|
| **Leak Prevention** | Questions are encrypted with AES-256-GCM. Decryption keys are delivered separately, time-locked, and center-specific. No single person can access plaintext questions. |
| **Cheat Prevention** | A spatial graph algorithm ensures that adjacent candidates receive entirely different question sequences. Copying is rendered useless. |
| **Cryptographic Accountability** | Every action — every question created, every answer submitted, every face scanned — is logged in a hash-chained audit ledger. Tampering is mathematically detectable. |

---

### The Architecture That Makes It Possible

FortisExam uses an **Edge-First** architecture inspired by CDN and military communication patterns:

1. **Before the exam:** Questions are authored, encrypted, compiled into packages, and distributed to examination centers — all while encrypted.
2. **During the exam:** Each center operates as an independent, secure edge node. No internet required. Authentication, exam delivery, monitoring, and answer storage all happen locally.
3. **After the exam:** Encrypted answer packages are synced back. The audit chain is verified end-to-end.

This means a network outage during NEET doesn't cancel the exam. A compromised server doesn't leak the paper. A colluding center can't alter answers.

---

### Why This Matters

India conducts some of the **largest examinations in human history**. The current infrastructure was not designed for the threat landscape we face today. FortisExam demonstrates that it's possible to conduct exams at national scale with **mathematical guarantees** of security, not just procedural ones.

---

### Technical Depth

| Capability | Technology |
|---|---|
| Question encryption | AES-256-GCM with RSA-4096 key wrapping |
| Anti-copying | Graph coloring on seating adjacency graph (NetworkX) |
| Candidate identity | QR tokens + face verification (InsightFace) |
| Crash recovery | SQLite WAL + Redis session sync — recovery < 60s |
| Behavior monitoring | MediaPipe face mesh — runs entirely on-device |
| Audit integrity | SHA-256 hash-chained ledger (Merkle-style) |
| Offline operation | Full exam lifecycle runs without internet |

---

## Related Documents

- [[ElevatorPitch]] — 30-second pitch
- [[DemoFlow]] — Live demo walkthrough
- [[JudgeFAQ]] — Anticipated questions & answers
