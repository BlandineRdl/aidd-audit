# Review 4: load a maturity model the engine can safely evaluate

- **Verdict**: approved — no blocking finding. Eight minors, none touching shipped behaviour.
- **Diff**: `4c199ef..1a6b52f` (three commits: `786170b` loader, `fc3fceb` comment rule, `1a6b52f` memory)
- **Axes run**: code, behavior versus plan, relevancy
- **Rules read**: `0-use-cases.md`, `0-public-contracts.md`, `1-boy-scout.md`, `1-clean-code.md`, `1-file-naming.md`, `2-typescript-domain-modeling.md`, `.dependency-cruiser.cjs`
- **Date**: 2026_08_28
- **Score**: 0.95
- **Note**: the `.adapter.ts` naming tension is settled and deliberately not re-reported.

---

## Part A — review-3's five repairs, re-verified independently

Each was re-tested by neutering the guard and reading which test dies, never by reading the test.
Control first: **137 tests / 7 files passed** unmutated, and a comment-only mutation correctly
SURVIVED — the harness distinguishes survival from death, so review-3's reporter-name failure mode
is excluded.

| # | Repair claimed | Status | Independent evidence |
| - | -------------- | ------ | -------------------- |
| 1 | Non-finite `min` refused | **closed** | `T5` (drop `!Number.isFinite(requirement.min)` from `threshold-on-scale.ts:48`) kills **3**: `refuses a minimum of NaN` / `of Infinity rather than scoring it NOT_MET`, **and** the engine-side `refuses a non-finite minimum on a numeric axis`. The check also *moved* — out of `requireRequirement` and into the shared rule — so the loader and the engine now enforce it identically. That closes review-3's suggestion 4, which the diff never claimed |
| 2 | Cumulativity pinned on all three arms | **closed** | `MC17` set → `true` kills only `rejects a dip on a set axis…`; `MC19` numeric → `true` kills only `…on a numeric axis…`; `MC21` ordinal → `true` kills only `…on an ordinal axis…`. One mutation, one test, no overlap. The fixture's numeric `parallelism` axis is present (`maturity-model-document.fixture.ts:56`) and is what makes the numeric arm reachable |
| 3 | Non-finite-rank tests assign real `NaN`/`Infinity` | **closed** | `SH4b` (revert `requireNumber` to `typeof value !== 'number'` — the exact revert that left 66/66 green in review-2) kills **3**. Verified the serialisation directly, not through the guard: `YAML.stringify` emits `rank: .nan` and `rank: .inf`, and `YAML.parse` returns a real `NaN`. The `expect(source).toMatch(/rank: -?\.(nan\|inf)/)` guard-the-guard sits at `:234`, before the parse |
| 4 | `requireDistinctIds` has tests for both id lists | **closed** | `SH21` (no-op the body) kills **2**: `refuses two axes sharing an id`, `refuses two levels sharing an id`. The two call sites are independently held: `SH12` kills the axes test alone, `SH15` the levels test alone. Both assert the message (`'axes' declares 'size' more than once`) as well as the class |
| 5 | Engine's `Object.hasOwn` pinned | **closed** | `SC3` (revert `scale-comparison.ts:43` to the bare index) kills `maturity-engine.test.ts > refuses an axis whose scale only resolves off Object.prototype` |

### Regressions from the three-way source split and the four-way test split

**None.** Verified mechanically, not by reading:

