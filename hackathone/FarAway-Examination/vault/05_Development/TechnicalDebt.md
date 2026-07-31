# FortisExam — Technical Debt

> **Last Updated:** 2026-06-08

---

## Current Debt Items

No technical debt yet (pre-development phase). This document will track shortcuts taken during the hackathon that need production-level resolution.

---

## Anticipated Debt (Hackathon Shortcuts)

| ID | Description | Impact | Production Resolution |
|---|---|---|---|
| TD-001 | RSA keys stored as local files | Security risk in production | Migrate to AWS KMS or HSM |
| TD-002 | Single Docker Compose for all services | Not production-scalable | Split into K8s microservices |
| TD-003 | SQLite for edge DB | Single-writer limitation | Evaluate alternatives for high-concurrency centers |
| TD-004 | Face verification threshold hardcoded | May not work for all conditions | Make configurable per center, add admin tuning UI |
| TD-005 | No rate limiting on APIs | Vulnerable to abuse | Add FastAPI middleware rate limiting |
| TD-006 | No CORS configuration | Cross-origin issues | Configure per environment |
| TD-007 | Demo seed data hardcoded | Not maintainable | Create proper data management admin flows |

---

## Related Documents

- [[KnownIssues]] — Active issues
- [[Decisions]] — Why these shortcuts were taken
- [[Roadmap]] — When to address debt
