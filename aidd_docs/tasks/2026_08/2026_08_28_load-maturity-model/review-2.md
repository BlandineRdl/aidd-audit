# Review 2: load a maturity model the engine can safely evaluate

- **Verdict**: changes-requested
- **Diff**: `d6c3ddb..733ad17` (16 files, +1328 / -61) — re-review after the repairs in `733ad17`
- **Axes run**: code, behavior versus plan, relevancy
- **Rules read**: `0-use-cases.md`, `0-public-contracts.md`, `1-boy-scout.md`, `1-clean-code.md`, `1-file-naming.md`, `2-typescript-domain-modeling.md`, `.dependency-cruiser.cjs`
- **Date**: 2026_08_28
- **Findings**: 0 critical, 5 warning, 6 minor

## Phases

Both phases are `status: done`. Both were re-run against their own acceptance criteria, and every previous finding was re-tested rather than read.

| Phase | Claim | Result |
| ----- | ----- | ------ |
| 1 — the loader refuses what the engine trusts | Seven criteria pinned as behaviour | The prototype-scale hole is genuinely closed. Two arms of AC6 and the whole of `requireDistinctIds` remain pinned by nothing (findings 2, 4), and a non-finite threshold is still accepted (finding 1) |
| 2 — cut the cast and make the docs true | No cast, comments true, memory realigned | Cast gone, comments true, extraction clean. Two of the three rewritten status headers replaced a false claim with a narrower false claim (finding 5) |

### The previous review's ten findings, re-tested

