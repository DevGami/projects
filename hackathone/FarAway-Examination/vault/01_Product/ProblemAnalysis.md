# FortisExam — Problem Analysis

> **Last Updated:** 2026-06-08

---

## Root Cause Analysis

### Why Do National Exams Fail?

The examination ecosystem in India suffers from systemic failures rooted in **misplaced trust assumptions**.

---

## Failure Mode 1: Paper Leaks

**What happens:** Question papers are accessed by unauthorized individuals before exam start, distributed via messaging apps, and sold to candidates.

**Root Cause Chain:**
1. Questions are stored in plaintext in databases
2. Multiple administrators have access to question banks
3. Exam packages are generated and distributed in decryptable form well before exam day
4. No cryptographic separation between content and access

**FortisExam Solution:**
- Questions encrypted at creation (AES-256-GCM)
- Decryption keys delivered separately, time-locked to exam start
- No single person can access plaintext questions
- Package is useless without the time-locked key

---

## Failure Mode 2: Candidate Impersonation

**What happens:** Proxy candidates sit for exams on behalf of registered candidates using forged identity documents.

**Root Cause Chain:**
1. Manual identity verification by invigilators is unreliable
2. Photo ID matching is subjective and error-prone
3. No biometric verification at exam terminals
4. No binding between authenticated identity and exam session

**FortisExam Solution:**
- Dual-factor authentication: cryptographic QR token + face verification
- Face embedding comparison against pre-stored data
- Session is cryptographically bound to authenticated identity
- Supervisor override is audit-logged (accountability for exceptions)

---

## Failure Mode 3: Copying Between Candidates

**What happens:** Adjacent candidates view each other's screens or answer sheets and copy responses.

**Root Cause Chain:**
1. All candidates in a hall receive the same question order
2. All candidates see the same option labeling
3. Physical barriers (partitions) are inadequate
4. Random shuffling doesn't guarantee neighbor differentiation

**FortisExam Solution:**
- Seating layout modeled as an adjacency graph
- Graph coloring assigns distinct variants to adjacent seats
- Both question order AND option order differ between neighbors
- Copying answer "B" from a neighbor gives the wrong answer

---

## Failure Mode 4: Network-Dependent Exam Execution

**What happens:** Internet outages during exam time cause exam cancellation or delays, affecting millions of candidates.

**Root Cause Chain:**
1. Exam systems rely on cloud infrastructure during exam execution
2. Real-time connectivity assumed for question delivery, answer saving, authentication
3. India's internet infrastructure is unreliable in many regions
4. Fallback mechanisms are poorly tested or absent

**FortisExam Solution:**
- Edge-first architecture: exam execution is fully offline
- Exam packages pre-distributed, decryption keys pre-positioned
- All authentication, answering, and saving happen on local edge node
- No internet required from exam start to exam end

---

## Failure Mode 5: Lack of Accountability

**What happens:** After irregularities are reported, it's difficult to prove what happened, when, and by whom. Investigations are inconclusive.

**Root Cause Chain:**
1. Standard logging is mutable — logs can be altered or deleted
2. No cryptographic linking between events
3. Timestamps can be spoofed
4. No verifiable chain of custody for exam operations

**FortisExam Solution:**
- Hash-chained audit ledger: each event includes the hash of the previous event
- Chain is cryptographically verifiable end-to-end
- Any tampering breaks the chain and is detectable
- Every action (question creation, authentication, answer, submission) is logged

---

## Failure Mode 6: Infrastructure Overload

**What happens:** Cloud infrastructure buckles under the load of millions of simultaneous exam sessions, causing timeouts and failures.

**Root Cause Chain:**
1. Centralized architecture requires real-time cloud capacity for all candidates
2. Peak load occurs simultaneously (same exam start time nationwide)
3. Scaling cloud infrastructure for a 3-hour peak is expensive and wasteful
4. Auto-scaling has warm-up delays

**FortisExam Solution:**
- Edge computing eliminates real-time cloud load during exams
- Cloud is used only for pre-exam preparation (asynchronous, schedulable)
- Each center is an independent compute node
- Post-exam data aggregation is eventual and off-peak

---

## Problem Impact Matrix

| Failure Mode | Frequency | Candidates Affected | Public Trust Impact |
|---|---|---|---|
| Paper Leaks | Multiple per year | Millions | Catastrophic |
| Impersonation | Ongoing | Thousands | High |
| Copying | Every exam | Unknown (underreported) | Medium |
| Network Failures | Occasional | Hundreds of thousands | High |
| Accountability Gaps | Every investigation | System-wide | Catastrophic |
| Infrastructure Overload | Peak events | Millions | High |

---

## Related Documents

- [[PRD_Summary]] — Product requirements
- [[UserStories]] — How each user is affected
- [[SuccessMetrics]] — How we measure improvement
