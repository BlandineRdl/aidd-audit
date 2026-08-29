# Self-assessment

AIDD assessed by the binary AIDD ships, through the pipeline every other repository goes
through. No new collector, no new contract field, no model change.

## What was actually missing

`aidd-audit assess .` already ran before this task: the live collector was wired, the
subject gate accepted a repository root, and the report came back with exit `0`. Three
things did not hold.

* **Prose dropped what was observed.** `--json` published every requirement's `observed`
  value and its evidence status; the human renderer printed the axis outcome and stopped.
  A reader of prose could see `Harness: MET` and never learn on what, so "we looked and
  confirmed this" and "we could not look" reached the same line shape. The two renderings
  described the same verdict at incomparable fidelity.
* **Nothing exercised the self-assessment at the process boundary.** `process-contract.test.ts`
  proved the exit codes and the streams, and asserted in passing that the collector reached
  the pipeline. No suite asserted that the assessment of this repository is derived from
  evidence, that prose and JSON agree, or that no path spelling changes the result.
* **`dist/` had one owner and needed two.** `process-contract.test.ts` built the bundle in
  its own `beforeAll`, and `tsup.config.ts` sets `clean: true`. A second suite spawning the
  binary would have had the folder emptied under it mid-run.

## The three changes

### The renderer names what was observed

Every axis line of a rendered level now carries one detail line per requirement:

```
  Harness: MET
    required: an empty set · observed: prompts, context-engineering, behavior (CONFIRMED)
  Taille: UNPROVEN (evidence gap)
    no observation was made (UNKNOWN) — the requirement was never tested
```

Four readings were forced, and none is cosmetic. Each is pinned by its own assertion,
because the first cut of this list named three and asserted two — the pattern `testing.md`
records as what this repository gets wrong.

* **`no observation was made` and `observed: an empty set` are different sentences.** A
  collector that returned `[]` looked and found no harness member; a `null` observation
  means it could not look at all. The first licenses a practice conclusion, the second
  forbids one — the product's central distinction, and it now survives into prose. The
  wording is load-bearing: "nothing was observed" was the first draft, and beside a `size`
  threshold whose own value is `none` it read as a matched pair — nothing required, nothing
  found — on an axis the line above had just called UNPROVEN.
* **An unobserved requirement prints no threshold.** The first cut printed one, and on
  `perceval` produced `required: an empty set · no observation was made (UNKNOWN)` under
  `Harness: UNPROVEN` — a line that reads as self-contradictory, since the level asks for
  nothing and the axis blocks anyway. Nothing was compared, so naming the threshold asserts
  a test that never ran. Dropping it removes the misread at every vacuous threshold at once
  and costs no fidelity: `--json` still carries the threshold.
* **The evidence status prints even when `CONFIRMED`.** It is noise on the happy path and it
  is the only thing separating `CLAIMED` from `CONFIRMED` at the same observed value. The
  report exists to keep that separable.
* **An empty list reads `an empty set` on both sides, never `none`.** White's harness
  requirement is the empty set; joining it would render an empty string, which reads as a
  value the renderer failed to find. Threshold and observation share the rendering because
  they are the same value — and `none` is unavailable for it, being a scale member
  `aidd.yml` already ships on `size`.

Per requirement, not per axis: an axis may carry several, and the report has no per-axis
observed value to summarise. `findUniquePracticeRequirement` already refuses to guess when
an axis carries more than one; this renders all of them instead.

### The bundle is built by the run, not by a suite

`tests/build-cli-bundle.test-setup.ts` is a vitest `globalSetup`. The bundle is a resource of
the run, so the run builds it, once, before any suite. Building at all is still what makes
"the real binary" true — what the suites spawn is this working tree's bundle, never a stale
artefact from an earlier branch. `tests/cli/spawn-cli.test-fixture.ts` carries the spawn
helper both CLI suites now share, so the two cannot drift on how they invoke the process.

### The self-assessment suite

`tests/cli/self-assessment.test.ts`. The subject is this checkout, and the need is
**assess AIDD honestly, not make AIDD award itself a particular level** — so the suite tests
the capability and its invariants, never the state of the repository or of the collector set:

