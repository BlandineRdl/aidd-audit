# Testing

How this project is tested: TDD boundaries, doubles, and validation.

## Strategy

* TDD at the **use-case boundary**: failing behavior test → minimum implementation → refactor.
* A test describes observable behavior through a public API.
* Tests follow behavior, not files. Models, helpers, ports and classes get no suite of their own unless they hold behavior clearer to test directly.
* Prefer the smallest boundary that proves the behavior.
* Test names describe behavior, never implementation.

## Where a test lives

* A suite sits **beside the code it exercises**: `engine/maturity-engine.test.ts` next to `maturity-engine.ts`.
* `tests/` holds only what has no such neighbour, and exists for that alone:
  * `tests/maturity/aidd-model.test.ts` — conformance of `aidd.yml`, a data file, not a function;
  * `tests/assessment/vocabulary-conformance.test.ts` — the one place allowed to import `maturity`, `evidence` and `assessment` at once, three of the four contexts;
  * `tests/harness/vocabulary-conformance.test.ts` — the same discipline inside the fourth, `harness`'s own two closed sets held against its own contract;
  * `tests/cli/reference-profiles.test.ts` — the six reference subjects assessed through `runAssess`, the whole chain and no single unit;
  * `tests/cli/process-contract.test.ts`, `tests/cli/self-assessment.test.ts`, `tests/cli/self-harness-audit.test.ts` and `tests/cli/harness-determinism.test.ts` — the four suites that spawn the built binary.
* **Co-location is not mirroring.** `resolve-evidence.test.ts` exists because resolution is a behavior, not because `resolve-evidence.ts` is a file. `scale-comparison.ts` is owed nothing.
* **`shell-tokens.ts` and `shell-loop.ts` are the exception the rule allows for, and a mutation sweep is what earned it.** They looked like helpers under `harness-scan.test.ts` and were not: 1588 lines of suite reached them only by walking a whole repository, and the first sweep found 178 survivors and 73 mutants no test touched at all across the two. Driving them on a source string took `shell-tokens` from 58.66% to 81.01% and `shell-loop` from 70.99% to 79.15%, and cut what nothing reached from 73 to 16. **A file gets its own suite when something other than taste says the boundary above it is too coarse** — here, a measurement.
* Four suffixes mark what never ships: `*.test.ts`, `*.test-adapter.ts`, `*.test-fixture.ts`, `*.test-setup.ts`. `test` opens the suffix of everything outside the production graph, so a new kind of non-shipping file takes a `test-` prefix rather than a word of its own. `dependency-cruiser` excludes the first three because only those occur under `src/`; `*.test-setup.ts` exists once, in `tests/`, which the cruise does not reach.

## Behaviors under test, and what each one fakes

**Chicago-style**: run the real deterministic collaborators together, fake only architectural boundaries outside the behavior under test. No mocks of internal collaborators, no call-order assertions, no implementation-detail tests.

