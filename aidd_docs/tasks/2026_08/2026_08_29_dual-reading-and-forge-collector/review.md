# Review: Two readings of maturity, and the forge collector that makes them observable

- **Verdict**: blocked
- **Diff**: `3da6bfe...0655e81`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_30
- **Findings**: 9 critical, 16 warning, 7 minor

## Phases

### Phase 1 — Silence the local artefact on size and parallelism

- [x] The constant carries a `LIMITATION:` block naming the cost of each direction and forbidding its lowering — `git-history.ts:13-26`
- [x] A squash-dominated history withholds both branch axes and reports intervention unchanged — `git-history.test.ts:642`
- [x] The suite fails when the guard is removed, pinned on both sides of the share — `git-history.test.ts:614` and `:627`
- [x] `cli.md` names three distinct reasons, only one expiring with age — `cli.md`

### Phase 2 — A GitHub forge collector, single reading

- [ ] A budget spent while gh is in flight surfaces as `TIMED_OUT`, and a gh failure names the command and its stderr — GAP: no budget is set at all (task 5.4 dropped at the merge); the only cancellation test aborts before the spawn, hitting the pre-flight `throwIfAborted`, which is the wrong-checkpoint failure `testing.md` records
- [x] A subject with no remote or another host produces no observation and no provenance failure — `repository-slug.test.ts:44-67`
- [x] The suite proves a second page is fetched and the window bounds the sample — `pull-request-history.test.ts:142`, `:189`, `:246`
- [ ] On the recorded payload the collector reports size M, intervention key-steps and parallelism 2 — GAP: no recorded payload exists; every fixture is synthetic and single-axis, and the bot exclusion since made the stated target stale without it being restated
- [x] One axis one source on a GitHub root, and a refusing forge exits 0 with FAILED provenance — `process-contract.test.ts:193`, `:224`

### Phase 3 — Settle the transcription of the Taille axis

- [ ] The parallelism distribution is recomputed over every pull request and the document says whether the figures moved — GAP: `measurements.md` still reads "Verification still owed"; `size-transcription.md` shows McTracker at 1/3 = 4 where `measurements.md` says 3, unreconciled
- [ ] At least two control repositories named, with their expected level written before measuring — GAP: three named, no expected level recorded for any; the four profiles are not recorded as the fifth control
- [ ] The document holds one N, the argument, the table it was checked against, and the note that the subject's shares sit just above a third — GAP: tabulated at one N, not three; the 39.8% / 40.0% proximity is never stated as the criterion demands
- [x] A run where no candidate survives ends the plan in writing rather than picking the convenient value — `size-transcription.md`

### Phase 4 — Two readings, from the observation to the contract

- [ ] An observation without a reading no longer compiles, and the three declarations agree on the names — GAP: first half holds (`observation.model.ts:33`); `vocabulary-conformance.test.ts` untouched and `DemonstrationUnit` is hand-duplicated under a comment saying the two must not drift
- [x] A sustained disagreement leaves the demonstrated value CONFIRMED — `resolve-evidence.test.ts:179`
- [x] A bundle-only assessment demonstrates what it proves — `reference-profiles.test.ts:20`, `:51`
- [ ] On the recorded forge payload the report carries proven Blue and demonstrated Copper — GAP: no forge payload is exercised end to end; the second `checkMaturity` call, the fallback and the clamp are proven only through bundle fixtures
- [x] A consumer reading only `proven` sees what it saw before — `assessment-report.contract.ts:124`, `json.renderer.ts:43`

### Phase 5 — Render two levels without inviting the higher one to be quoted alone

