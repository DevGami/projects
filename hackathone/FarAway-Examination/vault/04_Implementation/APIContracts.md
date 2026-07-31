# FortisExam — API Contracts

> **Last Updated:** 2026-06-08

---

## Cloud Backend API (Zone A)

Base URL: `https://api.fortisexam.local/api/v1`

### Questions

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | /questions | Create encrypted question | Admin, Expert |
| GET | /questions | List questions (metadata only) | Admin, Expert |
| GET | /questions/{id} | Get question details | Admin, Expert |
| PUT | /questions/{id} | Update question | Admin, Expert |
| DELETE | /questions/{id} | Soft-delete question | Admin |

### Exams

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | /exams | Create exam definition | Admin |
| GET | /exams | List exams | Admin |
| POST | /exams/{id}/compile | Compile exam from blueprint | Admin |
| POST | /exams/{id}/distribute | Distribute to centers | Admin |

### Packages

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | /packages/{id} | Get package metadata | Admin |
| GET | /packages/{id}/download | Download encrypted package | Center Node |
| POST | /packages/{id}/verify | Verify package integrity | Center Node |

### Audit

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | /audit/chain/{exam_id} | Get audit chain | Admin, Auditor |
| POST | /audit/verify/{exam_id} | Verify chain integrity | Admin, Auditor |

---

## Edge Server API (Zone C)

Base URL: `http://edge.local:8001/api/v1`

### Authentication

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | /auth/authenticate | Full QR + face auth | None (creates session) |
| POST | /auth/supervisor-override | Manual override | Invigilator |

### Exam

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | /exam/session/{session_id} | Get exam session (variant) | JWT |
| POST | /exam/answer | Submit answer | JWT |
| POST | /exam/submit | Submit completed exam | JWT |
| GET | /exam/recovery/{candidate_id} | Get recovery snapshot | JWT |

### Monitoring

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | /monitoring/event | Report security event | JWT |
| GET | /monitoring/events | List events (proctor) | Invigilator |

---

## Related Documents

- [[BackendDesign]] — Service architecture
- [[DatabaseDesign]] — Data models
- [[Module01_QuestionPool]] — Question API details