| Behavior | Proves | Doubles |
| -------- | ------ | ------- |
| `maturity-engine` | maturity semantics | none — handed a model and observations |
| `resolve-evidence` | evidence resolution | none — takes domain values, returns one |
| `compose-assessment-report` | projection into the public contract, coverage derivation | none — real evidence, real `checkMaturity` |
| `collect-evidence.usecase` | collector execution, degradation, provenance, diagnostics, resolution | `FakeInMemoryEvidenceCollector`, `FailingEvidenceCollector`; real resolver |
| `assess-maturity.usecase` | orchestration and assessment result; coverage is `compose-assessment-report`'s to prove | real domain collaborators, fakes at external ports only |
| `assess.command` (`runAssess`) | argv parsing, the exit-code taxonomy including `1`, stdout/stderr, wired against the real pipeline | `CommandIo`, and — for `1` alone — `OffVocabularyEvidenceCollector`, passed through `AssessOptions.collectors`. Both are boundary doubles: everything downstream of the collector is the real pipeline |
| `harness.command` (`runHarness`) | argv parsing, concise and `--details` prose, tiers, scopes, unread entries and JSON rendering | `CommandIo`, `ClaudeHarnessAdapter(emptyMachineDirectory())`, `InfiniteTokenEncoderTestAdapter` |
| `tests/cli/process-contract.test.ts` | that `main.ts` and the built `dist/cli.js` deliver that taxonomy to a real shell, including `harness` and its `--details` boundary, that the wired collector reaches the pipeline through it, and that colour follows the channel rather than the report | none — the process is spawned, nothing is faked |
| `tests/cli/self-assessment.test.ts` | AIDD assessed by its own shipped binary: that the verdict follows from evidence, that prose and `--json` agree, that no path spelling changes it | **one**, and only one: a refusing `gh` on the child's PATH, so the gate never reaches the network. Nothing is faked *for* AIDD's benefit — a source is withheld, which can only cost it axes — but the forge is consequently never exercised here |
| `live-repository.adapter` and its modules | what a local repository can prove: the first-parent walk, the zero-touch share behind `intervention`, the delivery-record share that withholds the branch-derived axes, cancellation | none — real temporary Git repositories and the real filesystem |
| `fixture-bundle.adapter` and its modules | what a recorded bundle can prove: the delivery record, the recorded tree, cancellation | none — real temporary directories and the real filesystem |
| `harness/harness-scan` | the harness set both adapters read: the name tables, the `loops` recogniser, what makes a member undecidable | a faithful in-memory `HarnessTree`; `tracked-tree.test.ts` owns the Git-to-tree translation |
| `harness/shell-tokens` | what the shell hides (comments, quotes, expansions, continuations) and where a word may be a command | none — a source string in, tokens and marks out |
| `harness/shell-loop` | the three answers about a loop: retry proven, decidably iterating, undecidable | none — a source string in, a `MemberScan` out |
| `fixture-bundle/bundle-tree` | the recorded tree: what `repo-context/` rebases to, that no mode is recorded, cancellation | none — real temporary directories |
| `forge-repository/commit-history` | the commit walk, the email-to-account dictionary, the windowed counts per account, bots dropped by login suffix, the unattributed bucket | none — recorded payloads answered by a stub `gh` on the child's PATH |
| `harness/harness-authorship` | who authored the paths that proved each harness member, keyed through the dictionary | none — real temporary Git repositories and the real filesystem |
| `forge-contributor-roster.adapter` | the records the roster answers, its failure, its cancellation | none |
| `composition/compose-contributor-roster` | a level per record, both readings, the ordering, the floors read per person | none — real `checkMaturity` over real records |

**Nothing internal is faked in any of the four rows above.** Every double this feature adds is at a boundary — a stub `gh` on PATH, a temporary Git repository — and no internal collaborator is mocked, per the Chicago-style rule this section already states.

The first three are not use cases: each takes domain values and returns one, so it is tested directly.

`tests/cli/process-contract.test.ts` is its complement and lives in `tests/` because it exercises no single file: it spawns `node dist/cli.js` and asserts the exit code, stdout and stderr a caller actually sees. The division: the in-process suite proves what `runAssess` **returns**, this one proves that `main.ts` turns that into `process.exitCode` and that the bundle behaves like its source. No test reimplements the taxonomy — every assertion is an integer literal, `exitCodeFor` is never imported. Message wording stays the in-process suite's to own: through the process only the caller's own input (a path it passed) and the distinguishing fragment of a branch its siblings cannot separate are asserted, so rewording an error turns one file red, not two.

**The run builds `dist/`, not a suite, and building at all is a deliberate cost.** A stale bundle from another branch would let a suite pass against code nobody wrote today, so `tests/build-cli-bundle.test-setup.ts` is a vitest `globalSetup` that runs `pnpm build` once before any suite. The consequence is that `pnpm test` — and therefore `pnpm check` — needs tsup to succeed, which `coding-assertions.md` records.