- [x] Prose naming a demonstrated level always names the proven level above it — `human.renderer.ts:16-21`, asserted `human.renderer.test.ts:590`
- [ ] No rendering path emits a demonstrated level without its share — GAP: the level line itself is shareless, and the test skips it by design (`slice(1)`); `axes` can be empty while `level` is non-null, rendering a bare level
- [x] Equal levels render exactly as before — `human.renderer.ts:57`, asserted `:620`
- [x] `--json` publishes the block and still refuses a non-finite number naming the path — `json.renderer.ts:43`, `:15`
- [x] `cli.md` states a demonstrated level is not held and never appears alone — `cli.md`

### Phase 6 — Teach the bundle format to carry a distribution

- [x] A bundle with no distribution assesses as before, with no fabricated second reading — `fixture-bundle.adapter.test.ts:185`
- [ ] A bundle whose distribution contradicts its median is refused, naming the inconsistency — GAP: `recorded-activity.ts:93` returns null silently; nothing is named, and the test asserts only the absence of observations, which a plain "ignored" would satisfy identically
- [x] The four profiles reach their documented sustained level, demonstrated written in the README — `reference-profiles.test.ts:20`, `profiles/README.md`
- [x] The suite fails if either level moves — `reference-profiles.test.ts:52`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🔴 | conform | 4 | `compose-assessment-report.ts:100` | `demonstrated.level` is projected with the sustained `ProjectionContext`, pairing demonstrated outcomes with sustained observations. Live: `assess profiles/leodagan --json` publishes `{threshold: 3, observed: 1, evidence: CONFIRMED, outcome: MET}` | Build a second context from the demonstrated projection, or drop `level.axes` and publish only id/rank/label/outcome |
| 🔴 | conform | 4 | `compose-assessment-report.test.ts` | No behaviour test for `reportDemonstrated`: not the fallback, not the clamp, not the empty case, not the axes projection. This is why the row above shipped | Add cases at this boundary, one asserting the demonstrated level report's own axis values |
| 🔴 | code | 2 | `pull-request-history.ts:331`, `recorded-activity.ts:103` | Two copies of `median` returning `0` on a missing element, while the canonical one at `git-history.ts:555` throws because "a default of zero would publish the smallest bucket from a sample nobody took — the one outcome this project forbids outright". The merge did not flag it: both files are new | Move the throwing `median` to `delivery-sample.ts`, delete both copies |
| 🔴 | conform | 2 | `forge-repository.adapter.test.ts`, `gh-process.test.ts` | Both projected ✅ in `phase-2.md`, neither exists, phase marked `done`. The collector's decision surface is untested: reading tagging, off-scale dropping, silence with no scale, window handoff | Write both suites, or move phase 2 off `done` and record the gap in `cli.md` |
| 🔴 | conform | - | `project-brief.md:43`, `architecture.md:15`, `architecture.md:109`, `testing.md:170` | Four unamended offline promises: "Runs fully offline", "no network at runtime", "Network-backed collectors are post-MVP", and an offline verification procedure that now yields a different verdict than a networked run | Amend all four; state what offline still guarantees and what it no longer does |
| 🔴 | conform | - | `cli.md:75` | "Determinism reaches the output… on any machine, on any day" is false for a GitHub subject the moment a pull request merges | Scope the promise to locally-carried evidence; say the forge reading is reproducible only against a fixed forge state |
| 🔴 | conform | - | `cli.md:10` | "`collectors` holds two production collectors" — three now, chosen at runtime, with the live one narrowed to `['harness']` on a GitHub subject | Rewrite around `collectorsFor`: one axis, one source |
| 🔴 | conform | 2 | `process-contract.test.ts:201` | The pinned provenance holds only when `origin` points at GitHub. `vcs.md`: origin is "a backup and a sharing point… no part of the build, the gate or the product depends on it" | Assert the per-subject shape (no axis carries two collectors), or have the test build its own remote |
| 🔴 | conform | 2 | `spawn-cli.test-fixture.ts:16` | The refusing `gh` is on `PATH` for every CLI spawn, `self-assessment.test.ts` included, whose documented doubles are "none — the process is spawned against this repository" | Inject the stub from `process-contract.test.ts` alone, and update the doubles column for whichever suite keeps it |
| 🟡 | conform | 4 | `compose-assessment-report.ts:100` | An axis demonstrated-CONFIRMED but sustained-UNKNOWN makes `unprovenRequirement` throw → exit 1 on valid input. Reachable from a bundle carrying `days_at_concurrency` with no median | Same fix as row 1; add the case to the bundle suite |
| 🟡 | code | 6 | `recorded-activity.ts:88` | `days_at_concurrency: {"3": 1000000000}` passes the integer check and materialises a billion-element array from unvalidated bundle JSON | Sum the recorded counts and compute at-or-above directly from the map; never materialise the array |
| 🟡 | code | 6 | `recorded-activity.ts:95` | The demonstrated computation is copy-pasted from `pull-request-history.ts:307`, under a comment claiming the two collectors cannot answer differently | Move it into `delivery-sample.ts` and call it from both |
| 🟡 | rot | 1 | `git-history.ts:396` vs `:495` | `readAutonomy` walks every merge side serially while `inBoundedParallel` sits in the same file for that shape, and `readParallelism` walks the same sides again | Walk each side once and share the result between both readings |
| 🟡 | conform | 4 | `vocabulary-conformance.test.ts` | Untouched, though `DemonstrationUnit` is declared twice under a comment saying the two must not drift. Phase 4 task 1.3 required it | Add the reading and unit vocabularies on both gates; extend `testing.md` |
| 🟡 | conform | 4 | `observation.model.ts:40` | `reading` and `demonstration` are correlated but independent: `{reading:'DEMONSTRATED', demonstration:null}` compiles and is silently dropped. `.claude/rules/02-programming-languages/2-typescript-domain-modeling.md`: "Independent unions must not permit invalid combinations" | Discriminate `Observation` on `reading`, as `Evidence` is on `status` |
| 🟡 | fit | 5 | `json.renderer.test.ts` | Phase 5 acceptance 4 extends the non-finite refusal to the share; no test drives a `NaN` share. A guard is unproven until neutered | Add a report with `demonstrated.axes[0].share = NaN`, assert the error names that path |
| 🟡 | fit | 2 | `assess.command.ts:76` | Phase 2 task 5.4 requires a budget; the merge dropped it while the phase stayed `done`. Twenty sequential `gh` round trips with no timeout at any layer can hang indefinitely | Set the budget or move the phase off `done` and record it beside the other owed items |
| 🟡 | fit | - | `git-history.ts:385` | `readAutonomy` grants "a human never intervened once the task was framed" from `Co-Authored-By:`, which marks *co*-authorship — `vcs.md` says exactly that. Inferring human absence from a collaboration marker is granting on evidence that does not carry it | Withhold the rank, or state in `autonomy.ts` why co-authorship is read as sole authorship and what it costs when wrong |
| 🟡 | rot | 2 | `pull-request-history.ts:53` | The `MAXIMUM_PAGES` limitation claims truncation "cannot happen while pages come back newest first", but the query orders by `CREATED_AT` while the window filters on `mergedAt` | Order by `UPDATED_AT`, or restate the limitation as what the code guarantees |
| 🟡 | rot | - | `codebase-map.md:32` | Still says `live-repository/` "keeps what it alone uses"; `git-process.ts` now has three outside callers | Say what it holds jointly, or move `git-process.ts` where its callers say it belongs |
| 🟡 | conform | 4 | `architecture.md:144` | "Frozen before the split" still names two adapters and an unchanged `observation.model.ts`. Phase 4 task 1.2 required the edit | Name the third adapter; record why the frozen model was reopened |
| 🟡 | functional | 2 | `assess.command.ts:66` | Budget criterion unmet | See the `fit` row above |
| 🟡 | functional | 2 | `pull-request-history.test.ts` | No recorded payload reproduces the measured triple | Record one, or restate the criterion against the post-bot-exclusion figures |
| 🟡 | functional | 3 | `measurements.md:113` | The all-states verification is still owed and the two documents disagree on the subject's demonstrated parallelism | Rerun it and reconcile |
| 🟡 | functional | 3 | `size-transcription.md` | No expected level recorded for any control before measuring | Record them, or mark the criterion not-applicable with the reason |
| 🟡 | functional | 3 | `size-transcription.md` | Tabulated at one N, and the subject's proximity to the chosen third is never stated | Tabulate at a quarter, a third and two fifths; state the proximity |
| 🟡 | functional | 4 | `vocabulary-conformance.test.ts` | Reading vocabulary not pinned across declarations | See the `conform` row above |
| 🟡 | functional | 4 | `compose-assessment-report.test.ts` | The forge payload is never exercised end to end | Add the case |
| 🟡 | functional | 5 | `human.renderer.ts:60` | The demonstrated level line carries no share, and `axes` can be empty while `level` is not | Put the share on the level line, or refuse to render a level with no axis |
| 🟡 | functional | 6 | `recorded-activity.ts:93` | An inconsistent recording is refused silently and indistinguishably from an absent one | Name the inconsistency; assert the naming |
| 🟢 | code | 1 | `git-history.ts:416` | `readAgentAttributedCommits` rebuilds the grep invocation `hasAiAttributionTrailer` already builds | Extract the shared argument builder |
| 🟢 | code | 2 | `pull-request-history.ts:152` | `page_` dodges the loop counter, giving the placeholder name to the value | Rename the counter `pageIndex` |
| 🟢 | code | 2 | `pull-request-history.ts:218` | Commit dates compared as strings while every other instant goes through `Date.parse` | Compare parsed instants |
| 🟢 | code | 2 | `pull-request-history.ts:288` | A numeric index stringified into a `Set<string>` for no reason | Use `Set<number>` |
| 🟢 | code | 2 | `spawn-cli.test-fixture.ts:21` | The memoised temp directory holding the stub `gh` is never removed | Remove it in teardown |
| 🟢 | rot | 5 | `phase-5.md:2` | `status: pending` while the work shipped and the plan reads `implemented` | Mark it `done` |
| 🟢 | rot | 3 | `phase-3.md` | Acceptance criterion names `share-threshold.md`; the artefact is `size-transcription.md` | Fix the row |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 67% (18/27) |
| Files checked | `compose-assessment-report.ts`, `assessment-report.contract.ts`, `observation.model.ts`, `resolve-evidence.ts`, `git-history.ts`, `git-process.ts`, `live-repository.adapter.ts`, `fixture-bundle.adapter.ts`, `recorded-activity.ts`, `forge-repository.adapter.ts`, `pull-request-history.ts`, `repository-slug.ts`, `gh-process.ts`, `delivery-sample.ts`, `intervention-scale.ts`, `autonomy.ts`, `size-buckets.ts`, `assess.command.ts`, `human.renderer.ts`, `json.renderer.ts`, and their suites; `aidd_docs/memory/*`, `profiles/*`, `.claude/rules/*` |
| Unchecked     | Phase 2 budget — fix; Phase 2 recorded payload — fix; Phase 3 all-states verification — fix; Phase 3 control expected levels — fix; Phase 3 N tabulation — fix; Phase 4 vocabulary conformance — fix; Phase 4 forge payload end to end — fix; Phase 5 shareless level line — fix; Phase 6 named inconsistency — fix |
| Unplanned     | The live collector's `intervention` reading (`autonomy.ts`, `readAutonomy` and its four helpers, nine tests) traces to no phase and phase 1 task 2.2 says the opposite; the bot exclusion, decided after phase 5, falsifies phase 2's and phase 4's stated targets without either being restated; `2026_08_30_per-person-attribution-brief.md`; three newly recorded forced readings in `architecture.md` |