- **Source**: every one of the 25 functions in `647265d`'s `yaml-maturity-model.adapter.ts` survives in the split, and 23 of 25 bodies are **byte-identical** after comment stripping. The two that differ are the two intended repairs — `loadMaturityModel` now delegates to `readModelFile`, and the finiteness check left `requireRequirement` for the shared rule. One function was added (`readModelFile`). Nothing else moved.
- **Tests**: all 41 test titles from the old single suite are present in the split, and a set-diff of every `toThrow` / `toMatch` line shows **zero assertions lost** and **33 added** (50 → 83). No assertion was narrowed.
- **Engine suite**: two tests added, none removed. The new `refuses a min threshold on a set-scaled axis, capitalising its own sentence` asserts a full anchored message (`/^Axis 'harness' is a set scale and needs 'includes'\.$/`) — which is what `T7` now kills, giving `sentence()` the witness review-2 and review-3 both asked for.
- **Engine messages** are byte-identical to `4c199ef` on all five branches; `sentence('')` restores the capitalisation the extraction would otherwise have dropped.
- **Boundary rules**: `assessment-composes-never-adapts` was widened to `^src/[^/]+/(adapters|loading)/` and given its own sentinel. Proven to bite: narrowing the rule back to `(adapters)` makes `prove-boundary-rules.mjs` fail with `assessment-composes-never-adapts (src/assessment/usecases/__boundary-sentinel__loading.ts)`. This is exactly the hole `coding-assertions.md`'s new paragraph describes, and it is closed.

---

## Part B — the complete mutation census

68 single-guard runs (67 guards + 1 control), then 12 combined runs, then every survivor re-run
against `tsc` and `depcruise`. Tree restored and `git status --porcelain` empty after **every** run.

**54 killed by the test suite. 13 survived it. Of those 13, 8 are killed by `tsc`.**
Four remain, and none is a coverage gap: three are deliberate redundancy, one is message text only.

Compare review-3: 22 survivors out of 61, of which 15 were live reachable guards no test protected.
**All fifteen are now killed by a named test.**

### Full census

