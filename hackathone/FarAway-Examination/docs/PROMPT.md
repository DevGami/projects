# PROMPT.md

You are joining an existing software project called **FortisExam**.

FortisExam is a Zero-Trust, Edge-First examination infrastructure designed for conducting large-scale national examinations securely and reliably.

The repository contains:

* PRD.md
* TRD.md
* Architecture.md

These documents are the source of truth.

You must treat them as authoritative.

---

# PRIMARY OBJECTIVE

Before writing any application code, establish and maintain a complete project memory system using an Obsidian-compatible vault.

The vault serves as persistent context for:

* AI agents
* Human developers
* Future contributors

Documentation is considered part of the source code.

Code and documentation must always remain synchronized.

---

# EXECUTION PHASES

Execute work in the following order.

Do not skip phases.

---

# PHASE 1

Project Understanding

Read and analyze:

* PRD.md
* TRD.md
* Architecture.md

Create a concise understanding of:

* Product goals
* System architecture
* Core modules
* Technical requirements
* Demo scope
* Future scope

Store findings in:

vault/00_Project/ProjectOverview.md

---

# PHASE 2

Vault Creation

Create the following vault structure.

```text
vault/

├── 00_Project/
│   ├── ProjectOverview.md
│   ├── CurrentState.md
│   ├── Roadmap.md
│   ├── TeamAssignments.md
│   ├── Decisions.md
│   ├── JudgeNarrative.md
│   ├── DemoFlow.md
│   ├── JudgeFAQ.md
│   └── ElevatorPitch.md
│
├── 01_Product/
│   ├── PRD_Summary.md
│   ├── UserStories.md
│   ├── ProblemAnalysis.md
│   └── SuccessMetrics.md
│
├── 02_Architecture/
│   ├── ArchitectureSummary.md
│   ├── SecurityModel.md
│   ├── DataFlow.md
│   ├── ThreatModel.md
│   ├── ServiceBoundaries.md
│   ├── DeploymentArchitecture.md
│   └── ADRs/
│
├── 03_Modules/
│   ├── Module01_QuestionPool.md
│   ├── Module02_CryptoDelivery.md
│   ├── Module03_Authentication.md
│   ├── Module04_GraphRandomization.md
│   ├── Module05_StateRecovery.md
│   ├── Module06_AnomalyDetection.md
│   └── Module07_AuditLedger.md
│
├── 04_Implementation/
│   ├── RepositoryStructure.md
│   ├── BackendDesign.md
│   ├── FrontendDesign.md
│   ├── DatabaseDesign.md
│   ├── APIContracts.md
│   ├── EnvironmentSetup.md
│   ├── DeploymentPlan.md
│   └── CodingStandards.md
│
├── 05_Development/
│   ├── SprintBoard.md
│   ├── ActiveTasks.md
│   ├── KnownIssues.md
│   ├── Blockers.md
│   ├── TechnicalDebt.md
│   └── Changelog.md
│
├── 06_Testing/
│   ├── TestPlan.md
│   ├── TestCases.md
│   ├── SecurityTests.md
│   ├── RegressionTests.md
│   ├── PerformanceTests.md
│   └── BugTracker.md
│
├── 07_AI_Context/
│   ├── AIInstructions.md
│   ├── DocumentationStandards.md
│   ├── ContextSummary.md
│   ├── PromptPatterns.md
│   └── AIHandoffTemplate.md
│
└── 99_Archive/
```

Populate every file with meaningful initial content.

Do not leave placeholder files.

---

# PHASE 3

Generate Implementation Plan

Analyze all project requirements.

Generate:

vault/00_Project/Roadmap.md

The roadmap must include:

* Development phases
* Module dependencies
* Critical path
* Risk areas
* Demo priorities
* Hackathon scope
* Production scope

Generate a task breakdown suitable for a team of multiple developers.

---

# PHASE 4

Architecture Validation

Review architecture and identify:

* Over-engineering
* Missing modules
* Security gaps
* Demo risks
* Scalability risks

Store findings in:

vault/02_Architecture/ThreatModel.md

and

vault/00_Project/Decisions.md

---

# PHASE 5

Repository Planning

Design a repository structure.

Generate:

vault/04_Implementation/RepositoryStructure.md

Must include:

* backend
* frontend
* desktop
* shared
* infrastructure
* docs
* tests

Define responsibilities for every directory.

---

# PHASE 6

Development Planning

Generate:

SprintBoard.md

ActiveTasks.md

TeamAssignments.md

Break work into:

* Backend
* Frontend
* Desktop
* Security
* AI/ML
* Documentation

Estimate dependencies.

---

# PHASE 7

Testing Planning

Generate:

* TestPlan.md
* SecurityTests.md
* PerformanceTests.md
* RegressionTests.md

Cover:

* Authentication
* Encryption
* Randomization
* Recovery
* Audit logging
* Monitoring

---

# PHASE 8

Judge Preparation

Generate:

JudgeNarrative.md

DemoFlow.md

JudgeFAQ.md

ElevatorPitch.md

These documents must maintain a consistent story.

Core positioning:

FortisExam is not an AI proctoring tool.

FortisExam is a Zero-Trust Examination Infrastructure.

Its three pillars are:

1. Leak Prevention
2. Cheat Prevention
3. Cryptographic Accountability

---

# AI MEMORY RULES

Before starting any task read:

* vault/00_Project/CurrentState.md
* vault/00_Project/Decisions.md
* vault/05_Development/ActiveTasks.md
* vault/07_AI_Context/ContextSummary.md

---

# DOCUMENTATION RULES

If code changes:

Update documentation.

If architecture changes:

Create or update an ADR.

If a bug is fixed:

Update BugTracker.md.

Add regression tests.

If a new risk is discovered:

Update ThreatModel.md.

If implementation status changes:

Update CurrentState.md.

---

# ADR RULES

Every architectural decision must be recorded.

Format:

ADR-XXX-DecisionName.md

Include:

* Context
* Decision
* Alternatives
* Consequences

Store in:

vault/02_Architecture/ADRs/

---

# BUG RULES

Every bug must include:

* ID
* Description
* Severity
* Reproduction Steps
* Root Cause
* Fix
* Regression Test

Store in:

vault/06_Testing/BugTracker.md

---

# COMPLETION REPORT

At the end of every task output:

## Files Created

## Files Modified

## Decisions Made

## Risks Identified

## Remaining Work

## Recommended Next Task

Never finish work without updating the vault.

The vault is the persistent memory layer of the project.

Maintaining vault accuracy is a mandatory requirement.
