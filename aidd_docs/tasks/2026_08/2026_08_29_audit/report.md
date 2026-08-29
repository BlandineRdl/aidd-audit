---
name: audit
description: Codebase audit report — all seven pillars, re-run after remediation
argument-hint: N/A
---

# Codebase Audit: aidd-audit — all seven pillars (re-run)

All 23 findings of the first run are resolved: 22 fixed and re-verified against the code, one withdrawn as an audit error. One new minor is raised by the remediation itself, and one item is explicitly recorded as owed rather than quietly closed.

- **Date**: 2026_08_29 (re-run after remediation)
- **Scope**: whole repository — `src/`, `tests/`, `scripts/`, `aidd.yml`, root configs, `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml`
- **Health**: good
- **Findings**: 0 critical, 0 warning, 1 minor

| | First run | This run |
| --- | --- | --- |
| critical | 0 | 0 |
| warning | 11 | 0 |
| minor | 12 | 1 |
| tests | 575 | 667 |
| boundary sentinels | 22 | 25 |
| `pnpm audit` | 1 low | none |
| mutation baseline | none — tool absent | **83.51%** over 1692 mutants |
| mutants nothing reached | — | 118 → **61** |

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| 🟢 | dependencies | `package.json:33` | The dev tree went 224 → 389 transitive packages, all 165 of them Stryker's, for one command run by hand — and one of them arrived carrying a moderate advisory (`qs` under `typed-rest-client`), now overridden. Still the right trade for a project whose memory names mutation testing as the only technique that has caught its defects, but not a free one. | Nothing to change. Re-open the question if a third Stryker-borne advisory appears — at that point the tool is being paid for in lockfile maintenance rather than test quality. | S |

## Top actions

1. ~~**Test the shell token layer at its own boundary.**~~ **Done in this run.** `shell-tokens.test.ts` (46 tests) and `shell-loop.test.ts` (43 tests) drive the two files on a source string instead of through a repository walk. `shell-tokens.ts` went 58.66% → **81.01%**, `shell-loop.ts` 70.99% → **79.15%**, the harness subtree 69.58% → **79.51%**, and the whole sweep 77.13% → **83.51%**, with mutants nothing reached falling 118 → 61. The suite went 578 → 667.
2. **`agent-invocation.ts` (66.28%, 29 survived, 29 uncovered)** is now the lowest-covered file in the tree. It is also the cheapest to be wrong about: it can only make `loops` undecidable, never prove it, so a survivor there costs an evidence gap rather than a wrong level. Hand to `test`.
3. **`model-consistency.ts` (78.90%, 14 survived, 9 uncovered)** — the lowest score left in the decision core, and a file this remediation rewrote. Worth a look precisely because it just changed.
4. **Nothing else is scheduled.** The one finding row is a decision kept visible, not work.

### What is owed, and is not being reported as closed

A `COMPLETED` collector that emitted nothing for one axis still cannot say why. The *defect* — swallowing a `TypeError` into "no observation" — is fixed. Carrying a per-axis reason needs a field on `ProvenanceEntry` **and** a change to `EvidenceCollector.collect`'s return shape, both frozen in `architecture.md`. That is a design decision rather than a repair, it was already `cli.md`'s standing entry before this audit, and it stays one.

### Two changes in this tree are not mine

`LICENSE` and `README.md` appeared during this session, and `package.json`'s `license` went `ISC` → `MIT`. I did not write any of them; they arrived while I was working and my `package.json` rewrite carried the `MIT` line into the diff. They are consistent with each other and nothing depends on the outcome — flagged so the diff is not read as this work's.

## Coverage

All seven pillars re-examined. Every closure below was checked by reading the code, not by trusting the change that claimed it.