| # | Previous finding | Status | Evidence |
| - | ---------------- | ------ | -------- |
| 1 | 🔴 prototype-chain scale defeats AC3 and AC6 | **closed** | Ten inherited names probed — `constructor`, `toString`, `valueOf`, `__proto__`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`, `__defineGetter__`, `__lookupGetter__` — all rejected with `Axis 'size' names a scale the model does not declare`. Two independent defences: `Object.create(null)` at `:122` and `Object.hasOwn` at `:290`/`:360`/`scale-comparison.ts:45`. Removing either alone still leaves 66/66 green; removing both fails 7 tests. A scale genuinely declared under the key `__proto__` is accepted, correctly. No variant found that gets through |
| 2 | 🟡 `reachesOrExceeds` fails open on its default | **closed** | `switch` on `scale.kind`, `default` assigns to `never` and throws. Proven to bite: adding a fourth `Scale` kind yields `yaml-maturity-model.adapter.ts(437,13): error TS2322: Type 'RatioScale' is not assignable to type 'never'` |
| 3 | 🟡 `requireThresholdOnScale` duplicated in two copies | **closed** | Extracted to `src/maturity/models/threshold-on-scale.ts`, imported by both. Messages byte-identical to `02431fc` for both callers: the adapter keeps `Level 'x': axis '…' …`, the engine keeps the capitalised bare sentence via `sentence()`. `models/` is inside the folder glob of `domain-has-no-filesystem` / `-processes` / `-vendor-sdk` (`^src/[^/]+/(models\|usecases\|contracts\|engine)/`), so the wall still covers the moved rule. Not orphaned |
| 4 | 🟡 `schemaVersion === 1` pinned and explained by nothing | **closed** | Test asserts `/got 7/`; mutating the guard to `typeof value !== 'number'` kills it. Comment at `:64-67` states why one version |
| 5 | 🟡 numeric arm of AC3 passes for the wrong reason | **closed** | Now asserts `/minimum is not a number/`; deleting the numeric branch of `threshold-on-scale.ts` kills 2 tests |
| 6 | 🟡 three memory status headers deny the code | **partial** | See finding 5 |
| 7 | 🟢 no test asserts class **and** message | **closed for the adapter suite** | All 22 adapter cases chain `toThrow(InvalidMaturityModelError)` and `toThrow(/…/)`. The engine suite was out of that finding's scope and still asserts class only (finding 10) |
| 8 | 🟢 four `continue`s that skip rather than refuse | **open** | Unchanged at `:303`, `:369`, `:382`, `:388` (finding 8) |
| 9 | 🟢 a `.nan` rank is accepted | **code closed, test vacuous** | `rank: 1e400` now rejected with `'level 'high'.rank' must be a finite number, got Infinity`. The three tests that claim to prove it never build a non-finite rank (finding 3) |
| 10 | 🟢 `.adapter.ts` suffix versus the settled no-port decision | **open by design** | Recommendation in `Verification` — the rule should move, not the file |

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | code | 1 | `src/maturity/adapters/yaml-maturity-model.adapter.ts:250-257`, versus `:85-98` | **A non-finite numeric *threshold* is accepted, and the engine then blames the repository for it.** `requireNumber` refuses `NaN` and `±Infinity` for a `rank`, with a docblock explaining that a value ordering against nothing is a model defect. `requireRequirement` applies no such rule to `min`: `typeof min === 'number'` is the whole test, and `requireThresholdOnScale` accepts any number on a numeric scale. Verified accepted: `min: .nan` on a one-level numeric model, and `min: .inf` at the higher of two levels (`Infinity >= 1` passes cumulativity). Verified end to end: `checkMaturity` on that model with a `CONFIRMED` observation of `999999` returns `outcome=NOT_MET, proven=null`, because `value >= NaN` is always false. `NOT_MET` is the **practice gap** — `project-brief.md` says AIDD may then recommend improving the practice — so a defective `--model` produces "your repository does not meet this requirement" about a requirement no repository can ever meet. That is the product's stated central failure mode, reached through a model defect the gate exists to refuse. Two levels both carrying `.nan` are rejected, but with a dip message that names the wrong problem (`Level 'high' asks less than 'low'`). The commit reasoned this out for `rank` and did not carry it one field across. | Route `min` through `requireNumber` when it is a number, or add `Number.isFinite` to `threshold-on-scale.ts`'s numeric branch so both the gate and the backstop refuse it. Message should name the level, the axis and the value. |
| 🟡 | test | 1 | `tests/maturity/yaml-maturity-model.adapter.test.ts:309-325` versus `src/maturity/adapters/yaml-maturity-model.adapter.ts:412-427` | **AC6 is pinned on the ordinal arm only; the set and numeric arms are held by nothing.** Mutation: replacing `return lower.includes.every(…)` with `return true` leaves **66/66 green**; replacing `return Number(higher.min) >= Number(lower.min)` with `return true` leaves **66/66 green**. Only the ordinal branch kills a test. The one dip test uses the `size` ordinal axis; no test dips a set or a numeric axis. In `aidd.yml` that is two of the four real axes — `harness` is a set scale, `parallelism` is numeric — so the arms with no coverage are the majority of the shipped model. The code itself is correct: a set dip (`includes: [a, b]` above `includes: [a]`) and a numeric dip (`min: 5` above `min: 2`) are both rejected with the right message. Nothing would notice if they stopped being. | Two more cases in `describe('a level that dips')`: a higher level dropping a required set member, and a higher level lowering a numeric minimum. Both should assert `InvalidMaturityModelError` and the axis id, as the neighbouring cases do. |
| 🟡 | test | 1 | `tests/maturity/yaml-maturity-model.adapter.test.ts:344-354` | **The three new non-finite-rank tests never build a non-finite rank.** `mutate()` assigns the JS **string** `'.nan'` to `level.rank`, and `YAML.stringify` quotes an ambiguous scalar: the emitted document is `rank: ".nan"`, which parses back as the string `".nan"` (verified: `YAML.parse(YAML.stringify({rank:'.nan'}))` → `{"rank":".nan"}`). The parser therefore rejects it through `typeof value !== 'number'`, the path `rejects a level whose rank is a string` at `:155` already covers, and the assertion `/rank' must be a finite number/` matches that message too. Proof by mutation: reverting the guard to `typeof value !== 'number'` — deleting exactly the fix the commit message describes at length — leaves **66/66 green**. The guard works on a genuine non-finite value (`rank: 1e400` → `got Infinity`); it is the test that proves nothing. This is the same defect class as the previous review's finding 5, reintroduced by the commit that fixed finding 5. | Build the document as YAML text rather than through `YAML.stringify` for these three cases, e.g. `validSource.replace('rank: 2', 'rank: .nan')`, and assert `/got NaN\|got Infinity/` — a phrase the string path cannot produce. |
| 🟡 | test | 1 | `src/maturity/adapters/yaml-maturity-model.adapter.ts:260-268` | **`requireDistinctIds` is held by no test at all.** Mutation: making the whole function a no-op leaves **66/66 green**. It guards two distinct rules phase 1 task 3.2.1 requires by name — `axes` with distinct ids, `levels` with distinct ids — and neither has a case in the suite. The behaviour is correct (`'axes' declares 's' more than once.` verified) and it is the only shape guard in the file with zero coverage; `requireDistinctRanks`, its sibling one function below, has one. | One case per rule under `a field of the wrong type`, asserting the class and the duplicated id. |
| 🟡 | rot | 2 | `aidd_docs/memory/architecture.md:5`, `aidd_docs/memory/codebase-map.md:5` and its mermaid `:11-12` | **Two of the three rewritten status headers replaced a false claim with a narrower false claim.** `architecture.md:5` now reads "`evidence`, `assessment` and `cli` do not yet [exist]" and `codebase-map.md:5` "`evidence/`, `assessment/` and `cli/` are still planned". Both are false for two of the three: `src/assessment/contracts/assessment-report.contract.ts`, `src/evidence/ports/evidence-collector.port.ts`, `src/evidence/models/observation.model.ts` and `src/evidence/models/axis.model.ts` are all in the tree, and were already at `d6c3ddb` (`git ls-tree -r d6c3ddb -- src`). `architecture.md`'s own **Frozen before the split** section, forty lines below its status line, names all four as written and frozen; `depcruise` cruises them among its 16 modules. Separately, `codebase-map.md`'s mermaid still carries `SRC["src/ — planned"]` and `TESTS["tests/ — planned"]` twelve lines under a status line that now says both exist — the previous review called this out of scope while the header was equally wrong; now that the header is fixed the contradiction sits inside one file. Memory loads as instructions in every session, which is why this phase existed. | `architecture.md:5` and `codebase-map.md:5`: say `cli` is unwritten and that `evidence` and `assessment` hold only their frozen contract, port and models. Update the two mermaid nodes to match the status line. `aidd_docs/memory/cli.md:5` ("No `src/` yet") carries the original defect untouched and is outside this diff, as the previous review said. |
| 🟢 | test | 1 | `src/maturity/engine/scale-comparison.ts:45` | **The engine half of the critical fix is pinned by nothing.** Mutation: reverting `Object.hasOwn(model.scales, axis.scale) ? … : undefined` to the bare `model.scales[axis.scale]` leaves **66/66 green**. The loader's `Object.create(null)` does not protect this path — `scaleForAxis` also serves hand-built models, where `scales` is a plain object literal (`tests/maturity/maturity-model.fixture.ts`), which is exactly the backstop's stated purpose. Verified the guard works: a hand-built model with `scale: 'toString'` throws `Unknown scale 'toString'`. Nothing holds it there. | One engine case in `maturity-engine.test.ts`: a hand-built model whose axis names `toString`, expecting `InvalidMaturityModelError` and `/toString/`. |
| 🟢 | test | 2 | `tests/maturity/aidd-model.test.ts:16` and `:32-34` | **The new "direct assertion" cannot fail independently of the file loading at all.** `const model = loadMaturityModel('aidd.yml')` runs at module scope on line 16; if the loader rejects the canonical model the suite errors during import, before line 33's `expect(() => loadMaturityModel('aidd.yml')).not.toThrow()` is ever reached. The test can only ever pass. `testing.md:105` now claims this file "asserts the loader's guards directly: a dedicated test loads the canonical model and expects it not to throw" — the claim outruns what the assertion can do. | Either move the module-scope load inside the tests that need it, so line 33 is the first load and can genuinely fail, or drop the tautological case and let `testing.md` describe the reference-point tests as what actually holds the model. |
| 🟢 | code | 1 | `src/maturity/adapters/yaml-maturity-model.adapter.ts:303`, `:369`, `:382`, `:388` | **The four fail-open `continue`s are unchanged.** Previous finding 8, carried forward verbatim. Re-verified that each guards a state an earlier stage already excludes — `requireCoverage` refuses an undeclared requirement axis, `requireVocabulary` throws on an undeclared axis scale, and `requireCoverage` runs before `requireCumulativity`, so `:382` and `:388` are dead — but the polarity of a dead branch inside a function whose only job is to refuse should still be "throw", per `1-clean-code.md`'s "No defensive checks in the core". `:369` is exempt: `noUncheckedIndexedAccess` forces it. | Throw at `:303`, `:382`, `:388`. Ordering Coverage before Vocabulary removes the coupling at `:303`, as the previous review noted. |
| 🟢 | code | 1 | `src/maturity/models/threshold-on-scale.ts:38-42`, `:58-61` | **Two branches of the newly extracted shared rule are pinned by nothing.** Mutation: neutralising "a set scale needs `includes`" leaves 66/66 green; dropping the capitalisation in `sentence()` leaves 66/66 green. The second means no test anywhere asserts the engine-side message text this extraction now produces — `maturity-engine.test.ts:226-258` assert the class only. The extraction is correct today (messages verified byte-identical to `02431fc` on both sides) and unprotected tomorrow, which matters more now that one file serves two callers. | One adapter case for a `min` requirement on a set-scale axis. One engine case asserting a full message, so the shared formatter has a witness. |
| 🟢 | code | 1 | `src/maturity/adapters/yaml-maturity-model.adapter.ts:136-147` | **Scale vocabularies are not checked for duplicates, though every other id list is.** `values: [S, L, S]` is accepted. `reachesOrExceeds` then compares by `indexOf`, which silently picks the first occurrence, so `[L, S, L]` makes `min: S` rank *above* `min: L`. Distinctness is enforced for axis ids, level ids and ranks — the same defect, one layer down, unguarded. | `requireStringArray` gains a distinct-members variant, or `requireScale` calls `requireDistinctIds` on `values` / `members`. |
| 🟢 | code | 1 | `src/maturity/adapters/yaml-maturity-model.adapter.ts:240-248` | **`includes: []` satisfies AC5 in form only.** A level may declare a set axis and require nothing of it; `requireCoverage` counts one requirement, `requireThresholdOnScale` iterates an empty list, and the axis is vacuously `MET` at that level. AC5 asks that every level cover every declared axis; an empty requirement covers the axis without asking anything. Low likelihood in a hand-edited file, but it is the one way to pass coverage without stating a threshold. | Reject an empty `includes` in `requireRequirement`, naming the level and the axis. |

