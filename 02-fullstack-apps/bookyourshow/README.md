# 🎬 BookYourShow — Production-Grade Movie Booking Platform

> **🚧 Note: This project is currently in active development and is an ongoing work.**

> A fullstack movie ticket booking platform built with **15+ technologies**, featuring real-time TMDB movie data, Razorpay live payments, AI-powered chatbot, and event-driven architecture.

---

## 🚀 Quick Start

```bash
# 1. Start infrastructure (PostgreSQL, MongoDB, Redis)
docker compose up -d

# 2. Install API dependencies
cd apps/api && npm install

# 3. Run database migrations
npx prisma migrate dev --name init

# 4. Start the API server
npm run dev
```

- **API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/v1/health

---

## 🏗️ Architecture

| Service | Technology | Port |
|---------|-----------|------|
| Frontend | Next.js 15 + TypeScript + Tailwind 4 | 3000 |
| API Gateway | Express 5 + TypeScript + Prisma + Mongoose | 5000 |
| PostgreSQL | v17 (Users, Bookings, Payments) | 5432 |
| MongoDB | v8 (Movies from TMDB, Reviews, Logs) | 27017 |
| Redis | v7 (Cache, Seat Locks, Sessions) | 6379 |
| Kafka | KRaft mode (Event Bus) | 9092 |
| Notification Service | Java 21 + Spring Boot 3.4 | 8081 |
| RAG AI Chatbot | Python 3.12 + FastAPI + LangChain + Groq | 8000 |

---

## 🛠️ Tech Stack

**Frontend**: Next.js 15, React 19, TypeScript 5, Tailwind CSS 4, Lucide Icons, Framer Motion, Zustand  
**Backend**: Node.js 22, Express 5, TypeScript, Prisma, Mongoose, ioredis, Zod, Winston  
**Databases**: PostgreSQL 17, MongoDB 8, Redis 7  
**Messaging**: Apache Kafka (KRaft)  
**Payments**: Razorpay (Live — real payments)  
**Movie Data**: TMDB API v3 (real-time "Now Playing")  
**AI**: LangChain + Groq (Llama 3.3) + FAISS + Sentence Transformers  
**Microservice**: Java 21 + Spring Boot 3.4 (Notification Service)  
**DevOps**: Docker, Docker Compose, Nginx, Oracle Cloud Free Tier  

---

## 📁 Project Structure

```
bookyourshow/
├── vault/                 📂 Knowledge base (PRD, TRD, Architecture, etc.)
├── apps/
│   ├── web/               🌐 Next.js frontend
│   ├── api/               🔧 Express API gateway
│   ├── notification-service/  ☕ Java Spring Boot
│   └── rag-service/       🐍 Python FastAPI RAG
├── packages/
│   └── shared-types/      📦 Shared TypeScript types
├── scripts/               🔧 Seed data & utilities
├── infra/                 ☁️ Cloud deployment configs
├── docker-compose.yml     🐳 Infrastructure orchestration
└── .env.example           🔐 Environment template
```

---

## ⭐ Key Features

- 🎬 **Real Movie Data** — Live from TMDB API (currently playing in Indian theaters)
- 💺 **Real-Time Seat Locking** — Redis-backed, zero double-bookings
- 💳 **Real Payments** — Razorpay (UPI, Cards, Net Banking, Wallets)
- 🤖 **AI Chatbot** — Movie recommendations + booking help
- 🔒 **Production Security** — Argon2id, JWT rotation, RBAC, Helmet, rate limiting
- 📧 **Email Notifications** — Booking confirmation, payment receipts
- 📱 **Mobile-First** — Responsive design with Tailwind CSS
- 🎨 **Premium UI** — Dark glassmorphism, Lucide icons, Framer Motion animations

---

*Upgraded from a PDEU college project — 2026*
