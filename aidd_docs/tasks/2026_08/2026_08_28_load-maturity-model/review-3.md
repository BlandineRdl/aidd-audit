# Review 3: load a maturity model the engine can safely evaluate

- **Verdict**: changes-requested (no regression, one contract constraint unmet, a measured coverage floor)
- **Diff**: `d6c3ddb..647265d` (three commits: `02431fc` loader, `733ad17` prototype fix, `647265d` test hardening)
- **Scope**: Part A — re-verify review-2's six repairs, hunt regressions, mutate every guard in the feature. Part B — challenge the outcome against `contract.md`.
- **Date**: 2026_08_28
- **Score**: 0.90
- **Note**: the `.adapter.ts` naming-rule tension is the user's open call and is deliberately not re-reported.

---

## Part A — repairs re-verified, regressions hunted, guards mutated

### Gate, re-run independently

```
$ pnpm check
$ tsc --noEmit                                     (clean)
$ vitest run           Test Files 3 passed (3) · Tests 73 passed (73)
$ depcruise src        ✔ no dependency violations found (16 modules, 27 dependencies cruised)
$ prove-boundary-rules ✔ 10 boundary rules proven against deliberate violations
```

Matches the expected 73 / 0 / 16-27 / 10 exactly. `git status --porcelain` empty before and after every mutation in this review.

### The six claimed repairs — each re-tested, not read

Every one is closed, and each is held by the test that names it. Attribution was obtained by neutering the guard and reading which test dies, not by reading the test.

| # | Repair | Status | Killing test (mutation → failure) |
| - | ------ | ------ | --------------------------------- |
| 1 | Non-finite `min` refused | **closed** | Dropping `if (typeof min === 'number' && !Number.isFinite(min))` kills **2**: `a threshold that is not a finite number > refuses a minimum of NaN / of Infinity rather than scoring it NOT_MET` |
| 2 | Cumulativity pinned on all three arms | **closed** | `set branch → true` kills `rejects a dip on a set axis…`; `numeric branch → true` kills `rejects a dip on a numeric axis…`; `ordinal branch → true` kills `rejects a dip on an ordinal axis…`. One mutation, one test, no overlap — the three arms are independently held |
| 3 | Non-finite-rank tests no longer vacuous | **closed** | Reverting `requireNumber` to `typeof value !== 'number'` — the exact revert that left 66/66 green in review-2 — now kills **3**: `refuses a rank of NaN / Infinity / -Infinity`. The `expect(source).toMatch(/rank: -?\.(nan\|inf)/)` guard-the-guard is present at `:378` and asserts the serialized YAML before parsing |
| 4 | `requireDistinctIds` under test | **closed** | No-op'ing the function kills **2**: `refuses two axes sharing an id`, `refuses two levels sharing an id`. Both assert the message (`'axes' declares 'size' more than once`) as well as the class |
| 5 | Engine's `Object.hasOwn` pinned | **closed** | Reverting `scale-comparison.ts:45` to the bare `model.scales[axis.scale]` kills `maturity-engine.test.ts > refuses an axis whose scale only resolves off Object.prototype` |
| 6 | Memory status lines corrected | **closed** | `architecture.md:5` now reads "`evidence` and `assessment` hold only their frozen boundaries …; `cli` has no file yet". `codebase-map.md:5` matches, **and** its mermaid was updated (`SRC["src/"]`, `MAT["maturity/ — implemented"]`, `EV["evidence/ — port + models only"]`, `AS["assessment/ — contract only"]`, `CLI["cli/ — planned"]`) — the internal contradiction review-2 flagged is gone. `architecture.md`'s Runtime-boundaries and "Levels are cumulative" sections were also rewritten to name the adapter as the enforcer; no "does not exist yet" claim survives anywhere in the file |

### Regressions

