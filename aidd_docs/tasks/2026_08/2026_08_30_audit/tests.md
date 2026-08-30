# Codebase Audit: tests (suite health and feedback latency)

Nothing is broken, skipped or flaky-by-neglect. The current suite has 761 tests, covers 95.87% of statements, and completes in 27.01s. Its feedback cost is now concentrated in two serial, Git-backed suites; they run alongside each other, but remain the main obstacle to faster local iteration.

- **Date**: 2026_08_30
- **Scope**: `tests` pillar over `src/**/*.test.ts` and `tests/**/*.test.ts` (30 files, 761 tests)
- **Health**: good
- **Findings**: 0 critical, 6 warning, 3 minor

Health: `good` = no critical findings; `fair` = critical findings exist but are isolated and addressable; `poor` = systemic or widespread critical findings.

## The measurement this report rests on

Every number below was produced in this run, not estimated.

| Measurement | Command | Result |
| --- | --- | --- |
| Full suite | `pnpm exec vitest run --coverage` | **27.01s wall**, 761 passed |
| `git-history.test.ts` alone | `pnpm exec vitest run <file>` | **21.28s**, 79 passed |
| `harness-scan.test.ts` alone | same | **19.49s**, 160 passed |
| `git-process.test.ts` alone | same | **4.30s**, 9 passed |
| `gh-process.test.ts` alone | same | **6.05s**, 6 passed |
| `live-repository.adapter.test.ts` alone | same | 17.46s |
| `git` spawns, `git-history.test.ts` | counting shim on `PATH` | **2 431** |
| `git` spawns, `harness-scan.test.ts` | counting shim on `PATH` | **1 626** |
| Bare `git --version` spawn cost, this machine | 50 iterations | **19.7ms** |
| tsup `globalSetup` build | `npx tsup` | 0.56s — not a factor |
| Coverage | `pnpm exec vitest run --coverage` | **95.87%** statements, **90.77%** branches, **99.08%** functions |

The measurements continue to support the ranking:

1. **Two serial Git suites dominate the interactive cost.** `git-history.test.ts` and `harness-scan.test.ts` take 21.28s and 19.49s alone. Vitest overlaps them in the full run, but neither can use the available worker capacity internally without the documented cleanup and assertion-isolation work.
2. **The remaining cost is process creation, not computation.** The per-subcommand count below shows 654 Git child processes in `harness-scan.test.ts`; its 160 tests still build and inspect real repositories sequentially.

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| ✅ | tests | `src/evidence/adapters/live-repository/git-history.test.ts:41` | **Fixed 2026_08_30.** 79 tests each built a throwaway repository from scratch via `initRepository` + `deliverChange`; 2 431 sequential `git` spawns measured, ~26.7ms each, and the file alone set the suite's 64.7s wall clock | Done: a pristine template copied instead of re-initialised, and every history built once by a named builder, all of them together. **66.35s → 22.5s**; see *Outcome* below | L |
| ✅ | tests | `src/evidence/adapters/harness/harness-scan.test.ts:40` | **Halved 2026_08_30.** `repositoryWith` built a real Git repository per test — 1 626 spawns, 39.6s — to drive `scanHarness`, whose only input is the `HarnessTree` interface | Done to the extent route (a) allows: template copy, **1 626 → 654 spawns, 39.6s → 20.2s**. The deeper fix (in-memory `HarnessTree`, real Git kept for the 6 tests that need it) is untouched and still open — it needs a decision on the doubles rule; see *Outcome* | M |
| 🟡 | tests | `src/evidence/adapters/harness/harness-scan.ts:84` | **Surviving mutant, pre-existing.** Replacing `if (!entry.regularFile) continue` with a no-op leaves all 160 tests green — the guard is unpinned. Confirmed against the pre-refactor file from `HEAD`, so it predates this work | Add a case whose tracked tree holds a non-regular entry (a symlink) that would otherwise be read as a script candidate | S |
| 🟡 | tests | `src/evidence/adapters/harness/harness-scan.test.ts:216` | 160 tests share one global `expect` and cannot be made concurrent: `describe.concurrent` cut the file to 5.8s but failures landed on the wrong tests — 5, 3, 3 then 1 failure across four runs, with the names varying | Destructure `expect` from the test context in each test before ever marking this file concurrent; until then the file must stay serial | M |
| 🟡 | tests | `src/evidence/adapters/live-repository/git-history.test.ts:19` | `afterEach` does `workspaces.splice(0)` and deletes *every* registered directory, so intra-file concurrency is structurally impossible; same shape at `harness-scan.test.ts:29` and `live-repository.adapter.test.ts:64`. With tests serial inside a file and the work concentrated in two files, the run peaks at 209% of 1000% available CPU | Register each temp directory against its own test and clean it there, then mark the read-only describes `.concurrent` | M |
| 🟡 | tests | `src/evidence/adapters/live-repository.adapter.test.ts:80` | 14 tests, 17.5s in isolation (~1.2s/test): each builds a repository *and* a harness tree *and* runs the whole collector, where most assertions differ only in which observation they read back | Share one built repository per distinct history across the read-only assertions | M |
| 🟡 | tests | `tests/cli/spawn-cli.test-fixture.ts:37` | `runCli` is `spawnSync`, so 21 full CLI runs in `process-contract.test.ts` — each one a Node start plus a complete self-assessment of this repository — execute strictly one after another (6.7s) | Spawn asynchronously, or run each distinct argv once in `beforeAll` and assert against the captured result | M |
| 🟡 | tests | `src/evidence/adapters/live-repository/git-process.test.ts:88` | The mid-flight kill test sleeps a subprocess for a hardcoded 2s and then unconditionally waits a further 3s (`await delay((LINGER_SECONDS + 1) * 1000)`, line 110): 3.1s, ~60% of its file, and both are arbitrary wall-clock constants — the flakiness class this pillar exists to flag | Drop the linger to ~300ms and the trailing wait to ~450ms; the assertion proves the same mechanism at any scale, and the shorter wait is no more timing-dependent than the current one | S |
| 🟢 | tests | `src/evidence/adapters/forge-repository/gh-process.test.ts:104` | The buffer-overflow test pipes 100 MB through `tr` to trip `maxBuffer`: 6.5s, the single slowest test in the suite and ~90% of its file | Make the buffer ceiling an injectable constant so a small buffer proves the same refusal. Tradeoff, stated rather than hidden: that puts a test-shaped seam in production code, which this codebase otherwise avoids — if that is refused, the finding stands as accepted cost | S |
| 🟢 | tests | `src/evidence/adapters/live-repository/git-history.test.ts:15` | Per-test timeouts of `120_000` here and `60_000` in four forge suites; a genuinely hung test now costs one to two minutes before it reports, and the slowest legitimate test in the file is under 5s | Lower to a measured multiple of the real worst case once the fixtures above are shared | S |
| 🟢 | tests | `src/evidence/adapters/harness/agent-invocation.ts:1` | Lowest real coverage in the tree at 88.76% statements / 78.43% branches, 10 uncovered statements — and already named in `aidd_docs/memory/testing.md` as the remaining mutation weak spot (66.28, 29 uncovered mutants) | Drive it directly on a command string, the way `shell-tokens` and `shell-loop` were, rather than through a whole repository walk | M |

