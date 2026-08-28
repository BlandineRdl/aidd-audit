# Review: render an assessment report as human-readable output (final pass, round 3)

- **Verdict**: approved. Ship as a draft PR. No remaining finding is a blocker; all six are refinements to record.
- **Diff**: working tree. Untracked: `src/cli/renderers/human.renderer.ts`, `tests/cli/human-renderer.test.ts`, `tests/cli/assessment-report.fixture.ts`. Modified tracked: `.claude/rules/01-standards/1-file-naming.md` (+1 line). `src/assessment/contracts/assessment-report.contract.ts` verified unmodified three ways: `git diff HEAD -- src/assessment/contracts/ | wc -c` is `0`, `git status --porcelain -- src/assessment/` is empty, and `git hash-object` of the working file equals `git rev-parse HEAD:` for it (`83d6fa5a00de33f0993e25df2d7107c0c9ac24e6`).
- **Axes run**: code, behaviour vs plan, relevancy
- **Rules read**: `.claude/rules/01-standards/1-clean-code.md`, `.claude/rules/01-standards/1-boy-scout.md`, `.claude/rules/02-programming-languages/2-typescript-domain-modeling.md` (scoped `src/**/*.ts`, `tests/**/*.ts`), `.claude/rules/01-standards/1-file-naming.md` (scoped `src/**/*.ts`), `.claude/rules/00-architecture/0-public-contracts.md` (governs the consumed contract), `.claude/rules/00-architecture/0-use-cases.md` (no file matches, not applied)
- **Date**: 2026_08_28
- **Findings**: 0 critical, 0 warning, 6 minor. All 12 findings of round 1 and all 10 of round 2 are closed.

## Phases

Twelve acceptance criteria. Every repair claimed by the executor was put under a mutant in an isolated mirror rather than read. Mirror: `src/`, `tests/`, `aidd.yml`, `package.json`, `tsconfig.json`, `vitest.config.ts` copied to scratch with `node_modules` symlinked; baseline `Test Files 3 passed (3)`, `Tests 67 passed (67)`, identical to the worktree. No mutant touched the worktree.

| AC | Verdict | Mutant and result (`tests/cli`, 30 tests) |
| -- | ------- | ----------------------------------------- |
| 1 | fulfilled | Unique strings. |
| 2 | fulfilled | **M2** `report.proven ?? report.levels[0] ?? null` reinstated against the reworded headline: 1 failed, `never names White as the proven result`. The rewording did not weaken the fallback ban. |
| 3 | fulfilled | Isolated via `blockerLine`. |
| 4 | fulfilled | **M1** deletes `this requirement could not be established — `: 3 failed. |
| 5 | fulfilled | Fixture is one axis with two requirements. |
| 6 | fulfilled | **M10** re-gates the collectors section on `proven === null`: 4 failed. |
| 7 | fulfilled | **M3** `return matches[0]`: 2 failed, including the new content assertion. |
| 8 | fulfilled | **M7** (round 2) killed 2; unchanged here. |
| 9 | fulfilled | **M6** (round 2) killed 2; fixture now `outcome: 'NOT_MET'` rendered as `next`, matching `aggregate`. |
| 10 | fulfilled | **M9** restores `Evidence coverage was insufficient…` as the headline: 1 failed, `never blames evidence when the baseline failed on a confirmed practice instead`. |
| 11 | fulfilled | **M10** above. Verified by running: `proven: Green` with a `TIMED_OUT` collector now prints `live-repository: timed out on harness, parallelism — budget exceeded after 30s`. |
| 12 | fulfilled | **M11** blanks `axesPart`: 2 failed. **M12** drops `glossProvenanceStatus`: 1 failed. |

### The four round-2 warnings, each confirmed closed by running

1. **Headline evidence claim.** Now `Proven level: could not be established. No level's requirements were fully proven.` Verified on the exact report that broke round 2 (`4 of 4 axes confirmed`, `COMPLETED` collector, `(CONFIRMED, NOT_MET)` blocker): no evidence claim, no self-contradiction, and the blocking line correctly reads `[practice gap] Taille at White: observed S does not reach the required L.` **M9 kills it.**
2. **Unpinned AC7 fallback.** My M8 mutant, which survived rounds 1 and 2, **now dies**: deleting `the observed practice does not meet the requirement. Improve ${axisLabel} to close the gap.` fails `still states that the practice does not meet the requirement, instead of an empty line` (`test:264-266`).
3. **Silenced collectors.** `renderIncompleteCollectorsSection` is unconditional and `renderCoverageSection` stays gated. **M10 kills it** on four tests.
4. **Unnamed axes.** `entry.axes` renders. **M11 kills it** on two tests.