| # | Mutation | File | Tests killed | Verdict |
| - | -------- | ---- | ------------ | ------- |
| CTRL | control: comment-only edit (must survive) | `model-shape.ts` | 0 | SURVIVED (expected — validates the harness) |
| L1 | `readFileSync` wrapped in `InvalidMaturityModelError` | `load-maturity-model.ts` | 2 | killed |
| L2 | `YAML.parse` wrapped in `InvalidMaturityModelError` | `load-maturity-model.ts` | 1 | killed |
| L3 | `requireShape` stage call | `load-maturity-model.ts` | 25 | killed |
| L4 | `requireVocabulary` stage call | `load-maturity-model.ts` | 14 | killed |
| L5 | `requireCoverage` stage call | `load-maturity-model.ts` | 4 | killed |
| L6 | `requireCumulativity` stage call | `load-maturity-model.ts` | 3 | killed |
| SH1 | document must be a mapping | `model-shape.ts` | 2 | killed |
| SH2 | `schemaVersion === 1` | `model-shape.ts` | 1 | killed |
| SH3 | `requireNonEmptyString` | `model-shape.ts` | 1 | killed |
| SH4 | `requireNumber` (whole guard) | `model-shape.ts` | 4 | killed |
| SH4b | `requireNumber` finiteness only | `model-shape.ts` | 3 | killed |
| SH5 | `requireStringArray` | `model-shape.ts` | 1 | killed |
| SH6 | `'scales'` must be a mapping | `model-shape.ts` | 1 | killed |
| SH7 | `'scales'` non-empty | `model-shape.ts` | 1 | killed |
| SH8 | `Object.create(null)` for `scales` | `model-shape.ts` | 0 | **SURVIVED** — redundant by design (see below) |
| SH9 | a scale must be a mapping | `model-shape.ts` | 1 | killed |
| SH10 | unknown scale `kind` | `model-shape.ts` | 1 | killed |
| SH11 | `'axes'` non-empty array | `model-shape.ts` | 2 | killed |
| SH12 | `requireDistinctIds` on axes | `model-shape.ts` | 1 | killed |
| SH13 | an axis must be a mapping | `model-shape.ts` | 1 | killed |
| SH14 | `'levels'` non-empty array | `model-shape.ts` | 1 | killed |
| SH15 | `requireDistinctIds` on levels | `model-shape.ts` | 1 | killed |
| SH16 | a level must be a mapping | `model-shape.ts` | 1 | killed |
| SH17 | `'requirements'` must be an array | `model-shape.ts` | 1 | killed |
| SH18 | a requirement must be a mapping | `model-shape.ts` | 1 | killed |
| SH19 | exactly one of `min` / `includes` | `model-shape.ts` | 1 | killed |
| SH20 | `min` must be a string or a number | `model-shape.ts` | 2 | killed |
| SH21 | `requireDistinctIds` body | `model-shape.ts` | 2 | killed |
| SH22 | `isRecord` excludes arrays | `model-shape.ts` | 1 | killed |
| SH23 | `describeType` names a non-finite number | `model-shape.ts` | 0 | **SURVIVED** — finding 5 |
| MC1 | Vocabulary `Object.hasOwn` on `scales` | `model-consistency.ts` | 0 | **SURVIVED** — redundant by design |
| MC2 | Vocabulary undeclared-scale throw | `model-consistency.ts` | 8 | killed |
| MC3 | Vocabulary skip-unknown-axis `continue` | `model-consistency.ts` | 1 | killed |
| MC4 | Vocabulary `requireThresholdOnScale` call | `model-consistency.ts` | 6 | killed |
| MC5 | Coverage `requireDistinctRanks` call | `model-consistency.ts` | 1 | killed |
| MC6 | Coverage undeclared-axis throw | `model-consistency.ts` | 1 | killed |
| MC7 | Coverage axis-omitted throw | `model-consistency.ts` | 1 | killed |
| MC8 | Coverage axis-twice throw | `model-consistency.ts` | 1 | killed |
| MC9 | `requireDistinctRanks` body | `model-consistency.ts` | 1 | killed |
| MC10 | Cumulativity `Object.hasOwn` on `scales` | `model-consistency.ts` | 0 | **SURVIVED** — redundant by design |
| MC11 | Cumulativity undefined-scale filter | `model-consistency.ts` | 0 | survived vitest, **killed by `tsc`** (TS2345) |
| MC12 | Cumulativity sorted-pair undefined guard | `model-consistency.ts` | 0 | survived vitest, **killed by `tsc`** (TS2345) |
| MC13 | `requireNoDip` unknown-scale `continue` | `model-consistency.ts` | 0 | survived vitest, **killed by `tsc`** (TS2345) |
| MC14 | `requireNoDip` missing-requirement `continue` | `model-consistency.ts` | 0 | survived vitest, **killed by `tsc`** (TS2345) |
| MC15 | `requireNoDip` dip throw | `model-consistency.ts` | 3 | killed |
| MC16 | `reachesOrExceeds` set-branch shape mismatch | `model-consistency.ts` | 0 | survived vitest, **killed by `tsc`** (TS2339) |
| MC17 | `reachesOrExceeds` set comparison | `model-consistency.ts` | 1 | killed |
| MC18 | `reachesOrExceeds` numeric-branch shape mismatch | `model-consistency.ts` | 0 | survived vitest, **killed by `tsc`** (TS2339) |
| MC19 | `reachesOrExceeds` numeric comparison | `model-consistency.ts` | 1 | killed |
| MC20 | `reachesOrExceeds` ordinal-branch shape mismatch | `model-consistency.ts` | 0 | survived vitest, **killed by `tsc`** (TS2339) |
| MC21 | `reachesOrExceeds` ordinal comparison | `model-consistency.ts` | 1 | killed |
| MC22 | `reachesOrExceeds` exhaustive `default` | `model-consistency.ts` | 0 | **SURVIVED the whole gate** — finding 1 |
| T1 | `includes` on a non-set scale | `threshold-on-scale.ts` | 1 | killed |
| T2 | set member on scale | `threshold-on-scale.ts` | 2 | killed |
| T3 | a set scale needs `includes` | `threshold-on-scale.ts` | 2 | killed |
| T4 | numeric `min` must be a number | `threshold-on-scale.ts` | 1 | killed |
| T5 | numeric `min` must be finite | `threshold-on-scale.ts` | 3 | killed |
| T6 | ordinal threshold on scale | `threshold-on-scale.ts` | 2 | killed |
| T7 | `sentence()` capitalisation | `threshold-on-scale.ts` | 1 | killed |
| SC1 | engine `requireThresholdOnScale` call | `scale-comparison.ts` | 6 | killed |
| SC2 | `scaleForAxis` `Unknown axis` throw | `scale-comparison.ts` | 0 | survived vitest, **killed by `tsc`** (TS18048) |
| SC3 | `scaleForAxis` `Object.hasOwn` | `scale-comparison.ts` | 1 | killed |
| SC4 | `scaleForAxis` `Unknown scale` throw | `scale-comparison.ts` | 1 | killed |
| SC5 | observation must be a member set | `scale-comparison.ts` | 1 | killed |
| SC6 | observed ordinal value on scale | `scale-comparison.ts` | 1 | killed |
| SC7 | observation must be numeric | `scale-comparison.ts` | 1 | killed |
| SC8 | `isMemberSet` `Array.isArray` | `scale-comparison.ts` | 1 | killed |