It was a `beforeAll` inside `process-contract.test.ts` while that was the only suite spawning the binary. That stopped working the moment a second one did: `tsup.config.ts` sets `clean: true`, so a per-suite build empties and rewrites the folder while vitest runs files in parallel, wiping the bundle out from under a sibling mid-run. **No suite may build `dist/`.** Reading it is now fine, and four suites do: `process-contract.test.ts`, `self-assessment.test.ts`, `self-harness-audit.test.ts` and `harness-determinism.test.ts`.

**The gate proves `dist/cli.js` and nothing about the plugin's own bundle.** `plugins/aidd-evaluation/bin/cli.js` is a second build of the same entry point, produced by `pnpm build:standalone` — `tsup.standalone.config.ts`, which bundles `yaml` in and writes into the plugin, and copies `aidd.yml` beside it — and **committed**, because a plugin installed from this repository is not built by whoever installs it. It is therefore a **second published surface for the same contract**: what a plugin user reads comes out of that file, not out of `dist/`. Nothing in `pnpm check` opens it. `typecheck` reads `src/`, every spawning suite runs `dist/cli.js`, `architecture` cruises `src/`, and no suite, config or script names the plugin's `bin/` at all — so it can lag `src/` by any distance and the gate stays green. **Rebuild it and commit it whenever the contract, a renderer or the model moves**, and treat a report published by the plugin as evidence about the bundle's age until it has been.

`tests/cli/self-assessment.test.ts` is the second: AIDD assessed by its own shipped binary. It tests the **capability and its invariants**, never the state of this checkout — that the assessment runs through the production pipeline, that a verdict follows from evidence, that prose and `--json` say the same thing, that no path spelling changes the outcome. It asserts no level, no harness member, no commit count, and no collector count.

**That last exclusion is the one worth stating, because two drafts got it wrong.** An earlier cut of *this* suite pinned the whole `provenance` array with `toEqual` and pinned `proven` to `null`. Both photograph today's implementation, and both were removed **from here** — they live in `process-contract.test.ts`, where the subject is the wiring rather than the capability, and where a forge collector turning them red is the signal rather than the accident. A forge collector landing is the feature working better — it must not turn the self-assessment red, and `proven` ceasing to be null is *changed evidence*, never a changed capability. What replaced them: the collector list must contain `live-repository` and no id matching `/fake|stub|mock|fixture|self/i`, which is the real criterion — nothing was faked for AIDD's benefit — and `proven` is asserted only as the property it always holds (null implies a non-empty `blocking`; otherwise the proven level is `MET`).

**The suite gained the roster section under a refusing forge, held to the same discipline.** This checkout has a GitHub origin, so the composition root builds a roster for it, and the refusing `gh` on the spawn fixture's PATH is what keeps the section present-and-`FAILED` rather than absent, deterministically. What is asserted is the capability — a source that could not answer says so, both in the contract and in prose — and never a login, a row count or a level: the JSON assertion reads only `status`, `rows` (structurally empty on a `FAILED` union member) and that `reason` is non-empty, and the prose assertion matches no rendered contributor row (`/^ {2}\S+ — niveau prouvé/m`, `renderContributorRow`'s own opening shape and French, like every other word the renderer prints) rather than banning the literal string `BlandineRdl`. **That string cannot be banned outright**: the reason echoes the failed `gh` invocation verbatim, including `-F owner=BlandineRdl` from this repository's own slug, which is plumbing about the failed command and not a claim about any person — banning it as a substring was tried first and failed the suite on exactly that line, which is itself evidence the two must be told apart rather than conflated.

