# CLI

The command-line tool: its commands, inputs, and distribution.

## Commands

- `aidd-audit assess <path>` — assess a repository or a fixture bundle and report its highest proven maturity level. The single command of the MVP.
- `runAssess(argv, io)` in `assess.command.ts` is the command itself: parse argv, `statSync` the subject, `loadMaturityModel`, `assessMaturity`, render, write to `io.stdout`. Importing the module runs nothing, which is what lets the suite drive it in process with a capturing `CommandIo`, no spawn and no build. `main.ts` is the only file that touches `process`: it calls `runAssess` with `process.argv` and real `process.stdout`/`stderr` writers, and assigns the result to `process.exitCode` — never `process.exit()`, which would truncate a pending write.
- No collection timeout is set. `CollectorContext.signal` makes honouring the budget a collector's own duty, and the one production collector honours it; a constant here would still be a number nobody measured. `runAssess` still owns an `AbortController`, aborted in `finally`, so the seam exists and the budget lands with the first real collector.
- **`collectors` holds one production collector: `LiveRepositoryEvidenceCollector`.** It answers one subject kind — the root of a Git work tree — and stays silent on anything else. **No reference profile reaches its expected level, and none can yet**: a bundle is not this collector's subject, so `aidd-audit assess <profile>` still reports `proven: null` whatever `testing.md`'s table says. That waits on the fixture bundle adapter, which plugs into the same field with no signature change.
- **A bundle tracked inside a repository is why the subject gate exists.** `profiles/` lives in this checkout, so without it the collector would resolve to the AIDD root and publish this project's own harness as the bundle's evidence. The gate is provisional and its consequence is real — a directory *inside* a repository now yields no evidence either. See `aidd_docs/tasks/2026_08/2026_08_29_live-repository-collector/plan.md`.

**A live repository cannot be assigned a level in the MVP, and this is a ceiling, not a bug.** `intervention` counts corrective commits made after a change was opened; an opening event is a forge concept, and a forge API is out of MVP scope. No local history recovers it, merge-based included — a merge records that a branch landed, never what followed review. `size` needs the same change boundaries and so is observable only where merge commits preserve them, which excludes squash and rebase histories. Every level of `aidd.yml` declares all four axes, so one `UNKNOWN` axis is enough: `assess <a repository>` reports `proven: null`, and `assess <a bundle>` is what classifies. The renderer path for `proven: null` is therefore the live command's normal output, not its edge case. Lifted by a forge collector, post-MVP, behind the same port.

**Two different reasons yield no level on a live repository, and only one of them expires.** The sample floors in `git-history.ts` — 5 delivered changes for `size`, 5 active days for `parallelism` — withhold those axes on a young history; they lift on their own as merges and active days accumulate, and this repository has not yet crossed them. `intervention` does not lift: no local history carries it at any age, so a repository at 500 merges still reports `proven: null`. Waiting is enough for the first, and never enough for the second — the ceiling on self-assessment is the missing forge source, not the youth of the checkout. The floors' value is chosen and not measured, and the rationale, including why it is not to be lowered to make a repository classify, is written where they are declared.

## Interface

- `--json` renders the frozen `assessment-report.contract` instead of the human explanation. It is the contract adapters and tests bind to.
- `--model path/to/custom.yml` overrides the built-in `aidd.yml`.
- Two renderers, no business logic in either: `json.renderer` (the contract) and `human.renderer` (the explanation).
- `json.renderer` projects the contract field by field rather than stringifying the report it is handed, so a field the contract does not declare never reaches the published output. Stable key order falls out of that allowlist for free; it is a consequence, not the reason, and no consumer should read meaning into JSON key order.
- `--json` **refuses** a report holding a non-finite number instead of publishing it. JSON renders `NaN` and `Infinity` as `null`, and `null` in this contract means absence — `observed: null` is "not observed", `proven: null` is "no level established". Publishing one would fabricate an evidence gap no collector reported. There is no faithful substitute, so the renderer throws `UnrenderableReportError` naming the field's path. Refusing is not business logic: it decides nothing about maturity, it declines to publish a document it cannot publish truthfully.
- The human output must expose the blocking axis and its evidence status, so that "not mature enough" and "we don't know yet" never read as the same conclusion.
- A third state sits above both: no collector ran at all, so nothing was ever looked at. `human.renderer.ts` names it (keyed on `report.provenance.length === 0`) before a reader reaches the blocking list, so "we looked and found nothing" is never mistaken for "we never looked". It is no longer the ordinary case: the live collector is always asked, so it reports itself in `provenance` even when it answers nothing. An empty `provenance` now means the model declared no axis this collector supports.
- When `proven` is null the renderer says the subject could not be classified and names what is missing. It never prints White, and never renders the result as lower than a level: "no proven level" is above the scale's floor, not below it.

## Process contract

The exit code answers *did the assessment run*, never *how mature is this repository*. It classifies **responsibility, not error sub-type**.