### Combined mutations — every "dead branch" claim tested, not assumed

| Case | Mutations | Result |
| ---- | --------- | ------ |
| C1 | `SH8` + `MC1` | **7 killed** — the two loader prototype defences are held as a pair |
| C2 | `SH8` + `MC1` + `MC10` + `SC3` | **8 killed** |
| C3 | `T3` + `MC16` | **2 killed** — review-3's smoking gun (73/73 green then) is closed |
| C4 | `T1` + `MC16` | 1 killed |
| C5 | `T4` + `MC18` | 1 killed |
| C6 | `T1` + `MC20` | 1 killed |
| C7 | `MC11` + `MC13` + `MC14` | survived vitest — but all three are individually killed by `tsc` |
| C8 | `MC7` + `MC14` | 1 killed |
| C9 | `MC4` + `MC16` + `MC18` + `MC20` | 6 killed |
| C10 | `SC2` + `SC4` | 1 killed |
| C11 | `MC1` + `MC10` (keeping `Object.create(null)`) | survived — either defence alone holds it, as review-2 read it |

### Where the four remaining survivors leave things

- **`SH8` / `MC1` / `MC10`** — three layers of the same prototype-chain defence inside the loader.
  Any two can go; all three together (C1/C2) fail 7–8 tests. Deliberate redundancy, confirmed, not a gap.
  The engine's fourth layer (`SC3`) is independently pinned.
- **`SH23`** — message text only. Finding 5.
- **`MC22`** — the census's one live mechanism that survives the entire gate. Finding 1.

The eight `tsc`-killed survivors settle review-2's finding 8 / review-3's Group 2 for good: those
`continue`s and shape-mismatch throws are **not** removable defensive noise. `noUncheckedIndexedAccess`
and the `LevelRequirement` union make each one load-bearing for compilation — deleting any of them
turns `pnpm check` red at `tsc`, before a test ever runs. They should stop being re-measured.

---

## Part C — challenge beyond the acceptance criteria

### `aidd.yml` under the final loader

Valid, and structural typos fail loudly. Six edits injected and reverted, `git status` clean after each:

| Injected edit | `pnpm check` |
| ------------- | ------------ |
| off-scale ordinal (`red` size `S` → `XS`) | **red** — `Test Files 2 failed \| 5 passed`, `Level 'red': threshold 'XS' is not on the 'size' scale.` at collection |
| cumulativity dip (`gold` size `L` → `M`) | **red** — 2 files failed |
| duplicate rank (`silver` `5` → `4`) | **red** — 2 files failed |
| misspelled set member (`behavior` → `behaviour`) | **red** — 3 tests failed |
| dropped axis (`green` loses `harness`) | **red** — 2 files failed |
| threshold drift (`copper` parallelism `3` → `2`) | **green — 137/137** |
| label drift (`Gold` → `Platinum`) | **green — 137/137** |