The division across the suites: `process-contract.test.ts` owns the exit codes, the streams and the collector wiring — which collectors the composition root built, and that each answers for its own subject; `live-repository.adapter.test.ts` owns which subjects the collector answers for, including a directory that merely sits inside a work tree; this one owns the self-assessment; `self-harness-audit.test.ts` owns this repository auditing its own Claude context, and `harness-determinism.test.ts` owns the byte-identical claim, running one subject under two path spellings. `tests/cli/spawn-cli.test-fixture.ts` is the spawn helper all four share, so they cannot drift on how the process is invoked. It **strips `NO_COLOR` and `FORCE_COLOR` from the child's environment** before applying the overrides `runCliWith` takes: a suite that spawns a binary must not assert differently depending on who is running it.

`src/cli/assess.command.test.ts` sits beside `assess.command.ts`, per **Where a test lives** above, and drives `runAssess(argv, io)` with a capturing `CommandIo` — two in-memory string arrays, no spawn and no build. It asserts stdout, stderr and the exit code only, never which function ran. `main.ts` is never imported by any suite; it is reached only by spawning the built binary, which four of the five suites in `tests/cli/` do — `reference-profiles.test.ts` is the one that drives `runAssess` in process instead.

**The suite is Unix-only, and that is the suite's constraint, not the product's.** `live-repository.adapter.test.ts` writes `#!/bin/sh` shims onto `PATH`, reads `command -v git` and `chmod`s to `0755`; `git-process.test.ts` installs a git alias running `sh -c 'sleep …'`. None of it has a Windows equivalent, and none of it constrains `dist/cli.js`, which is why no `os` field appears in `package.json` — declaring one there would refuse the install on a platform the tool itself runs on.

### Real repositories are built once, and together

`git-history.test.ts` builds some seventy temporary Git repositories, and building them is `git`
process time — 2 072 spawns at roughly 26ms each on macOS, nothing about it computation. Three
things keep that off the clock, and each is load-bearing:

* **A pristine template, copied.** `git init` plus the three configs every fixture needs is four
  processes. The template pays for them once; `initRepository` is then an `fs.cp` of a pristine
  `.git`, which holds no absolute path and is byte-for-byte the repository those four commands
  would have produced.
* **One named builder per history, memoised, all started together in `beforeAll`.** Two tests
  naming the same history share the one repository. Eight build at a time — seventy released at
  once would put seventy `git` processes on the machine.
* **A test that writes to its fixture takes `aCopyOf` it.** `readGitDerivedMetrics` and
  `hasAiAttributionTrailer` only read, and that is the whole licence for sharing; the two tests
  that mutate — the re-merge absorbing no commit, and the deliberately broken ref — must not be
  the reason a sibling turns red.

**66.35s to 22.5s, with the suite's discriminating power measured rather than assumed.** Four
production constants were neutered one at a time and the file went red on each; the
`MINIMUM_DELIVERED_CHANGES` 5→4 neuter gave `3 failed | 76 passed` against both the new file and
the pre-refactor one. A fixture refactor that is not checked this way is a refactor that may have
made tests vacuous, and a green suite would say nothing about it.

The cost: parallel construction is more sensitive to machine load than the serial version was, so
the figure varies between about 22s and 36s where it used to sit steadily at 66s.

`harness-scan.test.ts` is a direct consumer test now: **161 cases complete in about 34ms** on the
in-memory `HarnessTree` it receives. The tree is faithful to the entire interface the scan can
observe — path, regular-file and executable flags, plus bounded probes and reads — so the scan no
longer creates a Git repository to vary a name or source string.

`tracked-tree.test.ts` owns the source-specific translation: repository-root resolution, Git's
recorded executable bit, disappeared tracked files, untracked files and symlinks. The symlink case
also pins `scanHarness`'s `regularFile` guard: making that guard a no-op makes its consumer test
red. The testing rule and architecture record this narrow exception explicitly, so it is neither a
hidden mock nor a second production abstraction.

## Mutation testing is a command, not a habit

`pnpm mutation` runs Stryker over the decision logic named in `stryker.config.json`'s own `mutate` list — read that file, not this paragraph, for the current set; it has grown past what any fixed prose here could restate without drifting from it the day another module joins. It is deliberately outside `pnpm check` — a sweep is minutes, a gate is seconds — and deliberately reproducible, which is the whole point: every finding this technique has produced here came from a sweep nobody could re-run.