* the collectors that ran include `live-repository` and none is a double — the actual
  criterion, which is that nothing was faked for AIDD's benefit;
* no requirement is `NOT_MET` on evidence that is not `CONFIRMED`;
* every unobserved axis is `UNKNOWN`, `UNPROVEN`, and filed as an evidence gap;
* `proven` null implies a non-empty `blocking`; otherwise the proven level is `MET`;
* prose states the proven verdict, the next level, every axis outcome, every observed
  value and every blocking axis that the contract carries;
* `assess .` and `assess <absolute root>` differ only in `subject.path`;
* the same subject twice produces the same bytes.

### Three assertions were written and then removed

Each photographed the implementation or the repository instead of the capability. Recorded
because each looked reasonable when written.

* **`toEqual` on the whole `provenance` array.** It pinned that exactly one collector exists.
  A forge collector landing beside the live one is the feature working better, and would have
  turned the self-assessment red. Replaced by the property that actually matters: the list
  contains `live-repository` and no id matching `/fake|stub|mock|fixture|self/i`.
* **`axesObserved > 0`.** Its own comment admitted it rested on the harness this checkout
  happens to carry. That is AIDD's state, not its ability to assess itself. Dropped; the
  observed values are still checked, but only for agreement between the two renderings.
* **`proven` pinned to `null`.** Defended in review as a tripwire on the documented MVP
  ceiling. It is not: when a forge collector makes `intervention` observable, the
  self-assessment capability will not have changed — the available evidence will have. Freezing
  the expected verdict of AIDD on AIDD is the one thing the feature explicitly must not do.
  The both-branch property in the list above says the invariant instead.

### And one was moved

`assess profiles/perceval` observing nothing proves the repository-root gate, which is the
collector's behaviour and not the self-assessment's. It now sits in
`live-repository.adapter.test.ts` as a directory inside a work tree — a case that suite did
not previously cover, since it tested only a directory that is no work tree at all. It was
also destined to change under the reference-profiles acceptance work, which would have made
a self-assessment suite red for a reason having nothing to do with self-assessment.

## What this repository cannot prove, and why that is right

`proven: null`, with `harness` `CONFIRMED` and `size`, `intervention` and `parallelism`
`UNKNOWN`.

* `intervention` is unobservable on any local history — the documented MVP ceiling.
* `size` and `parallelism` are unobservable **here** for a different reason:
  `MINIMUM_DELIVERED_CHANGES` and `MINIMUM_ACTIVE_DAYS` are both `5`, and this repository
  has three merge commits. A sample is not a habit.

Both were left alone. Lowering a minimum, or letting the model ask less, would have bought
a nicer self-assessment by weakening the rule that makes any assessment worth reading. The
honest answer to "how mature is AIDD" is that its own history is too short to say, and the
report says exactly that.

## What the blocking section still cannot say

`no observable evidence was established` was `UNKNOWN` restated in longer words. It named
nothing missing, which is exactly what `project-brief.md`'s conservative rule owes a reader:
*"AIDD must explain what evidence is missing or conflicting."* The line now names who was
asked — `asked live-repository, and no value was observed` — and prose gained a
`Collectors that ran:` line, since only failures had a section and a clean run never told
the reader whether one collector had looked or ten.

**Why a collector that ran emitted nothing for a given axis is still unsaid.** The reasons
exist and are known — `intervention` is a forge concept; `size` and `parallelism` need five
delivered changes against this repository's three — but none of them is in the report. A
`COMPLETED` provenance entry carries no per-axis reason, so a renderer that explained the
gap would be holding domain knowledge the contract never gave it, which is business logic in
a driving adapter. Lifting it needs a field on `ProvenanceEntry`, and the contract is frozen.
Recorded as owed, and deliberately not faked here.

## One cost taken knowingly

* **`expect(run.stderr).toBe('')`** is stricter than `cli.md` promises — it reserves the
  right to warn on a successful run. Held anyway: a warning appearing on the tool assessing
  itself is worth one red suite.
