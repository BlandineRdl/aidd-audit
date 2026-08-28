# Plan — compose collectors into resolved evidence

## Contract (source, verbatim)

> Given the observations and execution results produced by evidence collectors,
> resolve the requested axes into evidence while preserving collector provenance.

```text
EvidenceCollector[]
        ↓
 CollectorRun[]
        ↓
 observations + provenance
        ↓
 resolveEvidence(...)
        ↓
 Evidence[]
```

Acceptance criteria, verbatim:

1. Runs the configured evidence collectors for a repository context.
2. Passes the requested path, axis vocabulary and cancellation signal through the collector boundary.
3. Resolves collected observations only through the existing evidence resolver.
4. Requested axes with no observations remain represented as `UNKNOWN`.
5. A failed collector does not turn absence of observations into negative evidence.
6. `FAILED`, `TIMED_OUT`, and `SKIPPED` runs preserve their reason.
7. Collector failures do not prevent evidence from successful independent collectors from being resolved.
8. Provenance reports which collectors completed, failed, timed out, or were skipped.
9. Observations returned before/with an unsuccessful run are handled according to the existing `CollectorRun` contract rather than invented semantics.
10. The orchestration contains no axis-specific maturity rules.
11. It contains no knowledge of White/Red/Blue/etc.
12. It contains no filesystem, Git, YAML, or vendor-specific parsing logic.
13. Tests use fake collectors at the secondary boundary; the real resolver participates in the feature tests.

## Scope

- `src/evidence/usecases/collect-evidence.usecase.ts` — new.
- `src/evidence/models/collector-provenance.model.ts` — new.
- `tests/evidence/collect-evidence.test.ts` — new.
- `tests/evidence/fake-in-memory-evidence-collector.adapter.ts` — new. An available source.
- `tests/evidence/failing-evidence-collector.adapter.ts` — new. An unavailable boundary. Two concepts, two files, per `testing.md`.

Nothing else. No adapter, no `assessment` orchestration, no CLI command, no change to
`evidence-collector.port.ts`, `observation.model.ts`, `axis.model.ts`,
`resolve-evidence.ts` or `assessment-report.contract.ts` — all frozen before the
worktree split.

## Frozen decisions

Each of these was forced; none is derivable from the criteria alone.

### 1. The use case runs the collectors and constructs the runs

`EvidenceCollector.collect()` returns `Promise<readonly Observation[]>`. It does **not**
return a `CollectorRun`. So no collector can report its own status, and the use case is
the only place a `CollectorRun` can come into existence. Criterion 1 confirms it runs
them rather than receiving finished runs.

Mapping:

| Outcome of `collect()` | Status |
| --- | --- |
| resolves | `COMPLETED` |
| rejects while `signal.aborted` | `TIMED_OUT` |
| rejects otherwise | `FAILED` |

### 2. `SKIPPED` is "supports none of the requested axes"

The port carries no skip signal, and `supportedAxes` drives nothing today. A collector
whose `supportedAxes` does not intersect the requested axes is **not called**; its run is
`SKIPPED` with a reason naming that. This is the only reading that gives `supportedAxes`
a job and gives criterion 6's `SKIPPED` a producer.

An already-aborted signal is **not** a skip: the collector is still called and is expected
to honour `context.signal`, per the collector duty frozen in `architecture.md`.

### 3. The caller owns the budget; the use case only passes the signal

Criterion 2 says *passes* the cancellation signal. The use case therefore takes an
`AbortSignal` in its input and hands it to every collector unchanged. No `setTimeout`, no
clock, no timer in a use case — and tests stay independent of wall time.

`TIMED_OUT` is consequently derived from `signal.aborted` at the moment a collector
rejects, never from a deadline the use case computed.

### 4. Requested axes are derived from the vocabulary, not passed twice

`vocabulary: readonly AxisVocabulary[]` already carries one entry per axis, handed down by
`assessment` from the loaded model (`architecture.md`, *Frozen before the split*). Adding a
separate `axes: AxisId[]` alongside it would create two sources that can disagree, and
nothing would arbitrate. Requested axes are `vocabulary.map((scale) => scale.axis)`.

### 5. Provenance names the axes a collector was *responsible* for

`ProvenanceEntry.axes` in the public contract is `readonly string[]` and the contract does
not say which axes. The use case reports `supportedAxes ∩ requested`, not "axes it produced
observations for".

The reason is criterion 8 read against a failure: a `FAILED` run has no observations, so
"axes it produced" would be empty and provenance would say nothing about what went
unserved. The intersection is uniform across all four statuses and is informative exactly
when it matters.

### 6. Resolution consumes every run's observations, regardless of status

Criterion 9. `CollectorRun` carries `observations` on `FAILED`, `TIMED_OUT` and `SKIPPED`
as well as on `COMPLETED`. The use case therefore concatenates the observations of **all**
runs and hands them to `resolveEvidence` once. It never filters on run status.

**This branch is unreachable today and no test can prove it.** A rejected promise carries
no observations, so with the current port every non-`COMPLETED` run has
`observations: []`. Writing the flat-map unconditionally is what keeps the day the port
grows a partial-result shape from being a semantics change. A code comment must say this
plainly — the alternative is a silent guarantee, which is the failure mode
`testing.md` was rewritten for.

Do **not** write a test that appears to cover it. A test that constructs a run the port
cannot produce would prove the fake, not the behaviour.

### 7. Off-vocabulary observations are not this use case's problem

