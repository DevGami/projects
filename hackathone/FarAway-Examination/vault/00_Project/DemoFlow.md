# FortisExam — Demo Flow

> **Last Updated:** 2026-06-08
> **Estimated Demo Time:** 8-10 minutes

---

## Pre-Demo Setup

- Cloud backend running (Docker Compose)
- Edge server running at simulated center
- Electron kiosk app installed on demo machine
- Pre-loaded: 20 sample questions, 2 exam blueprints, 6 candidate records
- Seating layout: 3×2 grid (6 seats) configured

---

## Act 1: The Paper That Can't Leak (2 min)

**Story:** "Before the exam, questions must be created and secured. Let's show how FortisExam makes paper leaks mathematically impossible."

### Steps:

1. **Admin Portal** → Create 3 sample questions
   - Show: question content visible only during authoring
   - Show: on save, content is immediately encrypted (AES-256-GCM)
   - Show: database stores only ciphertext — even DB admin can't read questions

2. **Compile Exam** → Generate exam package
   - Show: blueprint selection (subject, difficulty distribution)
   - Show: compilation produces an encrypted, signed package
   - Show: package hash displayed — integrity verifiable

3. **Distribute Package** → Send to simulated center
   - Show: package transferred to edge node
   - Show: decryption key NOT included — sent separately, time-locked
   - **Key Talking Point:** "Right now, this package is useless. Even if intercepted, it's unreadable."

---

## Act 2: The Candidate Who Can't Cheat (3 min)

**Story:** "On exam day, every candidate must prove who they are, and copying is made useless."

### Steps:

4. **Candidate Arrives** → Scan QR code
   - Show: QR token is cryptographically signed
   - Show: signature validation on edge server
   - Show: invalid/tampered QR is rejected

5. **Face Verification** → Capture & compare
   - Show: webcam captures face
   - Show: face embedding compared against stored embedding
   - Show: match score displayed, session created
   - **Key Talking Point:** "Dual-factor auth: something you have (QR) + something you are (face)."

6. **Start Exam** → Show spatial randomization
   - Show: two adjacent seats side-by-side on screen
   - Show: Seat A and Seat B have different question orders AND option orders
   - Show: the adjacency graph and color assignment
   - **Key Talking Point:** "Even if they could see each other's screens, the answers don't match."

---

## Act 3: The Exam That Can't Fail (2 min)

**Story:** "What happens when the power goes out mid-exam? Nothing. The exam continues."

### Steps:

7. **Take Exam** → Answer 3-4 questions
   - Show: clean kiosk mode UI (no browser chrome, no desktop access)
   - Show: timer counting down
   - Show: each answer auto-saved to SQLite immediately

8. **Simulate Crash** → Kill the Electron process
   - Show: application force-closed
   - Show: restart application
   - Show: candidate re-authenticates (face verify)
   - Show: all answers restored, timer resumed from correct position
   - **Key Talking Point:** "Recovery took less than 60 seconds. Zero answers lost."

---

## Act 4: The Record That Can't Be Altered (1-2 min)

**Story:** "Every single action — from question creation to answer submission — is recorded in a tamper-evident ledger."

### Steps:

9. **Show Audit Trail** → View the hash chain
   - Show: list of events with timestamps
   - Show: each event contains `previousHash` → `currentHash` chain
   - Show: verify chain integrity (all hashes match)

10. **Tamper Demonstration** → Attempt to modify an event
    - Show: change one field in a historical event
    - Show: hash verification fails — chain broken
    - **Key Talking Point:** "Any tampering is mathematically detectable. This is accountability you can prove in court."

---

## Act 5: The AI That Watches (1 min)

**Story:** "While the exam runs, edge AI monitors for suspicious behavior — without any cloud connection."

### Steps:

11. **Show Monitoring** → Trigger anomaly
    - Show: normal exam session (single face, looking at screen)
    - Show: second person enters camera frame → alert generated
    - Show: candidate looks away repeatedly → gaze deviation alert
    - **Key Talking Point:** "This runs entirely on-device. No cloud, no internet, no privacy concerns."

---

## Closing Statement (30 sec)

> "FortisExam demonstrates that national-scale examinations can be conducted with mathematical guarantees of security. Zero Trust, Edge-First, Cryptographically Accountable. This is not a prototype for proctoring — this is infrastructure for trust."

---

## Backup Plans

| Failure | Mitigation |
|---|---|
| Face verify fails live | Switch to simulated mode (pre-loaded embeddings) |
| Electron crashes unexpectedly | That IS the demo — show recovery |
| Network issues | Everything runs offline — this is a feature |
| Time pressure | Skip Act 5 (monitoring), focus on Acts 1-4 |

---

## Related Documents

- [[JudgeNarrative]] — The story behind the demo
- [[JudgeFAQ]] — Anticipated judge questions
- [[ElevatorPitch]] — 30-second version
