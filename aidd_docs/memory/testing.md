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
  * `tests/assessment/vocabulary-conformance.test.ts` — the one place allowed to import all three evidence-status contexts;
  * `tests/harness/vocabulary-conformance.test.ts` — the one place allowed to import both `LoadingTier` and `ReadingScope`'s model declaration and the harness contract's own copy;
  * `tests/cli/reference-profiles.test.ts` — the four reference profiles assessed through `runAssess`, the whole chain and no single unit;
  * `tests/cli/harness-determinism.test.ts` and `tests/cli/self-harness-audit.test.ts` — like `process-contract.test.ts` and `self-assessment.test.ts` beside them, these exercise the built binary rather than any one file, so they cannot sit beside a source they do not test in isolation.
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
| `collect-evidence.usecase` | collector execution, degradation, provenance, resolution | `FakeInMemoryEvidenceCollector`, `FailingEvidenceCollector`; real resolver |
| `assess-maturity.usecase` | orchestration and assessment result; coverage is `compose-assessment-report`'s to prove | real domain collaborators, fakes at external ports only |
| `assess.command` (`runAssess`) | argv parsing, the exit-code taxonomy including `1`, stdout/stderr, wired against the real pipeline | `CommandIo`, and — for `1` alone — `OffVocabularyEvidenceCollector`, passed through `AssessOptions.collectors`. Both are boundary doubles: everything downstream of the collector is the real pipeline |
| `harness.command` (`runHarness`) | argv parsing, the same exit-code taxonomy over a second command, stdout/stderr, wired against the real harness pipeline | `CommandIo`, and — for `1` alone — `InfiniteTokenEncoderTestAdapter`, passed through `HarnessOptions.encoder`. A test also injects its own `ClaudeHarnessAdapter(emptyMachineDirectory())` to keep a unit test's machine reading empty and deterministic; production wiring never moves |
| `tests/cli/process-contract.test.ts` | that `main.ts` and the built `dist/cli.js` deliver that taxonomy to a real shell for **both** commands, and that each wired collector reaches its pipeline through it | none — the process is spawned, nothing is faked |
| `tests/cli/self-assessment.test.ts` | AIDD assessed by its own shipped binary: that the verdict follows from evidence, that prose and `--json` agree, that no path spelling changes it | **one**, and only one: a refusing `gh` on the child's PATH, so the gate never reaches the network. Nothing is faked *for* AIDD's benefit — a source is withheld, which can only cost it axes — but the forge is consequently never exercised here |
| `tests/cli/self-harness-audit.test.ts` | AIDD's own harness audited by that same binary: that it runs through the production pipeline, that prose and `--json` carry the same figures, that no maturity level or grading word ever appears, that the existing `assess` verdict is unmoved | none — the process is spawned against this checkout's own real files |
| `tests/cli/harness-determinism.test.ts` | the byte-identical claim itself: the same subject spelled two ways produces the same stdout, subject-scoped paths never carry the operand or its resolution, no hostname, duration or timestamp reaches either rendering | none |
| `live-repository.adapter` and its modules | what a local repository can prove: the first-parent walk, the zero-touch share behind `intervention`, the delivery-record share that withholds the branch-derived axes, cancellation | none — real temporary Git repositories and the real filesystem |
| `fixture-bundle.adapter` and its modules | what a recorded bundle can prove: the delivery record, the recorded tree, cancellation | none — real temporary directories and the real filesystem |
| `harness/harness-scan` | the harness set both adapters read: the name tables, the `loops` recogniser, what makes a member undecidable | none — a real tree behind the `HarnessTree` seam |
| `harness/shell-tokens` | what the shell hides (comments, quotes, expansions, continuations) and where a word may be a command | none — a source string in, tokens and marks out |
| `harness/shell-loop` | the three answers about a loop: retry proven, decidably iterating, undecidable | none — a source string in, a `MemberScan` out |
| `fixture-bundle/bundle-tree` | the recorded tree: what `repo-context/` rebases to, that no mode is recorded, cancellation | none — real temporary directories |
| `claude-harness.adapter` and its modules | what Claude's own loading convention can prove: the two tiers, the two scopes, `@`-import depth, a declaration's description-versus-body split, the machine/ancestor dedupe that once double-counted, cancellation | none — real temporary directories standing in for a subject and a machine configuration |
| `harness/shared-passages` | exact eight-word repetition between two files' normalised words, never a ratio | none — two content strings in, shared passages out |

The first three are not use cases: each takes domain values and returns one, so it is tested directly.

`tests/cli/process-contract.test.ts` is its complement and lives in `tests/` because it exercises no single file: it spawns `node dist/cli.js` and asserts the exit code, stdout and stderr a caller actually sees. The division: the in-process suite proves what `runAssess` **returns**, this one proves that `main.ts` turns that into `process.exitCode` and that the bundle behaves like its source. No test reimplements the taxonomy — every assertion is an integer literal, `exitCodeFor` is never imported. Message wording stays the in-process suite's to own: through the process only the caller's own input (a path it passed) and the distinguishing fragment of a branch its siblings cannot separate are asserted, so rewording an error turns one file red, not two.

