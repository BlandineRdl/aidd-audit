---
paths:
  - "src/cli/**/*.ts"
  - "plugins/**/*.md"
---

# CLI And Contract Decisions

`aidd_docs/memory/cli.md` records the command surface, the exit-code taxonomy, the rendering rules
and what the narration layer may never claim. Read it before changing any of them.

## Read it before

- Touching a renderer, a wording, or a colour.
- Changing an exit code, a stream, or the order two bad inputs are checked in.
- Adding a flag, or changing which collectors a subject gets.
- Editing a plugin skill that narrates the published contract.

## What you get wrong without it

- The exit code answers whether the run happened, never how mature the subject is. Splitting it
  finer publishes a promise no caller asked for.
- Prose distinctions that look like phrasing and are not: a missing observation against an
  observed empty set, a practice gap against an evidence gap, `proven` against `demonstrated`.
- That stdout must stay byte-identical across machines, which is why the subject path is echoed
  rather than resolved.
