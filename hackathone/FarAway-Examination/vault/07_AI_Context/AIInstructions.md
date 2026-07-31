# FortisExam — AI Agent Instructions

> **Last Updated:** 2026-06-08

---

## Before Starting Any Task

**ALWAYS read these files first:**
1. `vault/00_Project/CurrentState.md` — What is the project's current status?
2. `vault/00_Project/Decisions.md` — What decisions have been made?
3. `vault/05_Development/ActiveTasks.md` — What work is in progress?
4. `vault/07_AI_Context/ContextSummary.md` — What does the AI agent need to know?

---

## Core Rules

### 1. Documentation Is Source Code
Every code change must be accompanied by documentation updates. Code without documentation is incomplete.

### 2. Vault Is Persistent Memory
The vault is your memory between sessions. If you discover something important, write it down. If you make a decision, record it. If you find a bug, log it.

### 3. Architecture Decisions Require ADRs
Any change to the architecture must be recorded in `vault/02_Architecture/ADRs/`. Use the format: `ADR-XXX-DecisionName.md`.

### 4. Bugs Require Full Documentation
Every bug must include: ID, description, severity, reproduction steps, root cause, fix, and regression test.

### 5. Threats Require Threat Model Updates
If you discover a new security risk, update `vault/02_Architecture/ThreatModel.md`.

### 6. State Changes Require Status Updates
If you change the implementation status of any module, update `vault/00_Project/CurrentState.md`.

---

## When Writing Code

1. Follow [[CodingStandards]]
2. Check [[RepositoryStructure]] for where files go
3. Use the `shared/crypto/` library for all cryptographic operations
4. Use the `shared/audit/` library for all audit logging
5. Use the `shared/graph/` library for all graph operations
6. Write unit tests alongside code
7. Update [[ActiveTasks]] with progress

---

## When Fixing Bugs

1. Record the bug in [[BugTracker]]
2. Write a regression test
3. Update [[RegressionTests]]
4. Fix the bug
5. Verify the regression test passes
6. Update [[Changelog]]

---

## When Making Architecture Changes

1. Create an ADR in `vault/02_Architecture/ADRs/`
2. Update [[Decisions]]
3. Update affected module documentation in `vault/03_Modules/`
4. Update [[CurrentState]]

---

## Project Identity

**FortisExam is NOT an AI proctoring tool.**

FortisExam is a **Zero-Trust Examination Infrastructure** with three pillars:
1. Leak Prevention (cryptographic question protection)
2. Cheat Prevention (spatial graph randomization)
3. Cryptographic Accountability (hash-chained audit ledger)

Always maintain this positioning in documentation and code comments.

---

## Related Documents

- [[ContextSummary]] — Quick context for AI agents
- [[DocumentationStandards]] — Documentation conventions
- [[PromptPatterns]] — Useful prompt patterns
- [[AIHandoffTemplate]] — Session handoff format