**None found.** Specifically on the `647265d` fixture change (a numeric `parallelism` axis added to the adapter test's `validDocument`):

- No pre-existing case changed which guard fires. `T2` (set-member check) still kills its two original tests, `T4` (numeric-min check) its two, `T5` (ordinal-value check) its two — one engine-side and one adapter-side each, as before.
- The pre-existing ordinal dip test was **strengthened**, not weakened: its assertion moved from `/size/` to `/'high' asks less than 'low' on axis 'size'/`, and `A35` (ordinal branch → `true`) still kills exactly that test and only that test.
- Test count reconciles exactly: 66 → 73 = +2 dips, +2 non-finite `min`, +2 distinct ids, +1 engine `hasOwn`.
- The `rejects a numeric-scale minimum that is not a number` case still fires from Vocabulary, not from Cumulativity — the comment at `:267-272` claims this and `T4` proves it.

### Mutation sweep — the complete survivor list

61 runs: 54 single-guard mutations across `yaml-maturity-model.adapter.ts`, `models/threshold-on-scale.ts` and `engine/scale-comparison.ts`, plus 1 control (a comment edit, which correctly SURVIVED, validating the harness) and 6 combined/corrected cases. 32 killed, 22 survived. Tree restored after each.

> A first sweep reported 54/54 killed. That was a harness defect — vitest 4 has no `basic` reporter, so every run failed at startup. It was caught by the control and re-run with `--reporter=dot`. The numbers below are from the valid run.

**Group 1 — live, reachable guards that no test protects (15).** Deleting any one of these ships an accepted-but-invalid model, and the suite stays green.

| Guard | Location | What now gets through |
| ----- | -------- | --------------------- |
| `requireNonEmptyString` | `adapter.ts:76-83` | every `id`, `label`, `axis.scale` and `requirement.axis` — a numeric or empty id passes |
| `requireStringArray` | `adapter.ts:100-108` | ordinal `values`, set `members`, `includes` of the wrong type |
| `scales` must be a mapping | `adapter.ts:111-113` | `scales: null` → raw `TypeError` from `Object.entries` |
| `scales` must be non-empty | `adapter.ts:115-117` | `scales: {}` |
| a scale must be a mapping | `adapter.ts:130-134` | `size: "ordinal"` |
| unknown scale `kind` | `adapter.ts:151-154` | `kind: fuzzy` |
| `axes` non-empty array | `adapter.ts:158-162` | `axes: []` / `axes: null` |
| an axis must be a mapping | `adapter.ts:173-177` | `axes: [3]` |
| a level must be a mapping | `adapter.ts:201-205` | `levels: ["red"]` |
| `requirements` must be an array | `adapter.ts:216-220` | `requirements: null` |
| a requirement must be a mapping | `adapter.ts:225-229` | `requirements: [null]` |
| exactly one of `min` / `includes` | `adapter.ts:234-238` | a requirement carrying **both** — `includes` silently wins, `min` is dropped without a word (verified separately as case `A20b`) |
| `min` must be a string or number | `adapter.ts:251-256` | `min: null`, `min: [1]` |
| **a set scale needs `includes`** | `threshold-on-scale.ts:38-42` | see below — this is the sharpest one |
| `sentence()` capitalisation | `threshold-on-scale.ts:58-61` | the engine-side message format, still asserted by nothing |

The **set-scale** entry deserves its own line. Review-2 flagged it (finding 9) and it was not fixed. Worse than "unpinned once": the combined mutation **C3** — removing the check in `threshold-on-scale.ts` **and** the `isSetRequirement` guard in `reachesOrExceeds`'s `set` branch, which is its documented second line of defence — leaves **73/73 green**. Both defences can be deleted together and nothing notices. The rule is live and correct today: a hand-built model with `min: 'prompts'` on a set axis throws `Axis 'h' is a set scale and needs 'includes'.` (verified directly). Nothing holds it there.

**Group 2 — dead or unreachable branches (5).** Unpinnable by construction; correct as written, but this is `1-clean-code.md`'s "no defensive checks in the core" and review-2's finding 8 territory.

| Guard | Why it cannot be reached |
| ----- | ------------------------ |
| `reachesOrExceeds` set-branch shape mismatch (`adapter.ts:425`) | `requireVocabulary` rejects the mismatch first — except when its own check is removed, which is case C3 above |
| `reachesOrExceeds` numeric-branch shape mismatch (`:433`) | same |
| `reachesOrExceeds` ordinal-branch shape mismatch (`:441`) | same |
| `requireCumulativity`'s `Object.hasOwn` (`adapter.ts:372`) | `requireVocabulary` already threw on an undeclared axis scale before this line runs — the comment at `:370-371` justifies a guard that is now unreachable |
| `scaleForAxis`'s `Unknown axis` throw (`scale-comparison.ts:37-39`) | `evaluateAxis` only ever passes `axis.id` values taken from `model.axes`, so `axis === undefined` cannot happen. Deleting the throw outright (case `S2b`) leaves 73/73 green |

**Group 3 — redundant by design, not gaps (2).** Confirmed, not assumed.

- `Object.create(null)` at `adapter.ts:122` alone → survives.
- `requireVocabulary`'s `Object.hasOwn` at `adapter.ts:302` alone → survives.
- **Both together (case C1/C2) → 7 tests fail.** The pair is held; either alone is covered by the other. Review-2's reading is correct.

**Guards that bite (32 killed).** Including: YAML-parse wrapping, `requireShape`'s `isRecord`, `schemaVersion === 1`, `requireNumber` (both arms), `requireLevels`, the finite-`min` check, `requireDistinctIds`, `requireDistinctRanks`, all three `requireVocabulary` responsibilities, all three `requireCoverage` responsibilities, all three cumulativity arms, `requireNoDip`, all three `parseMaturityModel` stage calls, four of the five `threshold-on-scale` rules, and every engine-side observation guard (`S1`, `S3`, `S4b`, `S5`, `S6`, `S7`).

### Where this leaves AC2 and AC3

Both are met **in behaviour** — every case above is rejected by the running code, verified by direct invocation. Both are **under-pinned in tests**: AC2 ("malformed model data is rejected") leans on 13 shape guards that a future edit can delete silently, and AC3 ("thresholds outside their axis vocabulary are rejected") has one whole rule — a `min` on a set axis — with zero protection in either of its two implementations.

---

## Part B — challenge

My confidence level of correctness now: 72%

# Correctness (100%)

- **All seven acceptance criteria hold in behaviour, and five of the seven are held by a test that demonstrably bites.** AC1: both suites load the canonical file through `loadMaturityModel` and grade a Copper-shaped repository at Copper. AC4: `requireCoverage` disabled kills 4 tests. AC5: omitted-axis and axis-named-twice each kill their own test. AC6: all three arms independently killed. AC7: `grep -rn "as MaturityModel" src/ tests/` returns nothing; the only `YAML.parse` and `node:fs` in `src/` sit in the adapter, and `depcruise` agrees. AC2 and AC3 hold in behaviour but are partly unpinned — Part A, Group 1.
- **`aidd.yml` is still valid under the finished loader, and structural typos fail loudly.** Four injected typos, each reverted: an off-scale ordinal threshold (`red` `min: XS`), a cumulativity dip (`gold` size `L→M`), a duplicate rank (`silver` `5→4`), a misspelled set member (`behaviour`). All four turn `pnpm check` red with `exit 1` and `Test Files 2 failed | 1 passed`. `aidd-model.test.ts` fails at collection on line 16 with the loader's own sentence — for example `Level 'red': threshold 'XS' is not on the 'size' scale.` Review-2's finding 7 (the module-scope load makes the `not.toThrow` case unable to fail independently) is literally still true and is harmless: the module-scope load *is* the check, and it is the thing that goes red.
- **`includes: []` at White was correctly left alone.** Review-2's finding 11 recommended rejecting an empty `includes`. `aidd.yml`'s White level requires exactly that (`harness: includes: []`), because White asks nothing of the harness while still requiring the axis to be `CONFIRMED`. Implementing that recommendation would have invalidated the shipped canonical model. Declining it was right, and it matches `testing.md`'s "one unobserved axis proves nothing at all".
- **Out of scope was respected, and nothing in scope was dropped.** No `maturity-model.port.ts` exists. `git diff --stat d6c3ddb 647265d` touches only `src/maturity/**`, `tests/maturity/**`, three memory files and the task folder — nothing in `evidence`, `assessment` or `cli`. `architecture.md` no longer promises the port; the promise moved as the plan said it would.
- **The engine backstop covers what the engine itself would silently misread.** Removing the `requireThresholdOnScale` call from `scale-comparison.ts` kills 4 tests; deleting the `Unknown scale` throw kills 1; every observation-type guard kills its own test. On a hand-built model with `min: 'prompts'` on a set axis, `checkMaturity` throws `InvalidMaturityModelError`, not the wrong error class.

# Deal breakers

- **A `--model` path that cannot be read escapes as a raw Node error, not a sentence.** `contract.md` constrains the loader: *"Rejection is `InvalidMaturityModelError`. The message names what is wrong, so a hand-edited `aidd.yml` or a `--model` file fails with a sentence, not a stack trace."* `loadMaturityModel` calls `readFileSync` unwrapped at `adapter.ts:23`. Verified: `loadMaturityModel('does-not-exist.yml')` throws a plain `Error` — `ENOENT: no such file or directory, open 'does-not-exist.yml'`, `instanceof InvalidMaturityModelError === false`; a directory throws `EISDIR: illegal operation on a directory, read`. A mistyped path is the single most likely `--model` failure an operator will ever produce, and it is the one that comes back as a stack trace. No acceptance criterion covers it — all seven are about *document* validity — which is exactly the intent-versus-bullets gap: the loader satisfies the seven bullets and misses the constraint written beside them. **The ambiguity is named rather than guessed:** "Rejection" can be read as rejecting a model *document*, in which case an I/O failure is out of the constraint's scope and this is a suggestion, not a deal breaker. That reading is defensible; it is the author's call. Under the literal wording it is a stated constraint left unmet, and it is three lines to close (wrap `readFileSync` and name the path). Fixable in place, no rework.

# Suggestions (enhancements only)

- **Close the two unpinned set-scale defences (`threshold-on-scale.ts:38-42` and `adapter.ts:425`).** Both can be deleted together with the suite staying at 73/73. One adapter case (a `min` requirement on a set-scale axis) and one engine case asserting the full message would hold both, and the second would give `sentence()`'s capitalisation its first witness. This is review-2's finding 9, unfixed, and it is the only *reachable* rule in the feature with no protection at all.
- **Give AC2 a floor.** Thirteen shape guards can be individually deleted with a green suite (Part A, Group 1). A single table-driven case list — one malformed document per guard, asserting the class and a fragment of the message — would cost roughly thirty lines and convert AC2 from "correct today" to "correct tomorrow". This is the third round in which this defect class is the finding; a mechanical enumeration ends it rather than another hand-picked sample.
- **The engine backstop does not cover the invariant the engine's own algorithm depends on.** `contract.md` scopes the engine's throws as "a backstop for hand-built models (tests today, `assessment` later)". Verified on a hand-built model: a dip (`low` asking more than `high`) is scored, not refused — `low = NOT_MET, high = MET, proven = high`. That is precisely the outcome `architecture.md` warns about: "a model that dipped would name a level whose predecessors are `NOT_MET` and 'highest proven level' would stop meaning what it says." A `NaN` rank likewise passes (`proven = high`, `next = null`). No production path reaches this today, and the contract deliberately did not ask for it — but when `assessment` lands, "the model came through the loader" becomes an unenforced convention. Worth one line in `architecture.md` naming what the backstop does *not* cover, so the later worktree cannot assume it does.
- **The non-finite-`min` fix landed in the adapter only, so the shared rule now enforces different things for its two callers.** `threshold-on-scale.ts:43-47` checks `typeof requirement.min !== 'number'` and stops; finiteness lives in `adapter.ts:263-268`. Verified: a hand-built model with `min: NaN` reaches `checkMaturity` and returns `NOT_MET` — the practice-gap-for-a-model-defect conflation `project-brief.md` calls the central failure mode, unchanged on the engine path. Review-2 offered both placements; the adapter-only choice is legitimate, but it sits under a docblock that says "one function, not two copies that could drift" — and the two callers now diverge on exactly this field. Either move `Number.isFinite` into the shared numeric branch, or amend that docblock to say what the shared rule does *not* cover.
- **`aidd.yml`'s thresholds themselves are not pinned — only its shape and four reference points.** Verified undetected, each reverted: `copper` parallelism `3 → 2` (still valid, still cumulative, and it silently redefines Copper for every real repository) and `gold`'s label `Gold → Platinum`. `testing.md` is honest that the conformance test works "indirectly, through those reference points", so this is a known limit rather than a surprise — but a value drift in the shipped model is a product change, and the file the product sells is currently held by four assertions. A snapshot of the seven levels' thresholds would close it in one test.
- **Both suites load the model by the cwd-relative literal `'aidd.yml'`.** That works because vitest runs from the repo root. Once `dist/cli.js` ships and an operator runs `aidd-audit assess /some/other/repo` from anywhere, the built-in model must resolve against the bundle, not the working directory. Out of this contract's scope — no CLI exists — but it is the second thing an operator hits after a bad `--model` path, and nothing in the tree records the decision yet.
- **Five dead defensive branches (Part A, Group 2).** Unreachable by construction and therefore unpinnable, in a file whose only job is to refuse. `scaleForAxis`'s `Unknown axis` throw can be deleted outright with the suite green. This is review-2's finding 8, carried forward a second time; either remove them or annotate each as deliberately unreachable, so the next reviewer stops re-measuring them.

---

## Verification

| Item | How |
| ---- | --- |
| Gate | `pnpm check` run at the start and end of this review, tree clean both times |
| Mutations | 61 runs, tree restored and `git status --porcelain` empty after each; a comment-only control confirmed the harness distinguishes survival from death |
| Attribution | Each of the six repairs traced to its killing test by name, not by reading the test |
| `aidd.yml` | 6 injected edits (4 structural, 2 silent-drift), each reverted; `git status --porcelain` empty afterwards |
| Engine backstop | 4 hand-built-model probes run in a temporary test file, since removed |
| Operator paths | 3 probes (missing file, directory, non-model JSON) run in a temporary test file, since removed |
| Nothing edited | No file in `src/`, `tests/` or `aidd.yml` was left modified. This report is the only file written |
