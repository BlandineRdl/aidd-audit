# Resolutions, 2026-08-30

The nine phase files were written in parallel from one brief and contradict each other in thirteen
places. Each is settled here, once, and the phases are patched to match. **Where a phase and this
file disagree, this file stands.**

## R1 — The composition root wires the roster, and one walk means one walk

`ForgeContributorRosterAdapter` was specified with a `RepositorySlug` alone, and then needed three
things that construction cannot reach: the harness scan, the proving paths under it, and the
delivered-changes sample the forge collector had already walked. Phases 6, 7 and 8 each assumed a
different neighbour would supply them, and between them nobody did.

`cli/` is the composition root and already builds both collectors. It builds the rest:

* **One delivery reader, memoised on the walk, shared by the forge collector and the roster.** Phase
  1 splits `readForgeDerivedMetrics` so the sample can be reused; a second object walking it again
  makes that split decorative and costs a third forge round trip. The reader is passed to both, so
  "one walk" is a fact of the call graph.
* **One `HarnessTree`, from `trackedTree`, passed to the roster adapter.** The roster runs
  `scanHarness` over it to obtain `provenBy` — and therefore the proving paths phase 5 consumes and
  the harness-set total phase 8 renders.
* **The roster emits the harness observation on every record itself**, from that scan. Phase 6 put
  the join in composition and phase 7 put it in the adapter while forbidding composition from
  borrowing; the adapter now holds it, and phase 7's "never fall back to the repository's evidence"
  rule stands with no exception, because nothing falls back — the value is computed from the same
  tree, deterministically identical to the collector's.

**The cost, stated rather than hidden:** the tree is scanned twice per assessment, once by the live
collector and once by the roster. A tree walk is local, and the alternative — one scan handed to
both — moves `LiveRepositoryEvidenceCollector`'s constructor, which no phase in this plan otherwise
touches. Revisit it when a measurement says the second scan costs something.

## R2 — A failed read is `FAILED`, never an empty roster

`commit-history.ts` answers `null` for five refusals — an unparseable page, a payload carrying no
connection, the page cap reached with more offered, a window end that is not finite — and
`harness-authorship.ts` answers `null` when `git` refuses. Phase 6 classified only *thrown* errors,
so every one of those would have assembled zero records and published `{ status: 'COMPLETED',
records: [] }`, which phase 8 renders as "no account was active in the last 180 days".

**A read that failed would have stated something about people.** That is the product's central
failure mode, reached by an omission rather than a decision.

`null` from either walk is `FAILED`, with a reason naming which walk returned it. Only an abort is
`TIMED_OUT`. `COMPLETED` with no records means the walks succeeded and the window held nobody, and
that sentence is the only one entitled to say so.

## R3 — `HarnessAuthorship` is a model, and it is two counts or nothing

Three shapes were declared for one thing. Settled:

* It lives in `src/evidence/models/harness-authorship.model.ts`, on the footing
  `collector-provenance.model.ts` already sits there: a shape shared by a port and an adapter is a
  model, and a port that declared it would be importing nothing but still owning a shape its own
  adapters define.
* `HarnessAuthorship { readonly files: number; readonly commits: number }`, and the record's field is
  `HarnessAuthorship | null`. **`null` is a walk that did not run**, which phase 5 is right to keep
  distinct from two zeros: publishing zero from a refused walk states that a person wrote none of
  the harness, which is a claim nobody observed.
* **`members` is dropped.** Phase 7 proposed a per-member breakdown that phase 5 cannot produce and
  deliberately does not: authorship is read over the flattened union of proving paths. A per-member
  column is a feature nobody asked for and it would need its own decision.
* The harness-set total is **one number on the block, not on a row** — every row shares one
  denominator, and repeating it per row invites two rows disagreeing about the size of one set.

## R4 — The field counts email addresses, and is named for what it counts

`gitIdentities` was specified as distinct emails by phase 2 and as distinct name-and-email pairs by
phase 7, publishing 2 and 4 for the same measured subject. The join GitHub performs is on the email;
the author name is queried and decides nothing.

The field is `emailAddresses`, and its comment says GitHub collapsed that many addresses into this
account. Naming it after identities while counting addresses is the mislabel that produced the
disagreement. It is derived in `commit-history.ts` and travels on `CommitHistory` as a third field —
deriving it in the adapter by counting dictionary entries would silently under-report, because an
email resolving to two accounts is dropped from the dictionary by design.

## R5 — Phase 3 consumes phase 1's split rather than re-specifying it

Phase 1 exports `readDeliveredChanges` and `deriveForgeMetrics` and keeps `readForgeDerivedMetrics`
as their composition. Phase 3 described the same cut differently and landed it elsewhere. Phase 3
imports what phase 1 exported and specifies no extraction of its own.

The observation projection extracted by phase 3 takes the collector id as a parameter —
`(metrics, vocabulary, collectorId, basis)` — because it now has two callers that must not share
one baked-in `'forge-repository'`. The roster adapter calls it; phase 6 emits no observations of its
own construction.

## R6 — Composition sorts, and nobody else does

Three phases each specified the same order in a different place. `composeContributorRoster` sorts,
after the rows are built: it is the last point before the contract, and a future roster
implementation cannot be trusted to have sorted. Deliveries descending, then account ascending with
`<` and `>` and never `localeCompare`, the unattributed bucket last. The adapter's fixture keeps its
assertion, now made against the composed output.

## R7 — The contract carries what the renderer is not allowed to know

Phase 8 renders three values phase 7's block does not hold: the window length, a row's active days,
and the shared harness value. A renderer reaching into `delivery-sample.ts` for `WINDOW_DAYS`, or
re-deriving which axis is shared, is domain knowledge in a driving adapter.