**`forge-repository/` is swept file by file, not by glob**, unlike `evidence/adapters/harness/**/*.ts` or `assessment/composition/**/*.ts` beside it in the same list. A module added beside `pull-request-history.ts` is mutated by nothing until it is named there — which is why the per-person attribution work cost `stryker.config.json` three explicit entries, `commit-history.ts`, `contributor-deliveries.ts` and `derived-observations.ts`, where landing inside `harness/` or `composition/` would have cost none: the email dictionary and the windowed counts, the sample floors applied per person and the per-account active-day count, and the guards that drop a value the loaded scale has no name for, are all decision logic and exactly what the sweep exists to interrogate. `harness-authorship.ts` and `compose-contributor-roster.ts` needed no entry of their own — they already sit inside the two globbed folders.

Three things in the configuration are load-bearing:

* **`plugins` names `@stryker-mutator/vitest-runner` explicitly.** pnpm isolates `node_modules`, so Stryker's core cannot discover the runner beside itself and reports `no TestRunner plugins were loaded`. Without the entry the run dies at startup — the exact failure mode that once read as every mutant killed.
* **`vitest.mutation.config.ts` is the sweep's own view of the suite.** It drops `tests/`, whose suites spawn the built binary, and the `globalSetup` that builds it: rebuilding `dist/` once per mutant would measure tsup, not the tests.
* **`thresholds.break` is null.** A surviving mutant is a question, and a gate that answers it by failing would get the config loosened rather than the test strengthened. Thirteen minutes is a report to read, not a gate to pass.

**The first baseline, 2026-08-29: 1692 mutants, 77.13% total, 82.85% of covered code — 1277 killed, 273 survived, 118 uncovered, 0 errors.** It relocated this project's known weak spot. The loader, which shipped a live guard nothing held three times, scored 88.00 with `load-maturity-model.ts` at 100; `engine/` 96.06, `resolution/` 94.34. **83% of every survivor was in `evidence/adapters/harness/`** (69.58) — `shell-tokens.ts` at 58.66 and `shell-loop.ts` at 70.99 — while `harness-scan.ts` above them was 97.30. 1588 lines of suite, and almost none of it reaching the tokeniser directly.

**After acting on it, same day: 83.51% total, 86.60% of covered code — 1381 killed, 221 survived, 61 uncovered.** Two suites at the layer's own boundary did it, and the gain is where the sweep pointed:

| | before | after |
| --- | --- | --- |
| `shell-tokens.ts` | 58.66 | **81.01** |
| `shell-loop.ts` | 70.99 | **79.15** |
| `harness/` overall | 69.58 | 79.51 |
| mutants nothing reached | 118 | 61 |

**The second pass is the more useful lesson.** A further 25 tests, aimed at survivors named one by one from the report, bought 0.7 points. `readShellLoops` answers in two booleans, so a great many internal distinctions are simply not observable from outside it, and chasing them would mean exporting internals to test them — which buys a number and loses the rule. **Stop when the curve flattens.** What remains worth doing sits elsewhere: `agent-invocation.ts` (66.28, 29 uncovered) and `model-consistency.ts` (78.90, 9 uncovered).

**Third baseline, 2026-08-31, after the per-person attribution work, measured on an idle machine:
86.44% total, 88.14% of covered code — 2266 killed, 239 timed out, 337 survived, 56 uncovered, 0
errors, in 24 minutes 24 seconds.**

The set mutated grew by five files — `commit-history.ts`, `contributor-deliveries.ts`,
`derived-observations.ts` and `delivery-reader.ts` named one by one, plus
`forge-contributor-roster.adapter.ts`, with the `harness/` and `assessment/composition/` globs
picking up `harness-authorship.ts`, `compose-contributor-roster.ts` and `report-projection.ts` for
free. The totals are therefore not comparable to the baselines above, whose file set was smaller.
What is comparable, because the feature touches neither file, is the pair the second baseline earned:

