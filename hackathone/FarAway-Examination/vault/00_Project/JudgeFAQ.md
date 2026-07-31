# FortisExam — Judge FAQ

> **Last Updated:** 2026-06-08

---

## Category: Product & Problem

### Q: How is this different from existing proctoring solutions like ProctorU or Mettl?

**A:** FortisExam is fundamentally different. Proctoring solutions monitor candidates *during* the exam using cloud-based video analysis. They don't address the core security problems: paper leaks *before* the exam, answer tampering *after* the exam, or network dependency *during* the exam.

FortisExam is not a proctoring layer — it's **examination infrastructure**. We solve:
- **Leak prevention** through cryptographic question protection
- **Cheat prevention** through spatial randomization (not surveillance)
- **Accountability** through tamper-evident audit trails

Proctoring is one small feature (Module 06). The architecture is about trustless exam execution.

---

### Q: What specific Indian exam failures inspired this?

**A:** NEET-UG 2024 paper leak (24 lakh candidates affected), UGC-NET 2024 cancellation, SSC exam irregularities, and recurring state-level competitive exam leaks. The pattern is consistent: centralized systems with too many trust assumptions.

---

### Q: Can this really scale to 1.5 million candidates?

**A:** The architecture is designed for it. Because each exam center operates independently as an edge node, the cloud doesn't need to handle real-time traffic during exams. Pre-exam distribution and post-exam aggregation are asynchronous. The bottleneck shifts from "serve 1.5M simultaneous connections" to "distribute encrypted packages to 10,000 centers" — a solved CDN problem.

---

## Category: Technical Architecture

### Q: What happens if the decryption key is intercepted?

**A:** Multiple defenses:
1. Keys are center-specific — compromising one key doesn't affect other centers
2. Keys are time-locked — delivered separately from packages, activated at exam start
3. Key delivery uses RSA-4096 encryption — intercepting ciphertext is useless
4. In production, keys would be managed by HSMs, making extraction physically impossible

---

### Q: Why not use blockchain for the audit trail?

**A:** Blockchain is explicitly out of scope (PRD Section 5). It's over-engineered for this use case. A hash-chained ledger provides the same tamper-evidence guarantee without the consensus overhead, energy cost, or complexity. We're solving for verifiability, not decentralization.

---

### Q: How does spatial randomization actually prevent copying?

**A:** We model the seating layout as a graph where adjacent seats are connected by edges. We apply graph coloring to assign each seat a different exam variant. The variant changes both question order and option order. Two adjacent candidates will never see the same question at the same position, and even if they did, the option labeling differs. Copying answer "B" from your neighbor gives you the wrong answer.

---

### Q: What if the edge node's SQLite database is tampered with?

**A:** Every answer submission is logged in the hash-chained audit ledger. Changing an answer in SQLite without updating the audit chain creates a detectable inconsistency. Additionally, answers are signed at submission time. Post-exam verification compares submission signatures against the audit chain.

---

### Q: Why Electron and not a web app?

**A:** The candidate terminal must operate in locked-down kiosk mode — no browser address bar, no tab switching, no desktop access, no developer tools. Electron provides OS-level window management, kiosk mode, and native hardware access (webcam, local storage) that a browser tab cannot. A Progressive Web App cannot prevent Alt-Tab, Task Manager, or screen sharing.

---

## Category: Security

### Q: What if the exam center itself is compromised (insider threat)?

**A:**
1. The center never has decryption keys before exam time
2. Packages are encrypted end-to-end — the center can store but not read them
3. Every action by center staff is logged in the tamper-evident audit chain
4. Post-exam audit can detect anomalous patterns (unusual timing, mass corrections)
5. In production: Trusted Execution Environments (TEEs) would isolate exam execution from the host OS

---

### Q: How do you handle face verification accuracy?

**A:** For the hackathon demo, we use InsightFace with a configurable similarity threshold. False rejections are handled by a supervisor override mechanism (also audit-logged). In production, this would integrate with government identity databases (Aadhaar face verification) for higher accuracy.

---

### Q: Is the system resistant to replay attacks?

**A:** Yes. QR tokens include a nonce and timestamp. They are single-use and expire after authentication. Session tokens (JWT) have short TTLs and are bound to the specific edge node. Replaying a token on a different node or after expiration fails validation.

---

## Category: Hackathon Specifics

### Q: What's implemented vs. mocked?

**A:**
| Feature | Status |
|---|---|
| Question creation + encryption | Implemented |
| Package generation + signing | Implemented |
| QR authentication | Implemented |
| Face verification | Implemented (InsightFace) |
| Spatial randomization | Implemented (NetworkX) |
| Exam execution + kiosk mode | Implemented |
| State recovery | Implemented |
| Audit hash chain | Implemented |
| Anomaly detection | Implemented (MediaPipe) |
| Satellite distribution | Mocked |
| Government ID integration | Mocked |
| HSM key management | Mocked |
| Multi-region deployment | Documented only |

---

### Q: What would you build next with more time?

**A:**
1. **Threshold cryptography** — require M-of-N key holders to decrypt (no single point of compromise)
2. **AWS Nitro Enclaves** — run exam execution in hardware-isolated secure enclaves
3. **Center risk scoring** — ML model to score centers based on historical anomaly patterns
4. **Fake leak detection** — canary questions that reveal the source of leaks

---

### Q: Why this tech stack specifically?

**A:**
- **FastAPI:** Async Python, excellent for I/O-bound exam operations, great documentation
- **PostgreSQL:** Robust, ACID-compliant, handles complex queries for admin operations
- **SQLite:** Zero-config, file-based, perfect for embedded edge deployment
- **Electron + React:** Kiosk mode + modern component UI + webcam access
- **MediaPipe:** Lightweight on-device ML, no cloud dependency
- **NetworkX:** Python graph library, ideal for adjacency modeling and coloring

---

## Related Documents

- [[JudgeNarrative]] — The full story
- [[DemoFlow]] — Live demo script
- [[ElevatorPitch]] — 30-second version