Round-2 minors also closed: `glossProvenanceStatus` maps `TIMED_OUT` to `timed out` (M12 kills it, and `test:355` additionally forbids the raw token); the AC9 fixture is rebuilt as `outcome: 'NOT_MET'` rendered as `next` with a comment citing `maturity-engine.ts`; test 8's double `renderHumanReport` call and redundant `not.toThrow()` are gone; the type predicate compares against the literal `'CONFIRMED'`. Purity re-verified: `grep -nE "console|process\.|Date\.|Math\.random| as [A-Z]|as unknown|as never|: any|\w!\."` over the renderer returns three prose lines only. No cast, no non-null assertion. No `cli` to `maturity` import: `depcruise` cruises 20 dependencies and the renderer's only edge is to the contract.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | test | AC11 | `src/cli/renderers/human.renderer.ts:74-76`, `tests/cli/human-renderer.test.ts:328-369` | The guard that stops the now-unconditional collectors section from firing on a clean run is correct but unpinned. **M13** deletes `if (incomplete.length === 0) { return '' }` and **30 of 30 tests still pass**; the fully-successful run then renders a dangling `Collectors that did not complete:` header with nothing beneath it, verified by running. The behaviour asked for in the coordinator's question ("it must not fire on a fully-successful run") holds today; nothing stops it regressing. | One assertion in the round-3 describe: on `assessmentReport()` (all-`COMPLETED` provenance), `incompleteCollectorsParagraph(output)` is `toBeUndefined()`, mirroring the coverage assertion at `:366`. |
| 🟢 | code | - | `src/cli/renderers/human.renderer.ts:195-200` | The comment claims a guarantee the compiler does not give: "this is a discriminant comparison TypeScript's own control-flow narrowing **proves**". It does not. Verified by running `tsc --noEmit` with the predicate body replaced by `true`, and again by `candidate.axis === 'anything'`, annotation `candidate is PracticeRequirement` kept in both: **the compiler accepted both**. A user-defined type predicate body is never checked against the asserted type. Separately verified that removing the annotation does **not** compile on TS 5.9.3 (`TS2322`, `RequirementReport \| undefined` not assignable), so the predicate is load-bearing and cannot simply be dropped. The substance of the repair is real and my round-2 finding is closed: comparing to the literal removes the drift risk. Only the claim about it is false, which is the same fault line Amendment 2 names, this time in a comment rather than in output. `1-clean-code.md` § Comments. | Reword to what is true: the literal keeps the check independent of `PracticeBlocker`, and the predicate remains an unchecked assertion the compiler takes on trust. Do not change the code. |
| 🟢 | test | AC12 | `src/cli/renderers/human.renderer.ts:89` | The empty-`axes` guard is correct and reachable but untested. Verified by running a `FAILED` entry with `axes: []`: it renders `  live-repository: failed — spawn ENOENT`, with no dangling ` on `. Reachable whenever a collector dies before it determines which axes it was carrying, which `spawn ENOENT` is exactly. No test constructs it, so `entry.axes.length > 0 ? … : ''` could collapse either way unnoticed. | One case in the round-3 describe with `failedProvenance('live-repository', [], 'spawn ENOENT')`. |
| 🟢 | fit | AC10 | `src/cli/renderers/human.renderer.ts:48` | `No level's requirements were fully proven.` is supportable, so the problem did not merely move: `proven: null` means no level reached `MET`, `MET` means every requirement `MET`, and the product's own vocabulary calls such a level `proven` (`project-brief.md` § Domain language, "No proven level"). The residual is reader-side, not a false claim: `proven` is the product's evidential word, so a requirement that was `CONFIRMED` and `NOT_MET` was in fact proven, proven to fail, and calling it "not fully proven" leans evidential for a practice failure. The coverage line and the glossed blocking section below resolve it within two lines, which is why this is a refinement and not a repeat of the round-2 warning. | If it is ever reworded: `No level had all of its requirements met.` states the same fact without the evidential word. |
| 🟢 | fit | AC6 | `src/cli/renderers/human.renderer.ts:59` | Coverage silence is keyed on `proven !== null` rather than on the counts. The justifying comment ("MET implies every axis CONFIRMED") is correct for the model's axes, via `aggregate` and `outcomeOf`, but `axesRequested` is a free field on `CoverageReport` that the renderer never cross-checks. A producer that requested more axes than the model declares would give a proven level alongside `axesConfirmed < axesRequested`, and the shortfall would be hidden. Reasoned, not run: `assess-maturity.usecase` does not exist, so whether that report is producible is not yet decidable. | Record as a question for `assess-maturity.usecase`: is `axesRequested` the model's axis count by construction. If it is not, key the section on `axesConfirmed < axesRequested` instead of on `proven`. |
| 🟢 | code | - | `tests/cli/human-renderer.test.ts:15-26` | `provenParagraph`, `coverageParagraph` and `incompleteCollectorsParagraph` are three copies of `output.split('\n\n').find(p => p.startsWith(X))`, differing only in the literal. `1-clean-code.md` § Naming and abstraction: prove an abstraction removes duplication. Three copies is the proof. (`blockerLine` is genuinely different and should stay.) | One `paragraph(output, prefix)` helper, called with the three prefixes. |