Not findings, recorded so a later reader does not re-derive them:

- `src/cli/main.ts` reports 0% statements. It is reached only by spawning `dist/cli.js`, which V8 coverage does not follow into a child process. `tests/cli/process-contract.test.ts` covers it; the number is an artefact of the measurement, not a gap.
- No `.skip`, `.todo`, `.only` or `xit` anywhere in the suite, and no `retry` configured. There is nothing quarantined and nothing hidden.
- The three sub-second sleeps that remain (`gh-process.test.ts:88`, `live-repository.adapter.test.ts:199`) are bounded aborts, not arbitrary waits, and cost nothing.

## Top actions

1. ~~**Share fixture repositories in `git-history.test.ts`** (row 1).~~ **Done 2026_08_30 — see *Outcome*.** The file is no longer the critical path; `harness-scan.test.ts` now is, which makes action 2 the next one.
2. ~~**Halve `harness-scan.test.ts` with the same template**~~ **Done 2026_08_30 — 39.6s → 20.2s.** What remains of the original action is the deeper fix: **give `trackedTree` its own suite** (it has none today; its 97% coverage is incidental), move the 6 tests that need real Git into it, and drive the other 75 on an in-memory `HarnessTree`. That is a decision, not a chore — `.claude/rules/03-testing/3-tests.md` says "never mock an internal collaborator" and `architecture.md` says this seam "is **not** a port", so it needs a deliberate amendment rather than a quiet exception.
3. **Unblock intra-file concurrency** (row 3), then split the two mega-files by axis so vitest can spread them. Nine of ten cores currently idle while one file runs; this is what converts the remaining serial work into wall clock the machine already has. Do it after 1 and 2, since per-test cleanup is a precondition. Hand off to `07-refactor`.
4. **The three small, self-contained wins** (rows 6, 7, 8): ~10s of the residual 17.8s sits in two hardcoded sleeps and one 100 MB pipe. Cheapest ratio in the report, independent of everything above. Hand off to `06-test`.

## Outcome of action 1, 2026_08_30

`git-history.test.ts` was reworked and nothing else was touched. Two changes, no assertion altered:

* **A pristine template, copied.** `git init` plus its three configs is four processes, and the file builds some seventy repositories out of them. The template is built once; every repository after it is an `fs.cp` of a pristine `.git`, which holds no absolute path and is therefore the repository those four commands would have produced. **2 431 `git` spawns → 2 072.**
* **Every history built once, by a named builder, and all of them together.** Both functions under test only read, which is what makes a repository shareable; the fixtures are memoised, so two tests naming the same history get the one repository, and the two tests that *write* to theirs take `aCopyOf` it. Construction runs eight at a time in `beforeAll` instead of one test at a time.