| | second baseline | third baseline |
| --- | --- | --- |
| `shell-tokens.ts` | 81.01 | 81.56 |
| `shell-loop.ts` | 79.15 | 79.15 |
| `harness-scan.ts` | 97.30 | 100.00 |

**Neither fell**, which is the one thing this sweep was run to catch; `shell-loop.ts` did not move at
all, and `harness-scan.ts` reached 100 because phase 4's `provenBy` earned its own suite.

**A contended sweep is not a measurement, and one was very nearly recorded as one.** An earlier run of
this same set reported 88.62% with **425** timeouts while a second sweep held the same CPU; the run
above reports 239 on an idle machine. Stryker counts a timeout as detected, so contention inflates
the headline through a class no assertion earned — nearly two points here. The first two baselines
record no timeout bucket at all. **Run the sweep alone, and treat a timeout count far above the
previous one as evidence about the machine rather than about the tests.**

**A suite under `src/` must not depend on this checkout being a Git repository.** Stryker runs the
suite inside `.stryker-tmp/sandbox-*`, a copy of the project with no `.git`, so `assess .` there is
neither a repository, a bundle, nor a bundle holder — `resolveSubjects` refuses it and the run exits
`2`. One test asserting the happy path against `'.'` was enough to kill the dry run before a single
mutant was tried, and it had been green in `pnpm check` all along, because the ordinary run has a
`.git`. It now assesses `profiles/venec`, a recorded bundle whose evidence establishes no level —
the same behaviour, with no dependency on the checkout's state. **A sweep that dies at startup is
the failure mode this file already records reading exactly like success.**

`harness-authorship.ts` is the slowest thing in the swept set at 72.84%, because every mutant re-runs
`git log` against a real temporary work tree rather than a source string. It stays in: authorship is
decision logic, and interrogating decision logic is the whole reason `stryker.config.json` exists.
The new files that scored well need nothing — `delivery-reader.ts` 100.00, `commit-history.ts` 97.35,
`pull-request-history.ts` 96.41, `forge-contributor-roster.adapter.ts` 86.52. The weak spots owed a
second pass, on the terms `shell-tokens.ts` and `shell-loop.ts` already had one: `agent-invocation.ts`
70.93 (the oldest of them, already named by the second baseline), `harness-authorship.ts` 72.84,
`repository-slug.ts` 76.67, `contributor-deliveries.ts` 77.27, `compose-contributor-roster.ts` 81.33.
Not chased here: `pnpm mutation` is a report to read, never a gate to pass.

## Doubles

* A double is one alternative implementation of a port, not a scenario machine. Always an adapter — only a boundary is ever faked — so `.test-adapter.ts`, filed in `adapters/` with the production ones.
* The discipline itself is a rule: `.claude/rules/03-testing/3-test-doubles.md`, loaded when one is edited.

## Core semantics to protect

Requirement:

* `CONFIRMED` + threshold reached → `MET`;
* `CONFIRMED` + threshold not reached → `NOT_MET`;
* `UNKNOWN`, `CLAIMED`, `CONFLICTING` → `UNPROVEN`.

Axis:

* all requirements `MET` → `MET`;
* any `NOT_MET` → `NOT_MET`;
* no `NOT_MET` + at least one `UNPROVEN` → `UNPROVEN`.

Level:

* all required axes `MET` → satisfied;
* any axis `NOT_MET` → not satisfied;
* no `NOT_MET` + at least one `UNPROVEN` → not proven;
* otherwise report the highest fully satisfied lower level.

Gap: `NOT_MET` is a practice gap, `UNPROVEN` an evidence gap — see **The conservative rule** in `project-brief.md` for what each may recommend.

### The three vocabularies must stay compatible

