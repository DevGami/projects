# FortisExam — Success Metrics

> **Last Updated:** 2026-06-08

---

## Security Metrics

| Metric | Target | Measurement Method |
|---|---|---|
| Successful paper leaks | **Zero** | Audit trail review, no plaintext questions accessible before exam start |
| Unauthorized question access | **Zero** | Database stores only ciphertext; encryption key access logged |
| Unauthorized result modification | **Zero** | Hash chain integrity verification detects any post-submission change |
| Authentication bypass | **Zero** | All exam sessions require valid QR + face match |

---

## Operational Metrics

| Metric | Target | Measurement Method |
|---|---|---|
| Candidate authentication success rate | **≥ 95%** | Successful authentications / total attempts |
| Answer submission success rate | **≥ 99%** | Successful saves / total answer events |
| Device failure recovery time | **< 60 seconds** | Time from restart to full session restoration |
| Exam completion rate | **≥ 99.9%** | Successfully submitted exams / total started exams |

---

## Performance Metrics

| Metric | Target | Measurement Method |
|---|---|---|
| Authentication latency | **< 5 seconds** | QR scan to session creation |
| Question load time | **< 2 seconds** | Request to rendered question |
| Answer save latency | **< 100 ms** | Selection to confirmed persistence |
| Monitoring detection latency | **< 2 seconds** | Anomaly event to alert generation |

---

## Examination Integrity Metrics

| Metric | Target | Measurement Method |
|---|---|---|
| Copying incidents (adjacent seat correlation) | **Measurably reduced** | Statistical analysis of answer patterns between adjacent seats |
| Center-level fraud indicators | **Measurably reduced** | Anomaly scoring per center vs. historical baseline |
| Audit trail completeness | **100%** | Every critical event has a corresponding audit entry |
| Audit chain integrity | **100%** | All hash chains verify without broken links |

---

## Hackathon Demo Metrics

| Metric | Target |
|---|---|
| Demo completes end-to-end | Yes |
| All 8 demo flows functional | Yes |
| Recovery demo succeeds live | Yes |
| Audit tamper detection visible | Yes |
| Spatial randomization visually distinct | Yes |

---

## Related Documents

- [[PRD_Summary]] — Requirements driving these metrics
- [[TestPlan]] — How we verify these metrics
- [[ProblemAnalysis]] — Problems these metrics address