| | before | after |
| --- | --- | --- |
| `git-history.test.ts` in isolation | 66.35s | **22.5s** (median of 3; `harness-scan.test.ts`, untouched, held at ~40s across the same rounds as a control) |
| `git` spawns in that file | 2 431 | 2 072 |
| Full suite | 64.57s | **~48s**, now bounded by `harness-scan.test.ts` |
| `pnpm check` | green | green — 761 passed, 8 boundary rules proven, comments clean |

**The tests were verified to still bite, not merely to still pass.** Four production constants were neutered one at a time and the file went red on every one — `MINIMUM_DELIVERED_CHANGES` 5→4 (3 failures), `WINDOW_DAYS` 180→181, `ZERO_TOUCH_SHARE_FOR_AUTONOMY` 0.9→0.8, and a `size-buckets` bound 1000→1001 (1 failure each) — with the unmutated control green. The 5→4 neuter was then run against the **pre-refactor** file from `HEAD` and produced the identical `3 failed | 76 passed`: the refactor changed what the fixtures cost, not what the suite can catch.

**One cost, stated rather than hidden.** Parallel construction is more sensitive to machine load than the serial version was: two of six timed runs landed at 33–36s rather than 22s, while the untouched control did not move in the same rounds. The floor is far lower and the ceiling is roughly the old figure, so no run is worse than before — but the number is no longer as steady.

## Outcome of action 2, 2026_08_30

Route (a) only — the mutualisation, no rule touched. `harness-scan.test.ts` was reworked and nothing else.

* **The same pristine template, copied.** `git init` plus six configs is seven processes, and the file builds one repository per test. `core.excludesFile` moved into the template as `/dev/null` — an empty pattern list naming no path inside the repository — which is what let the template carry every config rather than each copy setting one again.
* **The template outlives the tests that copy it.** It is deliberately *not* registered in `created`, which `afterEach` empties after every test; the first draft was, and 154 tests failed on the second one with `ENOENT` on a template the first test had just deleted.

| | before | after |
| --- | --- | --- |
| `harness-scan.test.ts` in isolation | 39.6s | **20.2s** (three consecutive runs, 160 passed) |
| `git` spawns in that file | 1 626 | **654** |
| Full suite | 64.57s | **41.5s** |

**Where the remaining 654 spawns go, measured by subcommand** — this is what decides whether more work is worth it: 163 `commit`, 163 `add`, 161 `ls-files`, 160 `rev-parse`, 5 `config`, 1 `update-index`, 1 `init`. Construction is 51%, and the `trackedTree` reads the tests actually make are 49%. Building the fixtures in parallel would therefore reach roughly half of what is left, not all of it.

**Concurrency was tried, measured, and rejected.** `describe.concurrent` with per-test `onTestFinished` cleanup took the file from 20.2s to **5.8s** — and made it flaky: four consecutive runs gave 5, 3, 3 and 1 failures, with the failing names varying between runs and several passing in isolation. The cause is the file's 160 uses of the global `expect`, which vitest cannot attribute correctly across concurrent tests. A suite that reports the wrong test is worse than a slow one, so the change was reverted; it is recorded as a finding above with what it would take to do safely.

**The tests were verified to still bite.** Four pieces of harness production code were neutered one at a time: the `context-engineering` name table (7 failures), the `prompts` name table (4), and every `signal.throwIfAborted()` checkpoint (7) each turned the file red, with the unmutated control green. **The fourth survived** — removing the `regularFile` guard leaves all 160 green — and rerunning that same neuter against the pre-refactor file from `HEAD` also left it green, so the gap predates this work rather than being caused by it. It is filed as its own finding rather than folded into this note.

## Coverage

- **Scanned**: `tests` — 30 suites, 761 tests, measured in full and file-by-file in isolation; `git` spawn counts taken with a counting shim on `PATH`; line and branch coverage taken with `@vitest/coverage-v8`.
- **Skipped**: `code-quality`, `architecture`, `security`, `dependencies`, `performance`, `ui` — out of the requested scope, which named the test suite alone. Runtime cost of *product* code belongs to `05-performance`; this report covers only the cost of the suite.

Read-only: no source file was modified by this audit.

## Remediation completed 2026_08_30

The follow-up kept the audit's quality bar: the aim was not to increase coverage, but to retain one
observable reason for every test. `harness-scan.test.ts` now drives a faithful in-memory
`HarnessTree`; `tracked-tree.test.ts` alone keeps the five Git translation cases. This removes the
fixture boilerplate and 654 Git spawns without deleting any scan behavior. A non-regular entry now
has a regression test, so the previously surviving guard is pinned.

The command and process tests were reduced rather than multiplied: repeated identical CLI argv are
cached, while the determinism assertion still forces two fresh child processes. The killed-child
test uses a 200ms command plus a 450ms proof window, and the buffer-overflow test uses 1KiB with an
explicit buffer limit rather than 100MB. The direct `agent-invocation` cases each exercise a
separate recognition boundary (spawner, prose, triple quote, escaped literal, function recursion).
There are no duplicate test names, no skipped tests and no call-order assertions.

The follow-up run has **770 tests passing**. Coverage moved from 95.87% to **96.21%** as a side
effect of testing those boundaries; it was not used as a target.
