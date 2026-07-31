# FortisExam — Coding Standards

> **Last Updated:** 2026-06-08

---

## Python (Backend & Edge)

- **Version:** 3.11+
- **Style:** PEP 8, enforced by `ruff`
- **Type Hints:** Required for all function signatures
- **Docstrings:** Required for public functions (Google style)
- **Testing:** pytest, minimum 80% coverage
- **Async:** Use async/await for I/O-bound operations
- **Imports:** Absolute imports, sorted by isort

---

## TypeScript (Frontend & Desktop)

- **Version:** TypeScript 5+
- **Style:** ESLint with Prettier
- **Components:** Functional components with hooks
- **Types:** No `any` type — use proper type definitions
- **Testing:** Jest + React Testing Library

---

## General

- **Git:** Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`)
- **Branches:** `main`, `dev`, `feature/*`, `fix/*`
- **Code Review:** All PRs require review
- **Documentation:** Update vault on any architectural change
- **Security:** Never commit secrets, keys, or credentials

---

## Related Documents

- [[RepositoryStructure]] — File organization
- [[BackendDesign]] — Backend patterns
- [[FrontendDesign]] — Frontend patterns