### One note, not a finding

`yaml` prints its own `YAMLWarning` to stderr for an unresolved tag and returns the scalar as a string: `id: !!python/object:os.system "rm -rf /"` loads as the string `"rm -rf /"` with a warning on stderr and no `InvalidMaturityModelError`. There is no execution risk — `yaml` never constructs from a tag — but a malformed `--model` can print parser noise outside the loader's own error channel, which `cli.md`'s renderer contract does not account for. Worth one line in the CLI contract, not a change here.

## Verification

`pnpm check` re-run in this worktree before and after every mutation, independently of the author's claim. Tree restored and `git status --porcelain` empty after each run.

```
$ tsc --noEmit                                     (clean)
$ vitest run          Test Files 3 passed (3) · Tests 66 passed (66)
$ depcruise src       ✔ no dependency violations found (16 modules, 27 dependencies cruised)
$ prove-boundary-rules ✔ 10 boundary rules proven against deliberate violations
```

`grep -rn "as MaturityModel" src/ tests/` returns nothing. AC7 holds.

### Acceptance criteria

| # | Criterion | Verdict | Evidence |
| - | --------- | ------- | -------- |
| 1 | Canonical `aidd.yml` returns a `MaturityModel` | ✅ fulfilled | Two suites load it through `loadMaturityModel`; four axes, seven distinct ranks, Copper-shaped repository graded Copper with `next` at Silver |
| 2 | Malformed model data is rejected | ⚠️ partial | List, scalar, unparseable YAML, empty document, comment-only document, `null`, multi-document stream, duplicate mapping keys, alias-bomb, missing `levels`, string `rank`, non-finite `rank`, `scales: null`, empty `axes`, unknown scale kind — all rejected. Duplicate axis and level ids rejected by code no test holds (finding 4) |
| 3 | Thresholds outside their axis vocabulary are rejected | ✅ fulfilled | Prototype-name scales all rejected (10 probed). Neutering the ordinal, set-member and numeric branches of `threshold-on-scale.ts` kills 2, 2 and 2 tests respectively. The "set scale needs `includes`" branch is unpinned (finding 9) |
| 4 | Requirements targeting undeclared axes are rejected | ✅ fulfilled | Neutering `requireCoverage` kills 4 tests; `/ghost-axis/` named in the message; `axis: __proto__` rejected by name |
| 5 | Every level must cover every declared axis | ⚠️ partial | Omitted-axis and twice-named-axis both pinned. An empty `includes: []` covers an axis without requiring anything (finding 11) |
| 6 | Levels must be cumulative | ⚠️ partial | Code correct on all three arms — ordinal, set and numeric dips all rejected, including a non-consecutive dip (`l2` below `l1` with `l3` above both), and including the prototype-name case the previous review defeated. Pinned only on the ordinal arm (finding 2). A non-finite `min` passes cumulativity and breaks scoring instead (finding 1) |
| 7 | No production path relies on `YAML.parse(...) as MaturityModel` | ✅ fulfilled | `grep` empty across `src/` and `tests/`; both conformance suites go through `loadMaturityModel` |