The last two are the known limit `testing.md` is honest about ("indirectly, through those reference
points"), unchanged by this diff — but the PR body overstates it. See finding 4.

### Did the splits lose anything?

No. Proven mechanically in Part A: 23 of 25 function bodies byte-identical, the two exceptions being
the two intended repairs; zero assertions dropped, 33 added; all 41 test titles carried over.

### Did stripping the comments remove anything a reader needs?

Twelve comment blocks changed. Eleven removals are correct under the rule `fc3fceb` added — section
banners restating function names, a docblock paraphrasing `architecture.md:97`, and history clauses.
The information in each survives in code, in a reworded comment, or in `architecture.md` /
`codebase-map.md`. **One removal is a genuine loss** — finding 1.

### Memory and rules versus the code

`architecture.md` is accurate throughout, including the claim at `:119` that the loader rejects a dip
before the engine sees the model (verified: `MC15`/`MC17`/`MC19`/`MC21` all kill). `coding-assertions.md`'s
new paragraph on path-scoped rules is true and its remedy is implemented and proven to bite.
Three inconsistencies remain — findings 3, 6 and 7.

### Adversarial documents (twelve, beyond the prior reviews')

Rejected correctly: an empty ordinal vocabulary; `rank: -0` colliding with `rank: 0`.
Accepted and **correct**: a scale genuinely keyed `__proto__`; an axis id of `constructor` and a level
id of `__proto__` (every lookup is a `Map` or a `Set`); negative and fractional ranks; `rank: 1e308`;
unknown top-level keys dropped; an empty set vocabulary with an empty `includes` (same shape as White's,
upheld by review-3). Accepted and **noted**: duplicate ordinal `values` and duplicate set `members` —
finding 8.

### Is the PR body accurate?

Almost entirely. Every number checks out exactly — 137 tests / 7 files, `no dependency violations
found (20 modules, 36 dependencies cruised)`, `8 boundary rules proven with 16 deliberate violations`,
`pnpm build` red on `Cannot find cli: src/cli/assess.command.ts`. The `(adapters|loading)` widening and
its sentinel are real and proven. All seven acceptance-criterion claims hold. One sentence does not —
finding 4.

---

## Findings

| Sev | Kind | Location | Issue | Fix |
| --- | ---- | -------- | ----- | --- |
| 🟢 | code | `src/maturity/loading/model-consistency.ts:161-164` | **The only live mechanism in the feature that survives the entire gate, and the comment naming it was removed by this diff.** Replacing the `default` branch's `const exhaustive: never = scale; throw …` with `return true` passes `tsc`, passes `vitest` 137/137, and passes `depcruise` — the whole of `pnpm check` stays green (case `MC22`). The mechanism is real: adding a fourth `Scale` kind to `maturity.model.ts` today fails with `model-consistency.ts(162,13): error TS2322: Type 'RatioScale' is not assignable to type 'never'`. So it is enforced, but only against a change nobody has made yet, and `786170b` deleted the one comment that said so — the old `reachesOrExceeds` docblock read "a fourth scale kind must fail to compile here (the `never` assignment in `default`)". Its replacement covers the branch-throw polarity and says nothing about the `default`. A future reader simplifying `default` to `return true` gets a green gate and silently loses the exhaustiveness contract; a ratio-scaled axis would then be cumulativity-approved unconditionally. This is the one place where the rule the diff added ("do not repeat information already stated by code") was applied to something the code does *not* state on its own. | One line above the `default`, or make it a `satisfies never` the reader cannot mistake for dead code. |
| 🟢 | test | `tests/maturity/maturity-model-shape.test.ts:9-10`, `tests/maturity/maturity-model-validation.test.ts:6,8-9` | **Five dead imports, introduced by the four-way test split.** The old single suite used `validDocument`, `validSource` and `mutateShape`; each half of the split copied the whole import block and neither uses all of it. Proven, not read: `tsc --noEmit --noUnusedLocals` reports exactly five `TS6133`s, all in these two files. Nothing in the gate can see them — `noUnusedLocals` is not in `tsconfig.json` and Biome's linter is deliberately off, so `typecheck`, `test`, `architecture` and `format:check` are all green over dead code. `1-clean-code.md` governs `tests/**/*.ts`. | Delete the five names from the two import lists. Optionally add `noUnusedLocals` to `tsconfig.json`, which costs nothing and closes the class. |
| 🟢 | fit | `src/maturity/models/threshold-on-scale.ts:5-7`, `src/maturity/loading/model-consistency.ts:127-128` | **Two shipped comments state history, contradicting the rule this same PR adds.** `fc3fceb` added to `1-clean-code.md`: "Comments describe the current invariant or reason, never the history of how the code arrived there." `threshold-on-scale.ts` opens "two copies of this rule **drifted apart once**, and the engine **went on scoring** models the loader would have refused"; `model-consistency.ts` reads "**returning `true` here once let** a dipping model pass". Both narrate a past defect. The commit message for `fc3fceb` says it removed "one comment describing a fix rather than an invariant" — two of the same shape stayed. Each has a good invariant underneath it (the rule must be shared; the polarity must be "refuse"), so this is a rewrite, not a deletion. | Restate both as the invariant: "One definition, shared by the loader and the engine: a second copy would let the engine score what the loader refuses." / "A shape mismatch must throw; the permissive answer would accept a dip." |
| 🟢 | doc | PR #3 body, "What lands" | **"A one-character typo in `aidd.yml` turns `pnpm check` red at collection" is false for a real class of one-character typos.** Verified: `copper`'s `parallelism: min: 3` → `min: 2` is one character, silently redefines Copper for every repository AIDD will ever assess, and leaves `pnpm check` at **137/137 green**; `label: Gold` → `Platinum` likewise. Five *structural* typos do go red, at collection, with the loader's own sentence — that part is exact. `testing.md:104` already says the conformance test holds the model "indirectly, through those reference points", so the code is honest and only the PR body outruns it. Not a code defect; the PR is the artefact the reviewer of record reads. (Minor, same paragraph: "15 shape guards, one test each" understates — the shape suite runs 21 tests and this census kills 22 of the 24 mutations over `model-shape.ts`.) | Scope the sentence to structural typos, e.g. "a structural typo in `aidd.yml` turns `pnpm check` red at collection; a threshold value that stays valid and cumulative is not pinned." |
| 🟢 | code | `src/maturity/loading/model-shape.ts:241` | **`describeType`'s non-finite branch is live, reachable and held by nothing** (case `SH23`: full gate green without it). It is the only thing that makes the rank message name the value: with it, `'level 'high'.rank' must be a finite number, got NaN.`; without it, `got a number.` — the message that tells an operator nothing. Review-1's finding 4 settled that naming the value is this project's standard (`got 7`), and `SH2`'s test enforces exactly that for `schemaVersion`. The three rank tests assert only `/rank' must be a finite number/`. | Extend one of the three `it.each` rank cases to `expect(run).toThrow(/got (NaN\|Infinity\|-Infinity)/)`. One line, and it also gives `threshold-on-scale.ts:52`'s `String(requirement.min)` a sibling witness. |
| 🟢 | rot | `aidd_docs/memory/codebase-map.md:5`, `:32` | **Two memory files now openly disagree about whether `src/cli/` exists.** `architecture.md:5` was rewritten by this commit to say "the CLI's human renderer … exist"; `codebase-map.md:5` still says "`src/cli/` are still planned" and `:32` "`src/cli/` **(planned)**". `src/cli/renderers/human.renderer.ts` and its 33 tests are in the tree. The rot predates this diff — both lines are already at `4c199ef`, added by `594e632` — so it is not this feature's defect; but fixing one side and not the other is what made the contradiction visible, and memory loads as instructions in every session. `aidd_docs/memory/cli.md:5` ("No `src/` yet") carries the same defect, as review-1 and review-2 both noted and left out of scope. | One line in each: name the human renderer as written and the `assess` command as owed. Same edit `architecture.md` already received. |
| 🟢 | rot | `aidd_docs/INSTALL.md:258` | **The frozen target tree was half-updated inside a hunk this diff edited.** The commit renamed `yaml-maturity-model.adapter.ts` → `load-maturity-model.ts` in the folder-structure block but left it under `└── adapters/`, so INSTALL.md's target layout now contradicts both the code and `architecture.md:34` ("the loader is therefore **not** an adapter … It lives in `loading/`") — which the same commit wrote. `codebase-map.md:5` points readers at this block as the authoritative target layout. The neighbouring `ports/maturity-model.port.ts` is fine: `architecture.md` says the port arrives with its consumer, so it belongs in a target tree. | Change `adapters/` to `loading/` on that one line. |
| 🟢 | code | `src/maturity/loading/model-shape.ts:91-117` | **Scale vocabularies are the only id list with no distinctness check** — carried from review-2's finding 10, unfixed and never declined in writing. `values: [S, L, S]` and `members: [a, a, b]` are both accepted; `indexOf` silently resolves the first occurrence, making the later one dead. Distinctness *is* enforced for axis ids (`SH12`), level ids (`SH15`) and ranks (`MC9`), so this is an inconsistency in the guard set rather than a soundness hole. One correction to review-2's stated impact, which I could not reproduce: it claimed `[L, S, L]` "makes `min: S` rank *above* `min: L`" — it does, but only because `L` was written first, exactly as a deliberate `[L, S]` would; both `reachesOrExceeds` and `reachesOrdinalRank` read the same table, so the model stays internally self-consistent and no dip escapes. The real cost is a silently ignored vocabulary entry, not an inverted order. | `requireStringArray` gains a distinct-members variant, or `requireScale` calls `requireDistinctIds` on `values` / `members`. Low priority given the corrected impact. |

### Carried forward, not a finding

Review-3's third suggestion is unaddressed and still true. Re-verified on hand-built models
(temporary test file, since removed): a dip returns `proven = high, next = null`; duplicate ranks and
a `NaN` rank do the same; only an omitted axis is refused. `contract.md` deliberately scoped the
engine's throws to a per-requirement backstop, so this is not a criterion left unmet — but
`architecture.md:119` now says cumulativity is "rejected before the engine ever sees the model"
without naming that this holds only for models that came through the loader, and `codebase-map.md:29`'s
"the guards that refuse an invalid hand-built model" reads broader than what `checkMaturity` does.
When `assessment` lands, "the model came through the loader" becomes an unenforced convention.
One line in `architecture.md` naming what the backstop does *not* cover would close it.
Also still true and still out of scope: both suites load `'aidd.yml'` by a cwd-relative literal.

---

## Verification

| Item | How |
| ---- | --- |
| Gate | `pnpm check` equivalent run at the start and end. `tsc` clean · `vitest` **137 passed (137)**, 7 files · `depcruise` **no violations (20 modules, 36 dependencies)** · `prove-boundary-rules` **8 rules proven with 16 deliberate violations**. `git status --porcelain` empty both times |
| Control | Unmutated suite confirmed green **before** the census, and a comment-only mutation confirmed to SURVIVE — review-3's reporter-name failure mode is excluded |
| Census | 68 single-guard runs + 12 combined runs, `--reporter=dot`, tree restored and `git status --porcelain` asserted empty after **every** run by the harness itself |
| Survivors | All 13 re-run against `tsc --noEmit` and `depcruise src`; 8 killed by `tsc` with the error quoted |
| Compile-time claims | `noUncheckedIndexedAccess` and the exhaustiveness `never` each verified by a targeted edit (`MC12` → TS2345; a fourth `Scale` kind → TS2322), both reverted |
| Split integrity | Function-body diff old-vs-new after comment stripping (23/25 byte-identical); set-diff of every `toThrow`/`toMatch` line (0 lost, 33 added); test-title diff (0 lost) |
| `aidd.yml` | 7 injected edits, each reverted, `pnpm check` run on each |
| Adversarial | 12 documents parsed in a temporary test file, since removed |
| Engine backstop | 4 hand-built-model probes in a temporary test file, since removed |
| Boundary rule | The new `loading/` sentinel proven to bite by narrowing the rule back to `(adapters)` and watching it fail; config restored |
| Dead imports | `tsc --noEmit --noUnusedLocals`, five `TS6133`s |
| PR body | `gh pr view 3`, every number re-measured. Not edited |
| Nothing changed | No file in `src/`, `tests/`, `aidd.yml`, `.dependency-cruiser.cjs` or `aidd_docs/memory/` was left modified. This report is the only file written |

### Acceptance criteria

| # | Criterion | Verdict | Evidence |
| - | --------- | ------- | -------- |
| 1 | Canonical `aidd.yml` returns a `MaturityModel` | ✅ fulfilled | Two suites load it through `loadMaturityModel`; four axes, seven distinct ranks, Copper-shaped repository graded Copper. `L3` kills 25 tests |
| 2 | Malformed model data is rejected | ✅ fulfilled | **Upgraded from ⚠️ in reviews 2 and 3.** 24 mutations over `model-shape.ts` (`SH1`–`SH23`, plus `SH4b`), **22 killed** by a named test; the two survivors are `Object.create(null)` (redundant, C1 kills 7) and `describeType`'s message branch (finding 5). Review-3's 13 silently-deletable shape guards are all pinned |
| 3 | Thresholds outside their axis vocabulary are rejected | ✅ fulfilled | `T1`–`T6` all killed; `T2`, `T3`, `T6` kill one loader test **and** one engine test each, so both callers of the shared rule are held. `MC4` kills 6, `SC1` kills 6 |
| 4 | Requirements targeting undeclared axes are rejected | ✅ fulfilled | `MC6` kills its test, `/ghost-axis/` named; `MC3` kills it too, so the `continue` review-1 flagged is now load-bearing and pinned |
| 5 | Every level must cover every declared axis | ✅ fulfilled | `MC7` (omission) and `MC8` (duplication) each kill their own test |
| 6 | Levels must be cumulative | ✅ fulfilled | **Upgraded from ⚠️ in reviews 2 and 3.** `MC15` kills 3; `MC17`/`MC19`/`MC21` kill one distinct test each — set, numeric and ordinal arms independently held. `MC5`/`MC9` hold distinct ranks, `SH4b` holds finite ranks |
| 7 | No production path relies on `YAML.parse(...) as MaturityModel` | ✅ fulfilled | `grep -rn "as MaturityModel" src/ tests/` exits 1. `YAML` and `node:fs` appear nowhere in `src/` outside `loading/`; `depcruise` agrees |
| — | Contract constraint: rejection is a sentence, not a stack trace | ✅ fulfilled | Review-3's deal breaker. `readModelFile` wraps `readFileSync`; `L1` kills 2 tests asserting the class, the path and `ENOENT` |

### Summary

| Metric | Value |
| ------ | ----- |
| Verified | 100% — 7/7 criteria, 1/1 contract constraint, 5/5 review-3 repairs, 67/67 guards mutated |
| Mutation census | 68 single + 12 combined runs. 54 killed by tests, 8 more by `tsc`, 3 redundant by design, 1 message-only, 1 gate-surviving (finding 1) |
| Files checked | `src/maturity/loading/*.ts`, `src/maturity/models/threshold-on-scale.ts`, `src/maturity/models/maturity.model.ts`, `src/maturity/models/invalid-maturity-model.error.ts`, `src/maturity/engine/scale-comparison.ts`, `src/maturity/engine/maturity-engine.ts`, all four `tests/maturity/` suites and both fixtures, `aidd.yml`, `.dependency-cruiser.cjs`, `scripts/prove-boundary-rules.mjs`, `aidd_docs/memory/**`, `aidd_docs/INSTALL.md`, `.claude/rules/**`, PR #3 |
| Unchecked | none |
| Unplanned | none — every changed file traces to a phase task, a prior finding, or the two documentation commits |
| Blocking findings | 0 |
| Score | 0.95 |
