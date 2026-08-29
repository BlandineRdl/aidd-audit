---
name: task
description: Task tracking system to ensure all tasks are categorized and addressed
---

# Task [size and parallelism UNKNOWN on the AIDD repository]

`aidd-audit assess .` reports `harness` CONFIRMED and `size`, `intervention`,
`parallelism` UNKNOWN. `live-repository` ran and answered, so the collector is
not silent — only its Git-derived half is. Five hypotheses, one validated.

## Validation

- [x] H1 — minimum-sample gates. `readSizeBucket` returns `null` below
      `MINIMUM_DELIVERED_CHANGES = 5`; `readParallelism` returns `null` below
      `MINIMUM_ACTIVE_DAYS = 5`. This repository has 3 merges and 3 active
      calendar days. **VALIDATED — root cause.**
- [x] H2 — subject not a repository root, `collect` returns `[]` early.
      **INVALIDATED**: harness was observed, so `isRepositoryRoot` passed.
- [x] H3 — shallow or unborn history, `UNRECOVERABLE`.
      **INVALIDATED**: `git rev-parse --is-shallow-repository` = `false`,
      30 first-parent commits.
- [x] H4 — no merge commit at all (squash or rebase history).
      **INVALIDATED**: 3 merges on the first-parent walk.
- [x] H5 — scale mismatch drops the observation in the adapter.
      **INVALIDATED**: `aidd.yml` declares `size` ordinal with `S M L XL` and
      `parallelism` numeric, exactly what `collectGitDerived` requires.

## Notes

`intervention` is a separate, documented ceiling: `LiveRepositoryEvidenceCollector`
declares it in `supportedAxes` and never emits it. No forge, no observation.

## Decision

Human call, 2026-08-29: **no code change.** The floors are not lowered so this
repository classifies — that would fit the measure to the desired result. What
was owed was the rationale, absent from all three places the rule appeared.
Written at the declaration in `git-history.ts`, and the ceiling distinction
recorded in `aidd_docs/memory/cli.md`: the sample floors expire with time,
`intervention` does not.
