# FortisExam — Documentation Standards

> **Last Updated:** 2026-06-08

---

## File Naming

- Use PascalCase for vault files: `ProjectOverview.md`, `TestPlan.md`
- Use ADR format for decisions: `ADR-XXX-DecisionName.md`
- Use BUG format for bugs: `BUG-XXX` in BugTracker.md

---

## File Structure

Every vault document must include:

1. **Title** — H1 heading with document name
2. **Metadata** — Last updated date, status if applicable
3. **Content** — Meaningful, substantive content (no placeholders)
4. **Related Documents** — Links to related vault pages

---

## Obsidian Compatibility

- Use `[[WikiLinks]]` for internal vault cross-references
- Use standard Markdown for everything else
- Use tables for structured data
- Use code blocks for technical content
- Use horizontal rules (`---`) to separate sections

---

## Update Rules

| Trigger | Action |
|---|---|
| Code change | Update relevant module docs |
| Architecture change | Create ADR, update Decisions.md |
| Bug fixed | Update BugTracker, add regression test |
| New risk discovered | Update ThreatModel |
| Status change | Update CurrentState |
| Any change | Update Changelog |

---

## Related Documents

- [[AIInstructions]] — AI agent behavior rules
- [[CodingStandards]] — Code-level standards
