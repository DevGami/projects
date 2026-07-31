# FortisExam — Known Issues

> **Last Updated:** 2026-06-08

---

## Active Issues

No code-level issues yet (pre-development phase).

---

## Anticipated Issues

| ID | Description | Severity | Module | Mitigation |
|---|---|---|---|---|
| KI-001 | InsightFace model download may fail in offline environments | Medium | Module 03 | Pre-download model files, bundle with deployment |
| KI-002 | MediaPipe WASM may have compatibility issues with Electron | Medium | Module 06 | Test early, have fallback to OpenCV DNN |
| KI-003 | SQLite WAL mode behavior differs on Windows vs Linux | Low | Module 05 | Test recovery on target OS |
| KI-004 | Electron kiosk mode bypass possible with keyboard shortcuts | Medium | Desktop | Disable all shortcuts in main process |
| KI-005 | RSA-4096 operations may be slow for batch encryption | Low | Module 01 | Use RSA only for key wrapping, AES for content |

---

## Related Documents

- [[BugTracker]] — Bug reports with reproduction steps
- [[TechnicalDebt]] — Technical debt items
- [[Blockers]] — Active blockers
