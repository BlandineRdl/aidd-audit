# Plan: render an assessment report as human-readable output

- **Date**: 2026_08_28
- **Source**: BDD scenarios supplied with the request (planning-ready, no ticket)
- **Scope**: one pure renderer plus its behaviour spec. No command, no I/O, no orchestration.

## Outcome

`aidd-audit assess <path>` without `--json` must be readable by a developer who did not
write the model. This change delivers the function that produces that text; wiring it into
`assess.command.ts` is a later step and is deliberately out of scope.

## Deliverables

| File | Role |
| ---- | ---- |
| `src/cli/renderers/human.renderer.ts` | `renderHumanReport(report: AssessmentReport): string` |
| `tests/cli/human-renderer.test.ts` | the behaviour spec, one describe per scenario |
| `tests/cli/assessment-report.fixture.ts` | shared builder for a valid `AssessmentReport` |

## Contract

- Input is the frozen `assessment-report.contract.ts`. It is **not** modified: this feature
  is a consumer, and a public shape change would be breaking.
- Output is a `string`. The function is pure: no `console`, no `process`, no filesystem, no
  colour codes, no `Date.now()`. Same report in, same string out.
- No business logic. The renderer reads outcomes already decided upstream; it never derives
  a level, never resolves an outcome, never re-ranks anything.
- Axis and level names are always taken from `label` / `id` in the report. The renderer
  hardcodes no axis name and no level name — `aidd.yml` labels axes in French and a
  `--model` may label them anything.

## Acceptance criteria

### 1. A proven level exists

Given `proven` is the Green level report and `next` is Copper,
the output names Green as the proven maturity level and Copper as the next level.

### 2. No level can be proven

Given `proven` is `null`,
the output states that AIDD could not establish a maturity level, and the word `White`
never appears as the proven level. `proven ?? white` and any equivalent fallback is
forbidden — "no proven level" sits above the scale's floor, not below it.
Naming White in a blocker is legitimate; presenting it as the result is not.

### 3. A practice gap blocks progression

Given a blocking requirement with `gap: 'PRACTICE'` (`evidence: 'CONFIRMED'`,
`outcome: 'NOT_MET'`),
the output says the observed practice is below what the requirement asks, and shows the
observed value against the threshold.

### 4. An evidence gap blocks progression

Given a blocking requirement with `gap: 'EVIDENCE'` (`outcome: 'UNPROVEN'`),
the output says the requirement could not be established and names the evidence status
(`UNKNOWN` / `CLAIMED` / `CONFLICTING`).
It must not recommend changing, improving or fixing the underlying practice, and must not
state the practice falls short. `AIDD must never recommend changing a practice merely
because it failed to prove that practice.`

### 5. The two gaps never read alike

A `PRACTICE` blocker and an `EVIDENCE` blocker on the same axis produce visibly different
text. The test asserts they differ, so a future refactor cannot collapse them into one
sentence.

## Amendment, 2026_08_28, after review

Two decisions in the first draft of this plan were wrong and are reversed here.

- **`coverage` and `provenance` are back in scope.** `cli.md` requires that when `proven` is
  null the renderer "names what is missing". Deferring those two fields until
  `collect-evidence` exists was a mistake: both are already on the frozen contract, so the
  duty can be discharged now, and without them a `proven: null` report is three lines that
  leave a reader with nothing to act on.
- **The `no-orphans` warning claimed below never fires.** `human.renderer.ts` imports the
  contract, so it has an outgoing edge and dependency-cruiser does not classify it as an
  orphan. `pnpm architecture` prints zero warnings.

### Added acceptance criteria

6. **A null-proven report names what is missing.** Given `proven: null`, the output reports
   evidence coverage (axes observed and confirmed against axes requested) and every
   provenance entry that did not complete, with its reason. A collector that failed or timed
   out is the sharpest available explanation of an evidence gap and must reach the reader.

7. **An ambiguous threshold is never guessed.** A blocking requirement carries no
   requirement identity, so when more than one requirement on its axis shares its
   `(evidence, outcome)` pair the renderer cannot know which threshold it refers to. It then
   renders the blocker without a threshold rather than quoting a possibly wrong one. Printing
   a number that may be false is worse than printing none — that is the conservative rule
   applied to rendering.

8. **Every blocker branch is proven by an isolated assertion.** Each test asserts against the
   blocker line it is about, never against the whole output, so no assertion can be satisfied
   by unrelated prose elsewhere in the report. The no-match fallbacks (a `level` or `axis` id
   the report no longer carries) are exercised and asserted.

9. **The axis outcomes are glossed.** `NOT_MET` and `UNPROVEN` are where the reader first
   meets the distinction the product sells; the raw enum names alone do not carry it.

## Amendment 2, 2026_08_28, after re-review

Two behaviours below were wrong, both on the same fault line: the renderer stated a cause it
could not support.

10. **The null-proven headline names no cause.** `proven: null` currently renders "Evidence
    coverage was insufficient to confirm even the baseline level." That is an evidence claim,
    and it is false whenever the baseline failed on a confirmed practice instead — a report
    with `4 of 4 axes confirmed` and a `NOT_MET` blocker prints it and then contradicts
    itself two lines later. The headline must say only that no level could be established,
    and let the blocking requirements carry the reason. Naming the wrong gap kind is the
    product's central failure mode wearing a different hat.

11. **A collector that did not complete is always reported.** Silencing non-`COMPLETED`
    provenance once a level is proven contradicts the frozen port: exceeding a budget "is
    reported as `TIMED_OUT`, never as a silent hang". A proven level obtained from partial
    collection is exactly the case a reader must be told about. Coverage counts may stay
    scoped to the null-proven path — once a level is proven the counts are trivially full —
    but the failed, timed-out and skipped collectors may not.

12. **What went dark is named, not just counted.** `ProvenanceEntry.axes` is on the contract
    and unrendered. A reader told "1 of 4 axes confirmed" cannot act; a reader told which
    three axes the failed collector was carrying can.

## Out of scope

- `assess.command.ts`, `json.renderer.ts`, and the `--json` flag.
- `BlockingRequirement` carries no requirement identity, which is why AC7 exists at all. That
  is a gap in the frozen public contract, not in this renderer. It is recorded for Frame and
  deliberately not fixed here: the contract is shared across worktrees and changing it is a
  breaking public shape change.

## Verification

`pnpm check` (typecheck, vitest, dependency-cruiser + boundary proof) must exit zero.
