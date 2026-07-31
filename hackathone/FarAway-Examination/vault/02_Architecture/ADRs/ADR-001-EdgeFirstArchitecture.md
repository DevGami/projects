# ADR-001: Edge-First Architecture

> **Date:** 2026-06-08
> **Status:** Accepted
> **Deciders:** Architecture Team

---

## Context

FortisExam must conduct exams at 10,000+ centers with unreliable internet connectivity. Traditional cloud-first designs create real-time dependencies that fail under network outages.

## Decision

Adopt an edge-first architecture where each exam center operates as an independent, self-sufficient node during exam execution. Cloud is used only for pre-exam preparation and post-exam aggregation.

## Alternatives Considered

1. **Cloud-first with offline fallback** — Rejected: fallback mode is a second-class experience with incomplete feature coverage
2. **Hybrid real-time sync** — Rejected: creates network dependency during the most critical phase

## Consequences

- ✅ Centers operate independently during exams
- ✅ No real-time cloud bottleneck
- ✅ Network outages don't cancel exams
- ⚠️ Data aggregation is eventually consistent
- ⚠️ Edge nodes require provisioning and security hardening
