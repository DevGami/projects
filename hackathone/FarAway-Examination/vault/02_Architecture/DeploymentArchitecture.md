# FortisExam — Deployment Architecture

> **Last Updated:** 2026-06-08

---

## Hackathon Deployment

### Cloud Stack (Docker Compose)

```yaml
services:
  backend:        # FastAPI — Admin API, Question Service, Compilation, Distribution
  postgres:       # PostgreSQL 15 — Cloud database
  redis-cloud:    # Redis 7 — Cloud cache & session store

  edge-server:    # FastAPI — Edge API, Auth, Exam, Recovery, Monitoring
  redis-edge:     # Redis 7 — Edge session cache
  # SQLite runs embedded within edge-server (file-based)
```

**Networking:**
- Cloud services on `fortis-cloud` Docker network
- Edge services on `fortis-edge` Docker network
- Distribution bridge between networks (simulates WAN)

### Candidate Terminal
- **Electron app** installed natively on demo machine
- Connects to `edge-server` on local network
- No Docker container (needs webcam access, kiosk mode)

---

## Production Deployment (Target)

### Cloud Tier
| Component | Technology | Purpose |
|---|---|---|
| API Gateway | AWS API Gateway / Nginx | Rate limiting, auth, routing |
| Backend Services | ECS Fargate / K8s | FastAPI microservices |
| Database | RDS PostgreSQL (Multi-AZ) | ACID-compliant storage |
| Cache | ElastiCache Redis | Session management, caching |
| Object Store | S3 | Encrypted package storage |
| Secrets | AWS KMS / Secrets Manager | Key management |
| Monitoring | CloudWatch + Prometheus | Infrastructure monitoring |

### Edge Tier (Per Center)
| Component | Technology | Purpose |
|---|---|---|
| Edge Server | Docker on local hardware | FastAPI edge services |
| Local DB | SQLite (WAL mode) | Persistent exam data |
| Local Cache | Redis (Docker) | Session state |
| Candidate Terminals | Electron kiosk app | Exam interface (30+ per center) |

### Candidate Terminal
| Component | Technology | Purpose |
|---|---|---|
| Runtime | Electron | Desktop kiosk environment |
| UI | React + TypeScript | Exam interface |
| Camera | WebRTC / Electron media | Face capture + monitoring |
| Storage | IndexedDB / IPC to SQLite | Client-side answer cache |

---

## Environment Configuration

| Environment | Cloud DB | Edge DB | Redis | Notes |
|---|---|---|---|---|
| Development | SQLite (mock) | SQLite | In-memory mock | Fast iteration |
| Testing | PostgreSQL (Docker) | SQLite | Redis (Docker) | CI/CD pipeline |
| Demo (Hackathon) | PostgreSQL (Docker) | SQLite | Redis (Docker) | Single machine |
| Production | RDS PostgreSQL | SQLite | ElastiCache | Multi-center |

---

## Related Documents

- [[EnvironmentSetup]] — Development environment setup guide
- [[DeploymentPlan]] — Deployment procedures
- [[ArchitectureSummary]] — Architecture overview