### Adversarial documents parsed

Thirty-three documents, beyond the sixteen of the previous review. Rejected correctly: empty document, comment-only document, explicit `null`, multi-document stream (`---`), `!!str` on `schemaVersion`, duplicate mapping key at top level and inside a level, an alias bomb (`Excessive alias count indicates a resource exhaustion attack`), an anchor/alias level reuse and a `<<` merge key (both fail on the fields the unmerged mapping lacks, safely), `rank: 1e400`, `rank: 1:30`, `scales: null`, empty `axes`, ten inherited `Object.prototype` names as an axis scale, `axis: __proto__`, an empty ordinal vocabulary, a numeric scale with a string minimum, a set dip, a numeric dip, a non-consecutive dip, duplicate axis ids. Accepted, and listed as findings above: a non-finite numeric `min`; an ordinal scale with duplicate values; an empty `includes`. Accepted and correct: a scale genuinely declared under the key `__proto__`; `rank: 1e308`; `rank: 0x10`; unknown top-level and per-level keys, dropped silently as the `schemaVersion` comment says they are.

### Mutation results

Each guard was neutered in place, the full suite re-run, and the tree restored. A guard whose removal leaves 66/66 green is code no test protects.

| Mutation | Tests killed |
| -------- | ------------ |
| `requireVocabulary` disabled | 11 |
| `requireCoverage` disabled | 4 |
| `requireCumulativity` disabled | 1 |
| `requireDistinctRanks` disabled | 1 |
| `schemaVersion` accepts any number | 1 |
| `threshold-on-scale` ordinal-value check removed | 2 |
| `threshold-on-scale` numeric-min check removed | 2 |
| `threshold-on-scale` member-on-scale check removed | 2 |
| `threshold-on-scale` set-scale mismatch check removed | 1 |
| `reachesOrExceeds` ordinal branch → `true` | 1 |
| `Object.hasOwn` **and** `Object.create(null)` both removed | 7 |
| **`requireDistinctIds` → no-op** | **0** |
| **`Number.isFinite` dropped from `requireNumber`** | **0** |
| **`reachesOrExceeds` set branch → `true`** | **0** |
| **`reachesOrExceeds` numeric branch → `true`** | **0** |
| **`Object.hasOwn` removed from `scale-comparison.ts`** | **0** |
| **`threshold-on-scale` needs-`includes` check removed** | **0** |
| **`sentence()` capitalisation dropped** | **0** |
| `Object.hasOwn` removed from the adapter alone | 0 — the other defence covers it |
| `Object.create(null)` → `{}` alone | 0 — the other defence covers it |