| Code | Cause |
| ---- | ----- |
| `0` | the report was published — any result, `proven: null` included, and any run whose collectors merely failed or timed out |
| `2` | the caller's fault — `UsageError` and `InvalidMaturityModelError`: a malformed invocation, a subject path naming nothing, a model that cannot be loaded |
| `1` | ours — anything else, `UnrenderableReportError` included |

A caller that only checks non-zero cannot tell "you typed it wrong" from "the tool broke"; this taxonomy lets it, and stops there. Finer codes per failure family were considered and rejected: splitting the subject fault from the model fault would publish a promise no consumer asked for, and stderr already names which of the two it was.

`tests/cli/process-contract.test.ts` pins `0` and `2` through the built binary. **`1` is still untested, and it is no longer unreachable.** It was unreachable while `collectors` was `[]`. A production collector now emits observed values, so `InvalidObservationError` is reachable in principle — a collector emitting a value off the loaded scale would raise it. The live collector cannot: it drops any member the model's scale does not carry, and that dropping is pinned. So the path is reachable by *some* collector and not by *this* one, which is a weaker guarantee than before and worth saying plainly. Still owed a test, and `collectors` has to become injectable before one can be written. Recorded as owed, never as covered.

- **stdout carries the rendered report and nothing else; stderr carries everything else.** Both renderers return a whole string before `io.stdout` is called, so a non-zero exit leaves stdout empty rather than truncated — up to the first byte written, after which a closed pipe (`assess . --json | head -1`, `EPIPE`) is the reader's business and no outcome of this contract. stdout ends with exactly one newline: `json.renderer` emits none and `runAssess` appends it.
- **When two inputs are bad at once the first failure wins**, in `runAssess`'s statement order: argv, then subject, then model. All three are `2`, so the order decides which explanation the caller reads, never which code.
- **The subject check is pre-flight, not in-flight.** `requireExistingSubject` runs one `statSync` and never reads inside the subject; a permission or I/O failure met *during* collection belongs to the collector that met it — `FAILED` in `provenance`, exit `0`. Without that line "unreadable" would match two outcomes at once. The check lives in `cli/` because `domain-has-no-filesystem` bars `usecases/` from `node:fs`.
- **A file is an accepted subject.** `requireExistingSubject` rejects only what is absent or is neither a file nor a directory, so `aidd-audit assess package.json` exits `0` with a report naming it. Today both reference subject kinds — a repository and a fixture bundle — are directories, so nothing needs the file case yet; it is kept because a bundle is plausibly a single file later. The cost is real: any readable file gets a well-formed, empty assessment. Narrow it in `requireExistingSubject` if a bundle turns out to always be a directory.
- **An unusable input is a process failure; an unproven assessment is a success.** A missing subject path exits `2` rather than reporting `proven: null`, which would publish an evidence gap no collector met and read as a verdict on a repository that was never opened. An unloadable model exits `2` with no report at all — told from `proven: null` without reading a word, by exit code and by whether stdout holds a document.
- **The `--json` refusal is ours, not the caller's, and it has no counterpart in prose.** A non-finite number makes `json.renderer` throw `UnrenderableReportError` → `1`; `human.renderer` holds no such guard, so the same report exits `0` there with `NaN` in its text. JSON turns `NaN` into `null`, which this contract reads as a reported absence — the lie is plausible and silent. Human prose prints `NaN`, visibly wrong, misleading nobody. The guard sits where the ambiguity is created.
- **Determinism reaches the output.** The same subject and the same model produce the same stdout bytes and the same exit code, on any machine, on any day: no timestamp, no duration, no hostname.
- **`subject.path` echoes the operand as given** — a decision, not a consequence. Resolving it to an absolute path would put the machine's layout into a document the line above requires to be byte-identical across machines, and would print `/Users/…/profiles/arthur` where the caller typed `./profiles/arthur`. The pre-flight `statSync` resolves the path to look at it and reports the operand either way.
- Failures are prose on stderr, never JSON, even under `--json`: the contract is the only versioned public shape and it appears only on stdout. The exit code is the machine-readable channel. A JSON error envelope would be a second public contract with no consumer; adding one later is additive.
- Not promised, so nobody should assume it: `--help`, `--version`, signal handling, TTY detection, colour, `--quiet`/`--verbose`, and the wording of any warning stderr carries on a successful run. The report is identical whether or not stdout is a terminal.

## Distribution

- **Not published.** `package.json` is `private: true`. The tool is built and run locally: `pnpm build`, then the `aidd-audit` bin from `dist/cli.js`.
- The package name `aidd-audit` exists because `aidd` is already taken on npm by an unrelated package.
- tsup produces one bundled entrypoint, so publishing later needs no restructuring — only dropping `private` and adding `files`.

## Boundary

`cli/` is a driving adapter: it parses input, invokes `assess-maturity.usecase`, and renders the public contract. Nothing else. A Claude plugin will be a second driving adapter post-MVP, over the same core.
