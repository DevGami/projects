# FortisExam — Deployment Plan

> **Last Updated:** 2026-06-13

---

## 🚀 Live Hackathon Deployment Strategy

The FortisExam stack has been successfully deployed to the cloud for the hackathon presentation. The deployment leverages zero-cost, serverless infrastructure to provide a highly realistic mock of the Air-Gapped Edge Architecture.

### 1. Cloud Database & Cache
- **PostgreSQL:** Hosted on **Neon.tech** (`us-east-1`). Provides serverless, auto-scaling relational data storage.
- **Redis:** Hosted on **Upstash** (`us-east-1`). Provides serverless key-value storage for rate limiting, locking, and asynchronous task queues.

### 2. Cloud & Edge Backends (Render)
Both the Cloud Backend and the Mock Edge Backend are deployed as Docker Web Services on **Render**.
- **`fortis-cloud`:** Runs the FastAPI backend in `SERVER_MODE=cloud`. Connects to Neon (PostgreSQL) and Upstash (Redis).
- **`fortis-edge`:** Runs a second instance of the FastAPI backend in `SERVER_MODE=edge`. It mimics a local exam center by using a local, ephemeral `sqlite+aiosqlite:///./fortis.db` database.

*(Note: Render free instances spin down after 15 minutes of inactivity. Ensure you visit the backend URLs briefly before the live demo to wake them up).*

### 3. Frontends (Vercel)
The React/Vite frontends are deployed globally via **Vercel** CDN.
- **Admin Portal (`web/`):** Deployed to Vercel, pointing to the `fortis-cloud` backend. Handles exam creation, scheduling, and live proctor monitoring.
- **Candidate Kiosk (`desktop/`):** Originally an air-gapped Electron application, this has been compiled as a standard Web App for the hackathon judges. It points to the `fortis-edge` backend to mimic the local exam center experience.

---

## Pre-Demo Checklist

- [ ] "Wake up" both Render backends 5 minutes before the demo.
- [ ] Ensure Clerk allowed origins includes the Vercel Admin Portal URL.
- [ ] Create at least 1 sample exam on the Admin Portal.
- [ ] Create a sample candidate for the judges to log in with on the Kiosk.
- [ ] Run the demo script from start to finish.

---

## Related Documents

- [[EnvironmentSetup]] — Dev setup guide
- [[DeploymentArchitecture]] — Infrastructure design
- [[DemoFlow]] — Demo walkthrough