The last two rows are not gaps: the two defences are deliberately redundant and either alone holds the behaviour, which is why removing both is what fails.

### The naming rule versus the settled decision — recommendation

The open tension is real and one of the two must move. **Change the rule, not the file.**

| Argument | Weight |
| -------- | ------ |
| `1-file-naming.md:13-15` already says a suffix "names the architectural role" and must be named "after the role played". The role here is *driven adapter*: it converts an external format on disk into a domain value. That role exists whether or not an interface type has been extracted. Defining `.adapter.ts` as "a concrete **port** implementation" makes the suffix name a TypeScript artefact, which is the thing the rule's own placement section forbids | decisive |
| The mechanical wall is already drawn around the **folder**, not around port implementations. `assessment-composes-never-adapts` forbids `^src/assessment/` → `^src/[^/]+/adapters/`, and `domain-has-no-vendor-sdk` licenses `yaml` and `node:fs` only outside `models\|usecases\|contracts\|engine`. Renaming the file either moves it out of the only folder where the parser is legal, or leaves a file in `adapters/` without the suffix — the wall and the naming rule would then disagree | decisive |
| `no-orphans` already exempts `contracts/` and `ports/` on exactly the reasoning the plan used to defer the port: a boundary is legitimately unbound until its consumer lands. The rule set tolerates a boundary that precedes its consumer everywhere except in this one sentence | strong |
| Cost: widening the rule is one line. Renaming costs a `git mv`, three memory files that now name `yaml-maturity-model.adapter.ts` (`architecture.md`, `codebase-map.md`, `testing.md`), the naming example in `codebase-map.md`, and leaves the project with no suffix at all for "outbound implementation whose interface has not been extracted yet" — the state every driven adapter starts in | strong |

Proposed wording for `1-file-naming.md:22`: *`.adapter.ts` a concrete implementation of an outbound boundary; it implements a `.port.ts` when one exists.*

This is the user's call and nothing was edited.

### Summary

| Metric | Value |
| ------ | ----- |
| Verified | 100% (7/7 criteria, 10/10 previous findings) |
| Files checked | `src/maturity/adapters/yaml-maturity-model.adapter.ts`, `src/maturity/models/threshold-on-scale.ts`, `src/maturity/models/invalid-maturity-model.error.ts`, `src/maturity/models/maturity.model.ts`, `src/maturity/engine/scale-comparison.ts`, `src/maturity/engine/maturity-engine.ts`, `tests/maturity/yaml-maturity-model.adapter.test.ts`, `tests/maturity/aidd-model.test.ts`, `tests/maturity/maturity-engine.test.ts`, `aidd_docs/memory/architecture.md`, `aidd_docs/memory/codebase-map.md`, `aidd_docs/memory/testing.md`, `.dependency-cruiser.cjs`, `.claude/rules/**` |
| Unchecked | none |
| Unplanned | none — every changed file traces to a phase task or a previous finding |
| Score | 0.82 |