`architecture.md` puts the rejection of a value off its scale "at the boundary that maps
observations into maturity input — not by resolution". This use case sits below that
boundary. It does not inspect values, does not filter observations by axis, and does not
read `AxisVocabulary` beyond taking the axis list from it. That is what keeps criteria
10–12 true by construction rather than by discipline.

### 8. Collectors run in parallel; provenance keeps configuration order

Each collector is wrapped so its wrapper never rejects, then all are awaited together.
`Promise.all` over the wrappers preserves input order, so provenance is deterministic and
one collector's failure cannot cancel another's work (criterion 7).

## Signatures

```ts
// src/evidence/models/collector-provenance.model.ts
export type CollectorProvenance =
  | {
      readonly collector: string
      readonly status: 'COMPLETED'
      readonly axes: readonly AxisId[]
    }
  | {
      readonly collector: string
      readonly status: 'FAILED' | 'TIMED_OUT' | 'SKIPPED'
      readonly axes: readonly AxisId[]
      readonly reason: string
    }
```

Self-contained, mirroring `CollectorRun`'s status union rather than importing it: `models/`
does not depend on `ports/`, and the port is frozen so the two cannot drift silently. The
same deliberate duplication already governs the three evidence-status vocabularies.

```ts
// src/evidence/usecases/collect-evidence.usecase.ts
export interface EvidenceCollectionRequest {
  readonly path: string
  readonly vocabulary: readonly AxisVocabulary[]
  readonly collectors: readonly EvidenceCollector[]
  readonly signal: AbortSignal
}

export interface EvidenceCollection {
  readonly evidence: readonly Evidence[]
  readonly provenance: readonly CollectorProvenance[]
}

export async function collectEvidence(
  request: EvidenceCollectionRequest,
): Promise<EvidenceCollection>
```

The exported function must read as business flow: run the collectors, resolve what they
observed, report who did what. Run construction, status mapping and reason extraction are
extracted helpers.

## Explicitly out of scope

**Coverage** (`axesRequested` / `axesObserved` / `axesConfirmed`) belongs to `assessment`,
which derives it from the axes it requested and the evidence it got back. It describes the
report, not the collection. `evidence` owns collector execution, provenance and resolution,
and stops there.

`INSTALL.md` and `testing.md` used to file it under `collect-evidence.usecase`; both were
corrected with this feature, along with `INSTALL.md`'s folder tree, which had
`coverage.model.ts` under `evidence/models/`.

## Tests — `tests/evidence/collect-evidence.test.ts`

Chicago style. Two doubles implementing `EvidenceCollector` — `FakeInMemoryEvidenceCollector`
for an available source, `FailingEvidenceCollector` for an unavailable boundary — and the
**real** `resolveEvidence` throughout (criterion 13). Neither reproduces resolution logic.

`FailingEvidenceCollector` throws `unknown`, which is what `catch` binds under `strict`.
That is what lets a suite pin `reasonFor`'s fallback, without which a collector throwing a
non-Error value publishes `reason: undefined` into the public contract.

| # | Criterion | Behaviour pinned |
| - | --- | --- |
| 1 | 2 | every called collector receives the requested `path`, the same `vocabulary`, and the caller's `signal` — asserted on the recorded context |
| 2 | 3 | two collectors observing the same value on one axis → `CONFIRMED` with that value; the real resolver decided it |
| 3 | 3 | two collectors observing different values on one axis → `CONFLICTING`, `value: null` |
| 4 | 3 | a `DECLARED`-only axis → `CLAIMED`, `value: null` |
| 5 | 4 | a requested axis no collector observed → `UNKNOWN`, `value: null`, `observations: []` |
| 6 | 5 | a collector that throws leaves its axis `UNKNOWN` with `value: null` — never a `CONFIRMED` negative, never a missing entry |
| 7 | 7 | one collector throws, another succeeds → the successful one's axis still resolves `CONFIRMED` |
| 8 | 6, 8 | a throwing collector → provenance `FAILED` with the thrown message as `reason` |
| 9 | 6, 8 | a collector that rejects while the signal is aborted → `TIMED_OUT` with its reason |
| 10 | 2, 6, 8 | a collector supporting none of the requested axes → `SKIPPED` with a reason, and `collect()` was **never called** |
| 11 | 8 | provenance lists every configured collector, in configuration order, each with its responsible axes |
| 12 | 5 | a non-`Error` throw still yields a `FAILED` run with a usable reason |

Every rejection-shaped assertion pins the message fragment as well as the status, per
`testing.md` — `expect(run.reason).toContain(...)` naming the collector or the cause, not a
bare truthiness check.

**Before claiming done, neuter each guard and watch its test go red**: remove the
`signal.aborted` branch (test 9 must fail), remove the `supportedAxes` intersection check
(test 10 must fail), filter `observations` to `COMPLETED` runs only (nothing may fail —
that is decision 6's unreachable branch, and a test failing there means the test built a
run the port cannot produce). Report what died for each.

## Gate

`pnpm check` — typecheck, vitest, dependency-cruiser plus `prove-boundary-rules.mjs`.
Baseline before this change: exit 0.

`usecases/` is already covered by the three `domain-has-no-*` rules, so `node:fs`,
`child_process` and any vendor import fail mechanically here — criterion 12 has a wall, not
a promise. No new dependency-cruiser rule is needed and none may be added: the new files
land in folders every relevant rule already reaches.

`pnpm build` stays red until `src/cli/assess.command.ts` exists. That is expected and is
not this feature's regression.

## Do not commit

`vcs.md`: AI auto-commit is `never`, and `/aidd-orchestrator:01-sdlc` ending in a draft
pull request does not override it. Report and stop.
