---
name: audit
description: Codebase audit report — tests pillar (re-run after remediation)
argument-hint: N/A
---

# Codebase Audit: tests — aidd-audit

Exit code `1` is proven on both its routes, and mutation testing is a reproducible command that was verified to actually run rather than to exit zero.

- **Date**: 2026_08_29 (re-run)
- **Scope**: `src/**/*.test.ts`, `tests/`, `vitest.config.ts`, `vitest.mutation.config.ts`, `stryker.config.json`, `package.json`
- **Health**: good
- **Findings**: 0 critical, 0 warning, 0 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| — | tests | — | none | — | — |

## Top actions

1. ~~Start with `shell-tokens.ts` and `shell-loop.ts`.~~ **Done in this run** — see Coverage. 89 tests, and the sweep moved 77.13% → 83.51%.
2. **`agent-invocation.ts` (66.28%, 29 survived, 29 uncovered)** is now the least-covered file in the tree. It is also the cheapest to be wrong about: it can only make `loops` undecidable, never prove it, so a survivor there costs an evidence gap rather than a wrong level.
3. **`model-consistency.ts` (78.90%, 14 survived, 9 uncovered)** — the lowest score left in the decision core, and a file the remediation rewrote.

A survivor is a question about a test, never a licence to loosen a threshold — which is why `thresholds.break` is null. And a flattening curve is an answer too: see the second-pass note below.

## Coverage

- **Exit code `1` — closed, on both routes.** `assess.command.test.ts` now carries three tests over an `OffVocabularyEvidenceCollector` passed through `AssessOptions.collectors`: a string on a numeric axis (`InvalidObservationError` → `1`), `Infinity` under `--json` (`UnrenderableReportError` → `1`), and the same report in prose (→ `0`, `Infinity` visible in the text). That third one is the asymmetry `cli.md` describes — JSON turns `Infinity` into `null` and this contract reads `null` as absence, so refusing is the only truthful answer, while prose printing `NaN` misleads nobody — and it was the one clause of the taxonomy with no test at all. The suite went 575 → 578.
  It stays in process rather than through the spawned binary, deliberately: the binary takes no collector argument, `1` is `runAssess`'s to return, and `process-contract.test.ts` already proves `main.ts` relays what it returns. The double is a boundary double — everything downstream of the collector is the real pipeline.
- **Mutation testing — closed, and verified rather than assumed.** `pnpm mutation` runs Stryker over `maturity/loading/`, `maturity/engine/`, `maturity/models/`, `evidence/adapters/harness/` and `evidence/resolution/`. Three configuration decisions are load-bearing and are recorded in `testing.md`:
  - `plugins` names `@stryker-mutator/vitest-runner` explicitly. **The first run died at startup without it** — `Cannot find TestRunner plugin "vitest". In fact, no TestRunner plugins were loaded` — because pnpm isolates `node_modules` and Stryker's core cannot discover the runner beside itself. That is precisely the failure mode `testing.md` records as having once read as every mutant killed, and it is why the tool was smoke-run before being declared wired.
  - `vitest.mutation.config.ts` is the sweep's own narrower view: no `tests/`, no `globalSetup`. Rebuilding `dist/` once per mutant would measure tsup, not the tests.
  - `thresholds.break` is null. A gate that fails on a survivor gets the threshold loosened, not the test strengthened.

  The full sweep then ran to completion, alone, on a settled tree: **1692 mutants over 12 m 49 s — 1277 killed, 273 survived, 118 uncovered, 0 errors. 77.13% total.** That is the reproducible baseline the finding asked for, and a real one with real survivors rather than a run that exited zero.

  **What it says, which no other gate here says.** The decision core is strong and the recogniser is not:

  | | score | survived | uncovered |
  | --- | --- | --- | --- |
  | `maturity/engine/` | 96.06 | 5 | 0 |
  | `evidence/resolution/` | 94.34 | 3 | 0 |
  | `maturity/models/` | 91.46 | 5 | 2 |
  | `maturity/loading/` | 88.00 | 33 | 9 |
  | `evidence/adapters/harness/` | **69.58** | **227** | **107** |

  Every previously recorded defect in this repository was in the loader, and the loader now scores 88 with `load-maturity-model.ts` at 100. The weight has moved: **83% of all survivors are in the harness subtree**, concentrated in `shell-tokens.ts` (58.66, 105 survived, 43 uncovered) and `shell-loop.ts` (70.99, 73 survived, 30 uncovered) — the hand-rolled shell lexer and loop analysis, which are also the least constrained code in the project by any other measure. `harness-scan.ts` at 97.30 shows the orchestration above them is well pinned; it is the token layer underneath that nothing interrogates.

  The 42 timeouts are all in that subtree too, and a timeout is a killed mutant, not a gap. The 118 uncovered were the real signal: code no test reached at all.

- **The gap the sweep named — closed in this run.** `shell-tokens.test.ts` (46 tests) and `shell-loop.test.ts` (43 tests) drive the two files on a source string rather than through a repository walk. Every assertion is a fact about shell — what a comment hides, what survives single versus double quotes, where a word may be a command, what a function body contains, and the three answers a loop can get — not a fact about this code's shape. The suite went 578 → 667 and the sweep answered:

  | | before | after |
  | --- | --- | --- |
  | `shell-tokens.ts` | 58.66 | **81.01** |
  | `shell-loop.ts` | 70.99 | **79.15** |
  | `evidence/adapters/harness/` | 69.58 | **79.51** |
  | whole sweep | 77.13 | **83.51** |
  | mutants nothing reached | 118 | **61** |

  All 89 passed on their first run bar one, and **that one was the test being wrong, not the code**: `'echo a\;b'` in TypeScript carries no backslash at all, so the case never reached the reader it was written for. Fixed in the test.

- **The second pass is the more useful finding, and it is about when to stop.** A further 25 tests, each aimed at a survivor named one by one out of the report, bought **0.7 points**. `readShellLoops` answers in two booleans; a great many internal distinctions are simply not observable from outside it, and reaching them would mean exporting internals to be tested — buying a number and losing the rule that a test drives a public API. The curve flattened, and the remaining work is elsewhere: `agent-invocation.ts` and `model-consistency.ts`. Recorded in `testing.md` so the next person does not spend the afternoon this one would have cost.
- **Coverage reporter — closed.** `@vitest/coverage-v8` is a devDependency. It is deliberately not in `pnpm check`: it is for reading uncovered *branches* on demand, never a percentage target.
- **Platform — closed by documentation, deliberately not by an `os` field.** `testing.md` now records that the suite is Unix-only (`#!/bin/sh` shims on `PATH`, `command -v git`, `chmod 0755`, a git alias running `sh -c 'sleep …'`) and that this is the suite's constraint, not the product's. An `os` field in `package.json` would refuse installation on a platform `dist/cli.js` itself runs on, which overstates the fact.

Everything the first run found clean is still clean, re-checked: no skipped, `.only` or `.todo` test; no sleep used as an assertion; assertions on values, strings and exit codes with no call-order or private-state reach; the reference-profile table pinned with `axesConfirmed === 4`; the declared `intervention` cut points and the `core.fileMode=false` COMPAT case pinned.

- **Scanned**: tests
- **Skipped**: none — a coverage reporter is now installed, so nothing was out of reach. No coverage percentage is quoted, by choice: this audit reads branches, not scores