- **security** — scanned, **2 warnings closed**. `git-process.ts:56` prepends `-c core.fsmonitor=false -c core.hooksPath=/dev/null` at the single place `git` is spawned, so no future command can forget it, and `git-history.ts:304` adds `--no-ext-diff --no-textconv` to the one invocation producing a diff. The environment scrub now strips three families instead of one — location, `GIT_CONFIG_*`, and every variable naming a program — while still leaving author identity alone. A repository received as a directory can no longer choose what this tool executes.
- **code-quality** — scanned, **3 warnings and 5 minors closed**. The three swallowing catches now distinguish a source that refused from a defect that must surface as `FAILED`; `.claude/worktrees/` is ignored; the comment gate reaches the root configs, both violations behind it are fixed, **and the widened gate immediately failed the first block written after the widening** — in the run meant to certify this work. The unreachable guards are gone or throw, `median` refuses an empty sample instead of publishing zero, the `intervention` cut points are named and justified, the dead regex escape is deleted, and the four-way scale lookup is one file with four callers.
- **architecture** — scanned, **2 warnings and 1 minor closed**. `ports/` is domain in all three `domain-has-no-*` rules, with three new sentinels proving it — 25 deliberate violations, up from 22. `runAssess` holds its `AbortController` and aborts it in `finally`, so the seam `cli.md` described now exists; `cli.md` was corrected too, and records that it once described a seam the code did not have.
- **performance** — scanned, **2 warnings and 1 minor closed, 1 minor withdrawn**. The per-merge `git diff` N+1 is one `git log --no-walk --diff-merges=first-parent --numstat` per 500 merges, verified byte-identical to the diffs it replaces before the change was made; the per-side queries run eight at a time in listed order; the file scan breaks the moment `loops` is proven, which is outcome-neutral by construction. The `readMostRecentCommitDate` row is **withdrawn as an audit error**: the proposed `-1 --date-order` sorts by commit date where the function needs the maximum author date, and the underlying concern was negligible. Recorded as a wrong finding, not a deferred one.
- **tests** — scanned, **2 warnings and 2 minors closed**. Exit code `1` is pinned on both routes plus its prose counterpart, through a boundary double passed to `AssessOptions.collectors`; 575 → 578. `pnpm mutation` is wired, and was **smoke-run before being declared working** — the first attempt died at startup with `no TestRunner plugins were loaded`, the exact failure `testing.md` records as having once read as every mutant killed. With `plugins` declared, the full sweep ran to completion alone: **1692 mutants, 77.13% total**, and said something no other gate here says — the decision core was strong (`engine` 96.06, `resolution` 94.34, `loading` 88.00 with the model loader at 100) while **83% of all survivors sat in the harness subtree**, in the hand-rolled shell lexer and loop analysis. The failure mode this project has recorded three times had moved house. **Acting on it in the same run took the sweep to 83.51%** — see the tests pillar. Coverage reporter installed, on demand and outside the gate; the suite's Unix-only constraint documented rather than declared as an `os` field that would refuse installation on a platform the tool itself runs on.
- **dependencies** — scanned, **2 minors closed, 1 new minor raised**. `pnpm audit`: no known vulnerabilities, via two overrides each carrying its reason. `lefthook` patched; TypeScript held at 5.x with the decision recorded in `architecture.md`. The new row is the cost of the mutation tooling, above.
- **ui** — **skipped**, re-established rather than carried over: zero component, markup or stylesheet files outside `node_modules/`; `tsconfig.json:4` excludes the DOM lib; `tsup` targets Node; the only output surfaces are two text renderers, judged under `code-quality` and `tests`. No runtime accessibility pass was possible or meaningful, and no static UI findings were invented in its place.

### The gate, run clean and alone

```
pnpm typecheck    ✔
pnpm test         ✔  578 passed (23 files)
pnpm architecture ✔  56 modules, 129 dependencies, no violation
                  ✔  8 boundary rules proven with 25 deliberate violations
pnpm comments     ✔
pnpm build        ✔  dist/cli.js 86.62 KB
pnpm audit        ✔  no known vulnerabilities

pnpm mutation     ✔  1692 mutants, 1381 killed, 221 survived, 61 uncovered, 0 errors
                     83.51% total / 86.60% of covered code, in 13m11s
```

The test count reads 578 in the table above and 667 here: the table is the state at the end of remediation, and the 89 tests of the two shell suites landed after it, on the sweep's own evidence.

`pnpm mutation` is not part of `pnpm check` and must not become part of it: thirteen minutes is a report to read, not a gate to pass.

- **Scanned**: code-quality, architecture, security, dependencies, performance, tests
- **Skipped**: ui — no user interface exists in this project; no URL to audit and no findings invented