**The run builds `dist/`, not a suite, and building at all is a deliberate cost.** A stale bundle from another branch would let a suite pass against code nobody wrote today, so `tests/build-cli-bundle.test-setup.ts` is a vitest `globalSetup` that runs `pnpm build` once before any suite. The consequence is that `pnpm test` — and therefore `pnpm check` — needs tsup to succeed, which `coding-assertions.md` records.

It was a `beforeAll` inside `process-contract.test.ts` while that was the only suite spawning the binary. That stopped working the moment a second one did: `tsup.config.ts` sets `clean: true`, so a per-suite build empties and rewrites the folder while vitest runs files in parallel, wiping the bundle out from under a sibling mid-run. **No suite may build `dist/`.** Reading it is now fine, and two suites do.

`tests/cli/self-assessment.test.ts` is the second: AIDD assessed by its own shipped binary. It tests the **capability and its invariants**, never the state of this checkout — that the assessment runs through the production pipeline, that a verdict follows from evidence, that prose and `--json` say the same thing, that no path spelling changes the outcome. It asserts no level, no harness member, no commit count, and no collector count.

**That last exclusion is the one worth stating, because two drafts got it wrong.** An earlier cut of *this* suite pinned the whole `provenance` array with `toEqual` and pinned `proven` to `null`. Both photograph today's implementation, and both were removed **from here** — they live in `process-contract.test.ts`, where the subject is the wiring rather than the capability, and where a forge collector turning them red is the signal rather than the accident. A forge collector landing is the feature working better — it must not turn the self-assessment red, and `proven` ceasing to be null is *changed evidence*, never a changed capability. What replaced them: the collector list must contain `live-repository` and no id matching `/fake|stub|mock|fixture|self/i`, which is the real criterion — nothing was faked for AIDD's benefit — and `proven` is asserted only as the property it always holds (null implies a non-empty `blocking`; otherwise the proven level is `MET`).

`tests/cli/self-harness-audit.test.ts` learned that lesson before writing a line, and no draft of it pinned this checkout. No line count, no token figure, and no file list is asserted anywhere in it — a rule added, a memory file split, or a file gained or lost must not turn it red. What is asserted instead: the report names no word from the maturity scale; advice stays confined to Findings; prose and the contract agree on every figure either one carries (encoding, list-line reading, every tier total, every file, every shared passage and every unread entry); and running `assess .` afterward still reports the same evidence-gap sentence this repository has always reported — proof the two commands do not interfere, never a fact this suite owns about either.

The division across three suites: `process-contract.test.ts` owns the exit codes, the streams and the collector wiring — which collectors the composition root built, and that each answers for its own subject; `live-repository.adapter.test.ts` owns which subjects the collector answers for, including a directory that merely sits inside a work tree; this one owns the self-assessment. `tests/cli/spawn-cli.test-fixture.ts` is the spawn helper every CLI suite shares, so none of them can drift on how the process is invoked — `runCliWithHome` is its one addition, giving a suite an empty `HOME` so a machine reading can be asserted at zero without depending on whatever `~/.claude` the machine running the gate happens to hold.

**`harness-determinism.test.ts` is where the byte-identical claim in `cli.md` is actually checked, rather than merely stated.** It runs the same subject under two path spellings — a bare relative one and the absolute one `REPO_ROOT` names — and asserts the two stdouts are the same string, in both renderings. That passes today because no `SUBJECT`-scoped file path is ever the operand itself or its resolution: `claude-harness.adapter.ts` publishes subject files under tree-relative names regardless of how the subject was spelled, which this suite also asserts directly rather than only by implication. It further asserts no hostname, no duration and no timestamp reaches either rendering, by pattern rather than by trusting the claim.

`src/cli/assess.command.test.ts` sits beside `assess.command.ts`, per **Where a test lives** above, and drives `runAssess(argv, io)` with a capturing `CommandIo` — two in-memory string arrays, no spawn and no build. It asserts stdout, stderr and the exit code only, never which function ran. `main.ts` is never imported by any suite; it is reached only by spawning the built binary, which both suites in `tests/cli/` now do.

**The suite is Unix-only, and that is the suite's constraint, not the product's.** `live-repository.adapter.test.ts` writes `#!/bin/sh` shims onto `PATH`, reads `command -v git` and `chmod`s to `0755`; `git-process.test.ts` installs a git alias running `sh -c 'sleep …'`. None of it has a Windows equivalent, and none of it constrains `dist/cli.js`, which is why no `os` field appears in `package.json` — declaring one there would refuse the install on a platform the tool itself runs on.

## Mutation testing is a command, not a habit