The block gains `windowDays`, the shared harness observed value, and the harness-set total; a row
gains `activeDays`. Each states its own `INVARIANT:`, as every field of that self-contained contract
does.

## R8 — The email is lowercased once, inside the adapter — corrected

The first cut of this resolution put the lowercasing `accountForEmail` lookup in the composition
root. **That was wrong, and it could not have been built.** The dictionary it would close over is
`accountByEmail`, which `commit-history.ts` returns from inside the adapter's `read()`; at
construction time there is nothing to build a lookup against.

The lookup is the **roster adapter's**, built from `accountByEmail` the moment the walk returns, and
it lowercases the address it is handed. `commit-history.ts` keys the dictionary on the lowercased
address, and `harness-authorship.ts` normalises nothing and receives the lookup as an argument —
both already say so and neither changes. One normalisation, in one place, named here so a second
does not appear beside it.

## R10 — What the producer must carry, and what the seams are called

R7 added four fields to the contract and nobody was told to produce them. R3's set total has the same
shape of gap. Settled on the producing side:

* `ContributorRecord` carries `activeDays`. Phase 3 already computes a per-account active-day count;
  it had nowhere to travel.
* `ContributorRosterRun` carries `windowDays` on **both** arms — it is `WINDOW_DAYS`, known without
  reading anything, and phase 7 puts it on the failed arm for exactly that reason.
* Its `COMPLETED` arm carries `harnessObserved` and `harnessPaths`, from the adapter's own
  `scanHarness` run. They stay off the failed arm: a run that could not read cannot state a harness
  value about a tree it never scanned.

Two seams were named in one phase and consumed unnamed in another. Both get a name and a module:

* The shared delivery reader is `ForgeDeliveryReader`, declared in
  `src/evidence/adapters/forge-repository/delivery-reader.ts` — one object holding the memoised
  `readDeliveredChanges` result for a slug and window, taken by both `ForgeRepositoryEvidenceCollector`
  and `ForgeContributorRosterAdapter`.
* `contributor-deliveries.ts` exports `readContributorDeliveries(deliveries, vocabulary)`, answering
  the per-account metrics and their observations.

## R9 — Smaller reconciliations

* **A row prints active days where it has them and commits where it does not**, in prose; `--json`
  carries all three counts on every row. Phase 8's reading stands, and phase 9 writes `cli.md` to
  match it rather than to match the plan's shorter sentence.
* **`codebase-map.md` has one author, phase 9.** Phase 4's edit to it folds into phase 9, with the
  third field on `HarnessScan` named there.
* **`stryker.config.json` gains `contributor-deliveries.ts` and `derived-observations.ts`** as well
  as `commit-history.ts`. `forge-repository/` is swept file by file, so the per-person floors and the
  per-account active-day count would otherwise be mutated by nothing — and this project's known weak
  spot was found precisely that way.
* **The four reference profiles keep their prose byte for byte**; their `--json` gains exactly
  `contributors: null`. Already corrected in `plan.md`.

## R11 — A harness value that cannot be established is an evidence gap, not a failed run

Phase 6 shipped `harnessObserved` non-nullable on the `COMPLETED` arm, and failed the whole run when
the loaded model declared no `harness` axis or the scan left a rankable member undecidable. **That was
wrong**, and it was caught by neutering the guard the phase had just written.

`LiveRepositoryEvidenceCollector` answers those same two conditions with **no observation at all** —
`collectHarness` returns `[]` on a missing scale and again on `decidedCapabilities` answering `null`.
The axis then goes `UNKNOWN`, which is the evidence gap the conservative rule wants. A roster calling
the same conditions `FAILED` would tell the reader the forge refused when it answered, and would
collapse an evidence gap into an infrastructure failure — the one collapse this product exists to
prevent.

`harnessObserved` is `ObservedValue | null` on the `COMPLETED` arm. `null` withholds the observation
from every record rather than inventing one; the rows then answer no harness axis, and under a model
declaring it they are `UNPROVEN` there, exactly as the repository is.

**The test that was supposed to pin this pinned nothing.** It asserted that no record carried a
harness observation on a fixture whose history held no accounts, so the assertion ran over an empty
list and held whatever the adapter did. Neutering the guard left the suite green. The fixture now
carries one account and asserts it is there before asserting what its observations lack — a reminder
that an assertion over a collection needs the collection proven non-empty first.

## R12 — `contributors` is required and nullable, and a failed roster carries no window

Two corrections applied after phase 7, both to decisions the phase made on its own.

**The contract field is required, not optional.** Phase 7 shipped `contributors?:` because making it
required broke `pnpm typecheck` in three `src/cli/` files. That is a weakening of a permanent public
shape to avoid a temporary friction: `?:` lets a consumer confuse "absent" from "null" and lets a
producer forget the field entirely, where `demonstrated` — the field this one is modelled on — is
required and nullable. The three sites now pass `contributors: null`, which is one line each.

**`windowDays` is gone from the `FAILED` and `TIMED_OUT` arms**, on the port and in the contract,
reversing R10 on that one point. Phase 7 had to declare `FALLBACK_WINDOW_DAYS = 180` inside
`assessment/`, which may never import the real constant from `evidence/adapters/`, so the number
lived twice with nothing pinning the two together. The span is a constant and could always be
printed, which is exactly why printing it on a failed run misleads: nothing was counted over any
period, and a reader owed "none enumerated, and here is why" must not also be handed a window
suggesting something was. The omission is now the statement, and the duplicate constant is gone.