* The four evidence-status names live in three independent declarations: `evidence/models/observation.model.ts`, `maturity/models/axis-observation.model.ts`, and the public contract. Peers never import each other and the contract is self-contained; the duplication is the price.
* A member added to one declaration and not the others compiles today. The divergence would surface only at composition time.
* `tests/assessment/vocabulary-conformance.test.ts` is the one place allowed to import all three, and it splits across two gates — three of the four contexts, since `harness` declares no evidence status and takes no part in this:
  * `pnpm typecheck` — statuses, `ObservedValue` and `Threshold` each asserted `Identical` between declarations. The only way to check the last two at all: the contract keeps no runtime list of either.
  * `pnpm test` — the status names alone, `EVIDENCE_STATUSES` against `EVIDENCE_CONFIDENCES` against the contract's own status keys.
* Not a shared import.
* **`harness` runs the same discipline over its own two closed sets**, `LoadingTier` and `ReadingScope`, declared once in `harness/models/` and once in `harness/contracts/harness-audit-report.contract.ts`. `tests/harness/vocabulary-conformance.test.ts` asserts them `Identical` at `typecheck` and equal as name lists at `test`. It imports one context, not two: the duplication it guards is internal to `harness`, which is what a self-contained contract costs inside a context as much as across one.

## Integration and acceptance

* Integration tests only where the real boundary matters: `live-repository.adapter` runs against temporary real Git repositories and the real filesystem. Do not mock Git to test the Git adapter.
* Profiles are acceptance fixtures, not domain identities. Production code holds no profile-specific knowledge.
* Missing input yields `UNKNOWN`, never fabricated negative evidence.

| Profile    | Sustained  | Demonstrated | Deliberate hole            |
| ---------- | ---------- | ------------ | -------------------------- |
| `perceval` | Red        | Red          | no `repo-context/`         |
| `bohort`   | Blue       | Blue         | none                       |
| `leodagan` | Green      | **Copper**   | no `session.md`            |
| `arthur`   | Copper     | Copper       | no `declaratif.md`         |
| `lancelot` | Red        | not pinned   | none — a full record, and late human corrections on most of its changes |
| `venec`    | **none**   | not pinned   | no `git-activity.json`     |

**`leodagan` is the only profile whose two readings differ, and that is his second job.** His recorded
days carry three branches often enough to reach Copper on the axis his median leaves at one, so he is
the fixture that exercises the demonstrated reading from a bundle through to the published contract.
Without him that path would ship unproven, and the temptation would be to write a unit test for it
instead — which would prove the arithmetic and not the wiring.

* **The table is an assertion, in two shapes.** `tests/cli/reference-profiles.test.ts` drives `runAssess(['assess', 'profiles/<name>', '--json'])` and pins the five classified subjects to their level plus `coverage.axesConfirmed === 4` — a level named on partial evidence would be an accident. **`venec` is pinned the other way**, and the assertion is the mirror image rather than the same one: `proven` null, `axesConfirmed` strictly below four, and an `EVIDENCE` gap among its blockers. A subject with no delivery record must fail on the evidence gap and not on a low reading, and only the second shape says so. It runs in process rather than through `dist/cli.js`, which `process-contract.test.ts` builds with `clean: true` and reads alone.
* **The six are also assessed as one set**, `runAssess(['assess', 'profiles', '--json'])`, and each element is asserted `toEqual` the document that subject publishes when named alone — so the set reading is proven to add nothing and lose nothing, and the order is the six names sorted.
* The same suite greps `src/` for each profile's name and for `profiles/`: production code holds no profile knowledge, and nothing but a test may name one.
* **`leodagan` is the trap the harness axis has to survive.** Expected Green, so `aidd.yml` requires `prompts` of him, yet `session.md` — the prompt-to-commit trace — is exactly what he lacks. A collector that confirms `prompts` only from a transcript file makes Green and above unreachable, and three fixtures out of four fail at once.
* `profiles/` ship their own `*.test.ts`. They stay out through vitest's `include` and a second exclusion; drop either and `profiles/bohort/code/pricing.test.ts` fails on a `zod` it does not have while `profiles/arthur/code/usage-summary.test.ts` adds five green tests that prove nothing.