`pnpm mutation` runs Stryker over the decision logic: `maturity/loading/`, `maturity/engine/`, `maturity/models/`, `evidence/adapters/harness/` and `evidence/resolution/`. It is deliberately outside `pnpm check` — a sweep is minutes, a gate is seconds — and deliberately reproducible, which is the whole point: every finding this technique has produced here came from a sweep nobody could re-run.

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
* `tests/assessment/vocabulary-conformance.test.ts` is the one place allowed to import all three, and it splits across two gates:
  * `pnpm typecheck` — statuses, `ObservedValue` and `Threshold` each asserted `Identical` between declarations. The only way to check the last two at all: the contract keeps no runtime list of either.
  * `pnpm test` — the status names alone, `EVIDENCE_STATUSES` against `EVIDENCE_CONFIDENCES` against the contract's own status keys.
* Not a shared import.

### The two harness vocabularies must stay compatible

* `LoadingTier` and `ReadingScope` are each declared twice — once in `harness/models/`, once in `harness/contracts/harness-audit-report.contract.ts` — for the same reason the evidence-status names are: peers never import each other and the contract is self-contained, so the duplication is the price rather than an oversight.
* `tests/harness/vocabulary-conformance.test.ts` mirrors `tests/assessment/vocabulary-conformance.test.ts`'s own split:
  * `pnpm typecheck` — both pairs asserted `Identical`, since the contract keeps no runtime list to compare against otherwise.
  * `pnpm test` — the member names alone, `LOADING_TIERS` and `READING_SCOPES` against a hand-written record of the contract's own keys, the same `Record<Member, true>` trick that fails `tsc` first if the contract's union ever moves.
* Two members each, closed sets both times: a third loading tier or reading scope would need its own totalling rule everywhere a report sums one, which is exactly why `loading-tier.model.ts` and `reading-scope.model.ts` say so in their own comments.

## Integration and acceptance

* Integration tests only where the real boundary matters: `live-repository.adapter` runs against temporary real Git repositories and the real filesystem. Do not mock Git to test the Git adapter.
* Profiles are acceptance fixtures, not domain identities. Production code holds no profile-specific knowledge.
* Missing input yields `UNKNOWN`, never fabricated negative evidence.

| Profile    | Sustained | Demonstrated | Deliberate hole    |
| ---------- | --------- | ------------ | ------------------ |
| `perceval` | Red       | Red          | no `repo-context/` |
| `bohort`   | Blue      | Blue         | none               |
| `leodagan` | Green     | **Copper**   | no `session.md`    |
| `arthur`   | Copper    | Copper       | no `declaratif.md` |

**`leodagan` is the only profile whose two readings differ, and that is his second job.** His recorded
days carry three branches often enough to reach Copper on the axis his median leaves at one, so he is
the fixture that exercises the demonstrated reading from a bundle through to the published contract.
Without him that path would ship unproven, and the temptation would be to write a unit test for it
instead — which would prove the arithmetic and not the wiring.

* **The table is an assertion.** `tests/cli/reference-profiles.test.ts` drives `runAssess(['assess', 'profiles/<name>', '--json'])` and pins each level, plus `coverage.axesConfirmed === 4` — a level named on partial evidence would be an accident. It runs in process rather than through `dist/cli.js`, which `process-contract.test.ts` builds with `clean: true` and reads alone.
* The same suite greps `src/` for each profile's name and for `profiles/`: production code holds no profile knowledge, and nothing but a test may name one.
* **`leodagan` is the trap the harness axis has to survive.** Expected Green, so `aidd.yml` requires `prompts` of him, yet `session.md` — the prompt-to-commit trace — is exactly what he lacks. A collector that confirms `prompts` only from a transcript file makes Green and above unreachable, and three fixtures out of four fail at once.
* `profiles/` ship their own `*.test.ts`. They stay out through vitest's `include` and a second exclusion; drop either and `profiles/bohort/code/pricing.test.ts` fails on a `zod` it does not have while `profiles/arthur/code/usage-summary.test.ts` adds five green tests that prove nothing.

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
* What to do about it is a rule: `.claude/rules/03-testing/3-tests.md`, loaded when a suite is edited.

## Tools

* Vitest only; dependency-cruiser runs with the test command.
* Verify the offline floor with the network disabled, on a bundle and on a repository, in both renderings. A bundle answers identically either way; a GitHub repository answers with *less*, its forge recorded `FAILED`, and that difference is the point of the check rather than a failure of it:

```bash
aidd-audit assess ./profiles/arthur   # and --json — identical with or without the network
aidd-audit assess .                   # and --json — forge FAILED offline, exit 0, fewer axes
```

* **The gate never reaches the network.** `tests/cli/spawn-cli.test-fixture.ts` puts a refusing `gh` ahead of any real one on the child's PATH, so `pnpm check` is green on a machine with no credentials and exercises the refusal path rather than the live forge. That the forge can *answer* is proven where its payloads can be fixed, in `pull-request-history.test.ts`.
