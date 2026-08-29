---
name: audit
description: Codebase audit report — code-quality pillar (re-run after remediation)
argument-hint: N/A
---

# Codebase Audit: code-quality — aidd-audit

All eight rows closed. The gate that judges comments now reaches the files that configure the gate, and it caught the first block written after the widening.

- **Date**: 2026_08_29 (re-run)
- **Scope**: `src/`, `scripts/`, root configs — whole codebase
- **Health**: good
- **Findings**: 0 critical, 0 warning, 0 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| — | code-quality | — | none | — | — |

## Top actions

None outstanding. One thing is deliberately **not** done and is recorded as owed rather than closed: a `COMPLETED` collector that emitted nothing for one axis still cannot say why. Fixing the swallow was the defect; carrying a per-axis reason needs a field on `ProvenanceEntry` **and** a change to `EvidenceCollector.collect`'s return shape, both frozen in `architecture.md`. That is a design decision, not a repair, and it is `cli.md`'s standing entry.

## Coverage

Each previous row re-checked against the code:

- **The swallowing catches — closed.** `live-repository.adapter.ts:105` is now `unobservedUnlessOurs`: a spent budget rethrows, a `GitCommandFailedError` returns `[]` (the source refused — an evidence gap), and anything else rethrows to `runCollector`, which reports `FAILED` with the message. `fixture-bundle.adapter.ts:63` does the same over `isFilesystemRefusal`, keying on Node's `errno` code. A `TypeError` in the scan is no longer published as an absence nobody observed.
- **`.claude/worktrees/` — closed.** `.gitignore:5`. `git status --porcelain` no longer reports it, and the 170 MB second checkout is no longer one `git add -A` from being committed. It paid for itself immediately: Stryker derives its sandbox from what git lists, so the sweep does not copy it either.
- **The comment gate's reach — closed.** `check-comment-tags.mjs:11` now governs `*.config.ts`, `*.cjs` and `*.mjs` at the root. Both violations behind it are fixed: `.dependency-cruiser.cjs:1`, the repository's last docblock, is now a tagged `//` block, and so is the untagged one at `:92` that the widening also exposed; `vitest.config.ts:3` carries `INVARIANT:`. **The widened gate then failed the very next block written** — an untagged comment in `assess-arguments.ts` — in the same `pnpm check` run that was meant to certify this work. That is the gate doing its job on its author.
- **Unreachable guards — closed.** `model-consistency.ts` walks its ranks pairwise, so `lower` is undefined only on the first level, which is real; `requireNoDip` iterates the scale map's entries, so no scale can be missing; `requirementOn` **throws** where a `continue` silently skipped, reusing `requireCoverage`'s own message through a shared `noRequirementFor`. `git-history.ts`'s `median` throws a `RangeError` instead of `?? 0` — which would have published the smallest size bucket from an empty sample, a practice gap invented out of nothing. `assess-arguments.ts` iterates `operands.entries()`, which yields the token itself, and tracks the one position genuinely absent (a flag's value at end of line). The three `undefined` checks that remain in these files are all reachable and correct.
- **The `intervention` cut points — closed.** `recorded-activity.ts:41` names them `CORRECTIONS_FOR_MOST_CHANGES` and `CORRECTIONS_FOR_SOME_CHANGES` under a `LIMITATION:` that says they are chosen and not measured, why they sit on half-integers (a median of an even sample is one), and which direction the cost is asymmetric in.
- **The dead escape — closed.** `spawner.replace('.', '\\.')` is gone, and the eleven spawner patterns are built once at module level as `SPAWNER_CALLS` rather than per scanned file. `matchAll` clones its pattern rather than advancing it, so sharing them is safe.
- **The four-way scale lookup — closed.** `maturity/models/scale-for-axis.ts` holds `scaleNamedBy` and `scaleForAxis`; `scale-comparison.ts`, `model-consistency.ts` (twice) and `axis-vocabulary.ts` all call it. One `Object.hasOwn(model.scales …)` remains in the tree, in the file that owns the rule.
- **Gold's ceiling — closed.** `aidd.yml:186` carries a `LIMITATION:` on the Gold level saying `never-framing-included` is not observable and no collector emits it. The reasoning is now where a reader of the model will meet it, not only in a task folder marked for deletion.

`pnpm typecheck`, `pnpm architecture`, `pnpm comments` and `pnpm test` (578 tests, 23 files) all pass, and `pnpm build` produces `dist/cli.js`.

- **Scanned**: code-quality
- **Skipped**: none
