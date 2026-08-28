# Review 1: compose collectors into resolved evidence

- **Verdict**: approved after two repairs, both applied. No blocking finding remains.
- **Candidate**: five new files, uncommitted — `src/evidence/usecases/collect-evidence.usecase.ts`, `src/evidence/models/collector-provenance.model.ts`, `tests/evidence/collect-evidence.test.ts`, `tests/evidence/fake-in-memory-evidence-collector.adapter.ts`, `tests/evidence/failing-evidence-collector.adapter.ts`
- **Plan**: `aidd_docs/plans/collect-evidence.plan.md`
- **Rules read**: `0-use-cases.md`, `1-clean-code.md`, `1-file-naming.md`, `2-typescript-domain-modeling.md`, `.dependency-cruiser.cjs`
- **Date**: 2026_08_28
- **Note**: the independent checker agent died on a session rate limit before reading a file. This review was run directly instead, by mutation rather than by reading the tests.

---

## Harness control

Unmutated: **12/12 green**. A comment-only mutation **survived**. The harness therefore
distinguishes survival from a broken run, which is the precondition `testing.md` requires
before any sweep result may be believed.

## Mutations

| # | Mutation | Outcome |
| - | -------- | ------- |
| M1 | `reasonFor` ternary → `String(error)` always | **survived** before repair, kills 2 after |
| M2 | comment text only | survived (control) |
| M3 | `responsibleAxes` → raw `supportedAxes`, no intersection | kills 2 |
| M4 | `path: request.path` → `'.'` | kills 1 |
| M5 | `vocabulary: request.vocabulary` → `[]` | kills 1 |
| M6 | COMPLETED provenance `axes` → `[]` | kills 1 |
| M7 | non-COMPLETED provenance `axes` → `[]` | kills 3 |
| M8 | `resolveEvidence(observations, requestedAxes)` → `[]` | kills 6 |
| M9 | SKIPPED reason drops the collector id | kills 1 |
| M10 | `signal.aborted ? 'TIMED_OUT' : 'FAILED'` → `'FAILED'` | kills 1 |
| M11 | `if (responsibleAxes.length === 0)` → `if (false)` | kills 2 |
| M12 | observations filtered to COMPLETED runs | **survives by design** — plan decision 6 |

M12 is the one survivor left, and it is the branch the plan predicted no test can reach: a
rejected `collect()` carries no observations, so under today's port every non-`COMPLETED`
run has `observations: []`. The code comment names it. A test that killed M12 would have
built a run the port cannot produce, proving the fake rather than the behaviour.

## Findings

### 1 — `reasonFor`'s ternary was a live branch no test could kill · **blocking, repaired**

`error instanceof Error ? error.message : String(error)` collapsed to `String(error)` left
all 12 tests green: `String(new Error('exploded on read'))` is `"Error: exploded on read"`,
which `expect.stringContaining('exploded on read')` accepts. The assertion named the rule
and asserted something weaker than it.

`reason` reaches the public `ProvenanceEntry` and from there the human output, so the
difference is user-visible, not cosmetic. The two Error-based assertions and the non-Error
one are now exact equality. M1 kills two tests.

The SKIPPED assertion stays `stringContaining('irrelevant')`: that reason is a composed
sentence, and M9 proves it is pinned to the collector id.

### 2 — `runs[index]!` bypassed the type system · **blocking, repaired**

`2-typescript-domain-modeling.md`: *never cast to bypass type safety; narrow the value or
fix the type.* The assertion was only needed because `plans` and `runs` were parallel
arrays zipped by index. `runCollector` now returns the run and its responsible axes
together as one `CollectorOutcome`, so the pair never has to be re-associated and the
`CollectorPlan` intermediate disappears with it.

### 3 — the unreachable-branch comment satisfies the comment rule · **correct as is**

It states the current invariant and the reason the code is written unconditionally. It
recounts no history and restates no control flow.

### 4 — the orchestration knows nothing it must not · **correct as is**

No axis name, no level name, no value inspection, no vocabulary reading beyond taking the
axis list from it. `usecases/` is already inside all three `domain-has-no-*` rules, so
filesystem, process and vendor imports fail mechanically rather than by discipline.

### 5 — the shape fits the next consumer · **suggestion, not acted on**

`CollectorProvenance` maps field-for-field onto the contract's `ProvenanceEntry`, and
`CoverageReport` is derivable from `Evidence[]` downstream — `axesObserved` is
`observations.length > 0`, `axesConfirmed` is `status === 'CONFIRMED'`. No workaround is
forced on `assess-maturity.usecase`.

Coverage was assigned to this use case by both `INSTALL.md` and `testing.md`, and is not
built here. **Settled by the developer: it belongs to `assessment`**, which derives it from
the axes it requested and the evidence it got back — it describes the report, not the
collection, and `evidence` never counts on behalf of a report it does not build. Both
lines, `INSTALL.md`'s diagram and its folder tree (which filed `coverage.model.ts` under
`evidence/models/`) are corrected.

### 6 — the doubles belonged in their own files, split by what they represent · **blocking, repaired**

Raised by the developer over two passes. The double began as an inline `recordingCollector`
factory taking a behaviour callback, which hid it from the next suite binding to
`EvidenceCollector` and let a suite smuggle logic into it. Extracting it to one class with a
`readonly Observation[] | Error | string` result fixed the location and not the shape: a
union widened until one class can play both an available source and an unavailable one is a
scenario machine driven by the branches of the test.

Final shape, two concepts and two files:

- `FakeInMemoryEvidenceCollector` — an available source, constructed with the observations
  it returns, recording every context it was handed.
- `FailingEvidenceCollector` — an unavailable boundary, constructed with the value it
  throws, typed `unknown`.

`unknown` rather than `Error` is not a widening for the test's convenience. Under `strict`,
`catch (error)` binds `unknown` — verified: `tsc --strict` reports
`TS18046: 'error' is of type 'unknown'` on `error.message`. So `reasonFor`'s branch is
imposed by the compiler, not by the test, and no adapter convention can remove it: the only
alternatives are a cast, which `2-typescript-domain-modeling.md` forbids, or dropping the
`.message` shortcut and publishing `"Error: exploded on read"` where the field means the
message. Mutating `reasonFor` to `(error as Error).message` kills exactly one test — without
it a collector throwing a non-Error publishes `reason: undefined` into `ProvenanceEntry`.

The split also strengthened the SKIPPED test without being asked to. It used to hand the
use case a collector that threw `should never run`, proving absence of a crash. It now hands
it a fake that would have **succeeded**, so `contexts.length === 0` proves absence of a
call — the behaviour, not its symptom.

## Final sweep, after the split

| Mutation | Outcome |
| -------- | ------- |
| `reasonFor` → `String(error)` | kills 2 |
| `reasonFor` → `(error as Error).message` | kills 1 — the non-Error test |
| `signal.aborted ? 'TIMED_OUT' : 'FAILED'` → `'FAILED'` | kills 1 |
| `if (responsibleAxes.length === 0)` → `if (false)` | kills 2 |
| `responsibleAxes` → raw `supportedAxes` | kills 2 |
| observations filtered to COMPLETED runs | survives by design (decision 6) |

Control green, same single survivor across all three sweeps. Neither the extraction nor the
split weakened anything.

## Gate

`pnpm check` exits 0 — typecheck clean, **180/180** tests across 9 files (12 new),
depcruise clean (24 modules / 44 dependencies), 8 boundary rules proven with 16 sentinels.
`pnpm build` stays red: still no `src/cli/assess.command.ts`. Not this feature's regression.

Nothing committed. `vcs.md` reserves that for a human word on the outcome.
