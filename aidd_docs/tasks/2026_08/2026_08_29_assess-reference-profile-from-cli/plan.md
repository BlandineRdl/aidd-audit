---
objective: "`aidd-audit assess <path>` runs the real load → collect → resolve → compose → render pipeline and writes its report to stdout, closing the build gate."
status: implemented
---

# Plan: assess a reference profile from the CLI

## Overview

| Field      | Value                                                                                   |
| ---------- | --------------------------------------------------------------------------------------- |
| **Goal**   | Wire the already-built contexts into an executable command, adding no business rule.     |
| **Source** | SDLC delivery contract, framed from the `/aidd-orchestrator:01-sdlc` request (raw text). |

## Phases

| #   | Phase                    | File                         |
| --- | ------------------------ | ---------------------------- |
| 1   | the assessment sequencer | [`phase-1.md`](./phase-1.md) |
| 2   | the executable command   | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision                                                                                                          | Why                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The CLI loads the maturity model and hands it to `assessMaturity`; no `maturity-model.port.ts` appears.            | `assessment-composes-never-adapts` forbids `src/assessment/` → `src/*/loading/`, and `prove-boundary-rules.mjs` already proves that rule from `src/assessment/usecases/`. A sequencer that loaded the model would breach a wall the gate actively tests. Resolving `--model` or the packaged default is input parsing, which is the driving adapter's job. `architecture.md`'s note that the use case "will load the model" is corrected, not ignored. |
| The maturity → evidence vocabulary projection lives in `assessment/composition/axis-vocabulary.ts`.                | `evidence` may not import `maturity`, so someone must translate. `assessment` is the only context that sees both, and `composition/` already holds its other peer-to-peer projection (`CollectorProvenance` → `ProvenanceEntry`). It is a translation between two declarations of the same vocabulary, not a new rule: the model's scale *is* the vocabulary. |
| The production collector set is empty, and that is the shipped behaviour.                                          | No production `EvidenceCollector` exists and the scope limit forbids writing one. Every axis resolves `UNKNOWN`, `proven` is `null`, exit code 0. `cli.md` already records `proven: null` as the live command's normal MVP output. The seam is a `collectors` field on the request, so the fixture and live-repository adapters plug in with no signature change. |
| `runAssess(argv, io)` is the command; `main.ts` is the executable shell and the tsup entry.                        | Criterion 16 wants stdout, stderr and exit code observed without a build step. Importing a module that runs on import would execute the CLI inside vitest. Splitting the shell off is what makes the boundary testable in process. |
| Exit 0 success, 2 expected user error, 1 unexpected defect.                                                        | Criterion 12 asks only for non-zero, but a caller that cannot tell "you typed it wrong" from "the tool broke" has to parse stderr. `UsageError` and `InvalidMaturityModelError` are the user's fault; anything else, `UnrenderableReportError` included, is ours. |
| No collection timeout is set.                                                                                      | The port makes honouring `context.signal` a collector's duty, and there are no collectors. A budget constant now would be a number nobody has measured, guarding nothing. The CLI owns an `AbortController` it aborts in `finally`, so the seam exists and the timeout lands with the first real collector. Named as a ceiling in `cli.md`, not left silent. |