**The contributor roster has been proven per module and never end to end, and this is owed rather than done.** `mc-tracker-fr/McTracker`, the subject measured while this feature was built, holds one human row inside its own 180-day window — `Ayaerna`, its second contributor, last committed sixteen months before that window's start — so its roster restates its repository line rather than exercising the feature's whole point: two people, two levels, one repository. What closes it is a repository with two accounts opening pull requests inside one window — Darkwaters, or any other with that shape. What does **not** close it: lowering a sample floor so that a second row appears. Measurements are in `aidd_docs/tasks/2026_08/2026_08_30_per-person-attribution/measurements.md`.

## What one unobserved axis costs

* Every level of `aidd.yml` declares all four axes, so a single `UNKNOWN` leaves even White unproven and the report has no level to name. The conservative rule taken to its end.
* The weight is therefore on collector coverage: a collector that silently contributes nothing costs the whole assessment, not one rung.
* `proven: null` is that result — "insufficient evidence to classify", never "below White". `tests/maturity/aidd-model.test.ts` pins it; the renderer's matching duty is in `cli.md`.

### `aidd-model.test.ts` is a model conformance test, not a decision test

* It reads the canonical `aidd.yml` from disk on purpose — four axes, seven distinct ranks, a few expected reference points — so a typo in the model fails at commit rather than at assessment.
* Decision tests stay free of the filesystem and of YAML.
* It reads through `loadMaturityModel`, so the loader's guards are what fail here: a threshold off its scale, a level short of an axis or a rank that dips stops the suite at collection, naming the fault. The reference points then prove the model still grades what it should.

## What this repository already got wrong

* The model loader shipped **three times** with a live guard nothing held, green suite each round. The pattern never varies: the test names the rule and asserts something weaker.
* One honest mutation sweep over that loader ran 61 mutations; **22 survived**.
* An earlier sweep reported every mutant killed — an invalid reporter name was making every run die at startup, which reads exactly like success.
* **A cancellation test can be satisfied by the wrong checkpoint.** Honouring `context.signal` is a duty the collector port freezes, so every collector is owed one; but a collector checks the signal several times, and a test aiming at the deep check is satisfied by the shallow one. A test written for an abort *during* the tree walk passed with the walk's guard deleted — it was proving the adapter's pre-flight `throwIfAborted`. Only the mutation sweep said so. Drive the guarded unit directly when a checkpoint upstream can answer for it.
* **An assertion over a collection pins nothing until the collection is proven non-empty.** A test written to prove that no contributor row carried a harness observation ran against a fixture whose recorded history held no accounts: the roster answered zero rows, the assertion mapped over an empty list, and it held whatever the adapter did. Neutering the guard it was written for left the suite green. `toEqual([])` on a derived list is two claims — that the source produced entries, and that none of them matched — and it silently proves only the second. Assert the rows are there before asserting what they lack.
* What to do about it is a rule: `.claude/rules/03-testing/3-tests.md`, loaded when a suite is edited.

## Tools

* Vitest only; dependency-cruiser runs with the test command.
* Verify the offline floor with the network disabled, on a bundle and on a repository, in both renderings. A bundle answers identically either way; a GitHub repository answers with *less*, its forge recorded `FAILED`, and that difference is the point of the check rather than a failure of it:

```bash
aidd-audit assess ./profiles/arthur   # and --json — identical with or without the network
aidd-audit assess .                   # and --json — forge FAILED offline, exit 0, fewer axes
```

* **The gate never reaches the network.** `tests/cli/spawn-cli.test-fixture.ts` puts a refusing `gh` ahead of any real one on the child's PATH, so `pnpm check` is green on a machine with no credentials and exercises the refusal path rather than the live forge. That the forge can *answer* is proven where its payloads can be fixed, in `pull-request-history.test.ts`.