## Challenge: is this trustworthy enough to ship?

Yes. Ship it as a draft PR.

Two rendered samples, both produced by running the unmutated renderer.

**A null-proven repository with partial collection.** The reader is told the level could not be established with no cause attributed, that 1 of 4 axes was confirmed, that `live-repository: timed out on harness, parallelism — budget exceeded after 30s`, that White's Harness and En parallèle axes are `UNPROVEN (evidence gap)`, and that each blocked requirement should be resolved by collecting observable evidence. The correct action is to fix the collector timeout and re-run. Nothing in the output invites them to change their practice. That is the conservative rule honoured end to end, and it is the case that was three useless lines two rounds ago.

**A proven Green blocked at Copper.** `Proven level: Green (rank 3)`, `Taille: NOT_MET (practice gap)` under Copper, and `[practice gap] Taille at Copper: observed M does not reach the required L.` The correct action is to take on larger tasks. Also correct.

The two failure modes I have been chasing across three rounds are now both closed and both mutation-pinned: no path renders `proven: null` as a level (M2 dies), and no path attributes an evidence cause to a practice failure or the reverse (M9 dies, M1 dies, M6 dies).

**On the blocker/refinement distinction, explicitly.** None of the six findings is a blocker. Four are missing regression guards or a duplicated test helper: the code is correct and verified correct by running, only the fence around it is missing. One is a comment that overstates a compiler guarantee, which misleads a future reader but changes no output. One is a wording preference on a sentence that is defensible as written. Nothing here can produce a wrong statement to a developer on any input I could construct, and I constructed the adversarial ones deliberately: full coverage with a practice gap, partial coverage with a proven level, empty axes, ghost ids, ambiguous thresholds, and an axis carrying two requirements.

The one thing I would not let slip past the wiring step is finding 5, because it stops being decidable the moment `assess-maturity.usecase` chooses what `axesRequested` counts. Record it against that use case now, while the reason is still in view.

## Verification

- `pnpm check` exits zero. `tsc --noEmit` clean. `Test Files 3 passed (3)`, `Tests 67 passed (67)`. `depcruise src`: `✔ no dependency violations found (13 modules, 20 dependencies cruised)`, then `✔ 10 boundary rules proven against deliberate violations`. The coordinator's figures reproduce exactly.
- Contract untouched, confirmed by byte count, porcelain and object hash as recorded in the header.
- Mirror baseline reproduces the worktree: `Tests 67 passed (67)`.
- Nine mutants run against `tests/cli` (30 tests). Eight die: M1 kills 3, M2 kills 1, M3 kills 2, M8 kills 1, M9 kills 1, M10 kills 4, M11 kills 2, M12 kills 1. M13 survives at 30 of 30 and is finding 1.
- Three `tsc --noEmit` probes on the type predicate: body `true` accepted, body `candidate.axis === 'anything'` accepted, annotation removed rejected with `TS2322`. TypeScript 5.9.3. These are finding 2.
- Six behaviour probes run under `node --experimental-strip-types` outside the repository: fully-successful run (no collectors section, correct), the same under M13 (dangling header), `axes: []`, null-proven with partial collection, proven Green blocked at Copper, and null-proven with full coverage plus a practice gap. Their output is the evidence for findings 1, 3 and for the challenge above.
- Reasoned, not run: finding 5's reachability, which depends on an `assess-maturity.usecase` that does not exist; and finding 4's reader-side ambiguity, which is a judgement about prose, not a behaviour.
- Coverage instrumentation remains unavailable (`Cannot find dependency '@vitest/coverage-v8'`), so every liveness claim above is a mutation result, not a percentage.
