---
name: aidd-harness
description: Audits the Claude context harness of the current repository and explains its measured loading cost and chosen-guideline findings in French. Use when the user wants to audit, reduce, or understand Claude context cost. Not for maturity assessment or automatic edits.
argument-hint: run-audit | narrate
---

# AIDD Harness

```mermaid
flowchart LR
  audit[run-audit] --> narrate[narrate]
```

## Actions

Read only the next action's file before running it.

| # | Action | Does |
| --- | --- | --- |
| 01 | `run-audit` | Publishes the bundled harness contract for the current repository. |
| 02 | `narrate` | Explains the findings without modifying the repository. |

## Transversal rules

- Audit only the repository open in the current session.
- Use the plugin's bundled binary, never a checkout binary.
- Never edit a harness file, a rule, or a machine configuration as part of this skill.
