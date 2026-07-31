# FortisExam — User Stories

> **Last Updated:** 2026-06-08

---

## Examination Authority

### US-01: Create Secure Questions
**As an** examination authority,
**I want to** create and store questions with automatic encryption,
**So that** question content is never stored in plaintext and cannot be leaked from the database.

**Acceptance Criteria:**
- Questions are encrypted immediately on save
- Database stores only ciphertext
- Decryption requires separate key access
- Version history is maintained

---

### US-02: Compile Examination
**As an** examination authority,
**I want to** compile an exam from the question pool using a configurable blueprint,
**So that** the exam meets subject and difficulty distribution requirements.

**Acceptance Criteria:**
- Blueprint specifies subject mix and difficulty distribution
- Questions are randomly selected per blueprint
- Compilation produces an encrypted package
- Package includes signed manifest

---

### US-03: Distribute Exam Package
**As an** examination authority,
**I want to** distribute encrypted exam packages to centers before exam day,
**So that** packages are pre-positioned but unusable without decryption authorization.

**Acceptance Criteria:**
- Packages delivered to centers
- Packages are encrypted and signed
- Decryption keys delivered separately, time-locked
- Center can verify package integrity

---

### US-04: Review Audit Trail
**As an** examination authority,
**I want to** review a tamper-evident audit trail of all exam operations,
**So that** I can investigate incidents and prove accountability.

**Acceptance Criteria:**
- All critical events are logged
- Events are hash-chained (previous hash → current hash)
- Chain integrity is verifiable
- Trail is exportable

---

## Center Administrator

### US-05: Set Up Exam Center
**As a** center administrator,
**I want to** configure the seating layout and receive exam packages,
**So that** the center is prepared for exam day.

**Acceptance Criteria:**
- Seating layout is configurable (rows × columns)
- Exam package is received and verified
- Edge server is operational
- Candidate list is loaded

---

### US-06: Monitor Exam Progress
**As a** center administrator,
**I want to** view real-time exam progress and alerts on a dashboard,
**So that** I can manage incidents during the exam.

**Acceptance Criteria:**
- Dashboard shows candidate status (authenticated, in-progress, submitted)
- Anomaly alerts displayed in real-time
- Center-level statistics available

---

## Invigilator

### US-07: Verify Candidate Identity
**As an** invigilator,
**I want to** verify candidate identity using QR code and face matching,
**So that** impersonation is prevented.

**Acceptance Criteria:**
- QR code scanned and signature validated
- Face captured and compared against stored embedding
- Match/mismatch result displayed
- Supervisor override available for edge cases

---

### US-08: Report Incident
**As an** invigilator,
**I want to** report suspicious incidents during the exam,
**So that** they are recorded in the audit trail.

**Acceptance Criteria:**
- Incident can be logged with description and severity
- Incident is added to the audit chain
- Center admin is notified

---

## Candidate

### US-09: Authenticate and Start Exam
**As a** candidate,
**I want to** scan my QR code and verify my face to start the exam,
**So that** I can begin the exam quickly and securely.

**Acceptance Criteria:**
- Authentication completes in < 5 seconds
- Session is created after successful verification
- Exam UI loads in kiosk mode
- Timer starts

---

### US-10: Take Exam with Auto-Save
**As a** candidate,
**I want to** answer questions with automatic saving,
**So that** I don't lose my work if the system fails.

**Acceptance Criteria:**
- Questions are displayed one at a time with navigation
- Answers are auto-saved on selection (< 100ms)
- Progress indicator shows answered/unanswered
- Timer is visible

---

### US-11: Recover After Failure
**As a** candidate,
**I want to** resume my exam after a device failure,
**So that** I don't lose time or answers.

**Acceptance Criteria:**
- Recovery completes in < 60 seconds
- All previous answers are restored
- Timer resumes from the correct position
- No re-authentication penalty on timer

---

### US-12: Submit Exam
**As a** candidate,
**I want to** submit my exam and receive confirmation,
**So that** I know my answers are recorded.

**Acceptance Criteria:**
- Summary of answers displayed before submission
- Submission is signed and timestamped
- Confirmation displayed
- Submission logged in audit chain

---

## Auditor

### US-13: Verify Exam Integrity
**As an** auditor,
**I want to** verify the integrity of an exam session's audit trail,
**So that** I can confirm no tampering occurred.

**Acceptance Criteria:**
- Audit chain is loaded for a given exam/center
- Hash chain verification runs automatically
- Broken links are flagged
- Report is generated

---

### US-14: Investigate Anomalies
**As an** auditor,
**I want to** review anomaly alerts and associated evidence,
**So that** I can investigate potential cheating or fraud.

**Acceptance Criteria:**
- Anomaly events are filterable by type and severity
- Timestamps and candidate info are available
- Evidence (screenshots, event logs) is accessible

---

## Related Documents

- [[PRD_Summary]] — Requirements overview
- [[ProblemAnalysis]] — Problem breakdown
- [[SuccessMetrics]] — How we measure success
