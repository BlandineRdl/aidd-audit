---
name: audit
description: Codebase audit report — architecture pillar (re-run after remediation)
argument-hint: N/A
---

# Codebase Audit: architecture — aidd-audit

`ports/` is domain in all three rules that say so and has three sentinels proving it; the cancellation seam described in memory now exists in code.

- **Date**: 2026_08_29 (re-run)
- **Scope**: `src/`, `.dependency-cruiser.cjs`, `scripts/prove-boundary-rules.mjs`, `aidd_docs/memory/`
- **Health**: good
- **Findings**: 0 critical, 0 warning, 0 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| — | architecture | — | none | — | — |

## Top actions

None. What is worth carrying forward is a note, not an action: `AssessOptions.collectors` is a seam that exists for the suite. It is one optional parameter with one caller, and it should stay that way — the day a second production caller passes its own collector set, the composition root has moved out of `cli/` and this file needs re-reading.

## Coverage

- **The `ports/` gap — closed.** `.dependency-cruiser.cjs` now reads `^src/[^/]+/(models|usecases|contracts|engine|ports|resolution|composition)/` in all three `domain-has-no-*` rules, so the config no longer calls the same folder domain in one rule and not in three. `prove-boundary-rules.mjs` gained three sentinels in `src/evidence/ports/`, one per rule, per the project's own "each rule needs its own sentinel per folder". The gate reports **8 boundary rules proven with 25 deliberate violations**, up from 22, and `evidence-collector.port.ts` can no longer import `node:fs`, `child_process` or a vendor package with the gate green.
- **The phantom seam — closed, in both directions.** `assess.command.ts` holds the `AbortController` and aborts it in `finally`, so an in-flight `git` child is cancelled when the command returns and a future budget is a timer on that controller rather than a restructuring. `cli.md` was also corrected, and it now records that it once described a seam the code did not have — a memory can be wrong about code, and this one was. Correcting only the code would have left the lesson unwritten.
- **The module-constant composition root — closed.** `runAssess(argv, io, options)` takes an optional `AssessOptions.collectors` defaulting to the wired pair. `main.ts` is unchanged, production wiring is unchanged, and the parameter has exactly one non-default caller: the suite that proves exit code `1`.

What still holds, re-verified: `pnpm architecture` is green over 56 modules and 129 dependencies; no import crosses `maturity/` ↔ `evidence/`; `assessment/` reaches both only through their public surfaces; `cli/` is the only importer of `assessment/usecases/`; the frozen contract is still self-contained and still held by `vocabulary-conformance.test.ts` across both gates. The one new production file, `maturity/models/scale-for-axis.ts`, sits inside `models/` and is reached by its own context's `engine/` and `loading/` and by `assessment/composition/` — the same direction the dependency rules already allow, and the cruise confirms it.

- **Scanned**: architecture
- **Skipped**: none
