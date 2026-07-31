# FortisExam — Prompt Patterns

> **Last Updated:** 2026-06-08

---

## Useful Prompts for AI Agents Working on FortisExam

### Starting a New Session
```
Read vault/00_Project/CurrentState.md, vault/00_Project/Decisions.md,
vault/05_Development/ActiveTasks.md, and vault/07_AI_Context/ContextSummary.md.
Then resume work on the next active task.
```

### Implementing a Module
```
Read vault/03_Modules/Module0X_[Name].md for the full specification.
Read vault/04_Implementation/RepositoryStructure.md for file locations.
Read vault/04_Implementation/CodingStandards.md for conventions.
Implement the module following the specification.
Write unit tests. Update ActiveTasks.md and CurrentState.md.
```

### Fixing a Bug
```
Read vault/06_Testing/BugTracker.md for the bug report.
Investigate the root cause. Write a regression test first.
Fix the bug. Verify the test passes.
Update BugTracker.md with root cause and fix.
Update Changelog.md.
```

### Adding a Feature
```
Read vault/00_Project/Decisions.md to check for relevant decisions.
Read the relevant module spec in vault/03_Modules/.
Implement the feature following existing patterns.
Write tests. Update documentation. Update ActiveTasks.md.
```

### Architecture Change
```
Before making any change, create an ADR in vault/02_Architecture/ADRs/.
Document: Context, Decision, Alternatives, Consequences.
Update vault/00_Project/Decisions.md.
Then implement the change.
```

---

## Anti-Patterns to Avoid

1. **Don't skip vault reads.** Always read current state before coding.
2. **Don't write code without tests.** Every feature needs unit tests.
3. **Don't change architecture without ADRs.** Record every decision.
4. **Don't use the word "proctoring."** FortisExam is exam infrastructure.
5. **Don't hardcode secrets.** Use environment variables.

---

## Related Documents

- [[AIInstructions]] — Full behavior rules
- [[ContextSummary]] — Quick project context
- [[AIHandoffTemplate]] — Session handoff format
