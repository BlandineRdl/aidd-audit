# Plan — render an assessment report as JSON

## Contract (source, verbatim)

Given an AssessmentReport
When it is rendered as JSON
Then the output is valid JSON
And it preserves the complete public report
And it preserves null values such as proven: null
And it does not reinterpret outcomes or evidence statuses
And rendering is deterministic

## Scope

- `src/cli/renderers/json.renderer.ts` — new. Sibling of `human.renderer.ts`.
- `tests/cli/json-renderer.test.ts` — new. Reuses `tests/cli/assessment-report.fixture.ts` as is.

Nothing else. No CLI command, no orchestration, no contract change.

## Frozen decisions

1. **Signature**: `export function renderJsonReport(report: AssessmentReport): string`.
   Returns the JSON text with no trailing newline, mirroring `renderHumanReport`.
   The command that does not exist yet owns the newline.

2. **Explicit projection, not `JSON.stringify(report)`.**
   `JSON.stringify` serialises keys in the *insertion order of the object it is
   handed*, so the output would be determined by whichever code built the report,
   not by the contract. Rebuild each contract shape literal in a fixed key order
   instead. This is what makes the renderer a boundary rather than a passthrough:
   two structurally equal reports built in different key orders must render byte
   for byte identically, and a field absent from the contract must not reach the
   output.

3. **Key order is the contract's declaration order** in
   `assessment-report.contract.ts`, top to bottom, for every shape.

4. **Array order is the input's order.** `levels`, `axes`, `requirements`,
   `blocking`, `provenance` and every `axes: string[]` are ordered by the engine
   (levels by rank). The renderer never sorts and never dedupes: reordering would
   be reinterpretation.

5. **Nulls are preserved as JSON `null`, and the key stays present** —
   `proven`, `next`, and `observed` on an unproven requirement. Never `undefined`
   (`JSON.stringify` would drop the key), never a default, never `proven ?? white`.

6. **Statuses pass through verbatim.** `MET` / `NOT_MET` / `UNPROVEN`,
   `CONFIRMED` / `CLAIMED` / `CONFLICTING` / `UNKNOWN`, `PRACTICE` / `EVIDENCE`,
   `COMPLETED` / `FAILED` / `TIMED_OUT` / `SKIPPED`. No gloss, no lowercasing,
   no mapping table. The human renderer owns explanation; this one owns the shape.

7. **Union variants keep exactly their own members.** `reason` exists only on a
   non-`COMPLETED` provenance entry; it is never emitted as `undefined` on a
   `COMPLETED` one.

8. **Indentation: 2 spaces** (`JSON.stringify(value, null, 2)`). Frozen so the
   output is stable across changes, not because a consumer needs it pretty.

## Behaviours to test

1. the output parses as JSON
2. round trip — `JSON.parse(render(report))` deep-equals the report, on a report
   exercising every union variant (met, not-met and unproven requirements;
   practice and evidence blockers; completed and failed provenance)
3. `proven: null` survives as a present key holding `null`
4. `observed: null` on an unproven requirement survives the same way
5. outcomes and evidence statuses appear verbatim, unglossed
6. rendering the same report twice yields the identical string
7. two structurally equal reports whose keys were inserted in different orders
   render to the identical string
8. a field that is not in the contract does not reach the output

## Validation

`pnpm check` (typecheck, test, architecture). No end-to-end journey is
available: `src/cli/assess.command.ts` does not exist yet, so `pnpm build` stays
red for a reason unrelated to this change.

## Not in this plan

**No commit, no push, no pull request.** `aidd_docs/memory/vcs.md`: AI auto
commit is `never`; the one exception needs a human to validate the outcome first.
The work stays uncommitted in the worktree until that word is given.

## Amendment — review findings, round 2

The first candidate's projection was correct and its suite did not prove it.
A hard-coded `proven: null` passed all nine tests. Behaviours added:

9. **a proven level round-trips as that level.** Behaviour 2 round-tripped a
   report whose `proven` was already `null`, so the mirror of behaviour 3 was
   never asserted. This is the product's central claim — "proved Copper" versus
   "proved nothing" — and it was the one distinction the suite could not make.
10. **key order is irrelevant at every depth, not only the top.** The key-order
    test rebuilt only the outer object; every nested value was shared by
    reference, so six of the seven shapes were unproven and an identity
    projection survived.
11. **a non-contract field is dropped at any depth**, for the same reason.
12. **arrays are never sorted or deduped** (decision 4, which the behaviour list
    failed to carry). Needs an array of more than one element, out of natural
    order, in `levels` and in `provenance`.

Decision amended:

13. **Every projection carries its contract type as its return type.** Without
    it, a field *added* to the contract is silently dropped with `tsc` green —
    only a *renamed* field is caught. The two correlated unions
    (`RequirementReport`, `BlockingRequirement`) must branch on their
    discriminant to be annotated, because a flat projection widens the pair and
    admits `evidence: 'CONFIRMED'` with `outcome: 'UNPROVEN'` — a state the
    contract deliberately makes unrepresentable. The branch is a runtime no-op
    and a type-level guarantee; that is the trade being made.

## Amendment — review findings, round 3

No deal-breaker. Two corrections to this plan's own reasoning, and one edge it
never named.

**Decision 13's causal chain was wrong; its conclusion stands.** Measured: with
all six inner return annotations stripped, adding a field to `LevelReport` still
errors, because `projectReport`'s own annotation catches it structurally at every
depth. The inner annotations are redundant *for that guarantee*. They are kept
for **error localisation** — `TS2741` pointing at `projectLevel` beats one
`TS2322` at the outer boundary carrying a page-wide inferred type. The
*branching* is required regardless of where the annotation sits: a flat
unannotated `projectRequirement` still fails at the outer boundary.

Three cleaner routes were tried and rejected: a flat annotated literal (rejected
by tsc, which is decision 13's real justification), `{ ...requirement }`
(compiles, but preserves insertion order and passes unknown keys through,
defeating decisions 2 and 3), and a `pick` helper (`Pick` does not distribute
over the union). A cast is forbidden by the project's TypeScript rules.

**Known edge — SUPERSEDED in round 5, which guards it. Kept for the reasoning.**
**Non-finite numbers.**
`JSON.stringify` renders `NaN` and `Infinity` as `null`. `ObservedValue` admits
`number`, and in this contract `observed: null` is semantically loaded — it means
"not observed". A numeric `observed` that went non-finite would therefore be
rendered as a fabricated evidence gap, which is the one way this renderer could
reinterpret domain meaning. No producer exists yet (no collectors, no
orchestration), and the fix belongs in the contract as a finite-number type, not
as a guard in a renderer. Named here so it is a known edge rather than a silent
one, and owed by whoever writes the first numeric collector.

Behaviours added:

14. **coverage counters and header scalars are each proven distinct.** The
    fixture's `{ axesRequested: 3, axesObserved: 3, axesConfirmed: 3 }` are all
    equal, so any permutation of the three rendered identically and a
    transposition passed the suite — the same failure mode as round 2, in the
    corner the sweep missed. Coverage is how a `--json` consumer measures the
    evidence gap, so a transposition would report evidence the run never
    obtained. Prove with distinct values, supplied as a per-test override:
    `tests/cli/assessment-report.fixture.ts` is shared with the human renderer
    and stays untouched.
15. **the indentation width is pinned** (decision 8). It was caught only
    incidentally, by an assertion that needs the space any indent emits.
16. **arrays are never deduped**, not only never sorted. Behaviour 12 claimed
    both and proved only sorting; no array carried a duplicate element.

## Amendment — review findings, round 4 (closing)

Two gaps, both in the corners the round-3 sweep left, both closed:

17. **`model.id` is rendered from the input.** It was the one header scalar
    behaviour 14 did not prove: hard-coding it passed the whole suite. `--model`
    is a shipped flag, so `model.id` is how a `--json` consumer learns which
    model produced the verdict; a hard-coded one attributes a custom model's
    result to canonical AIDD.
18. **Behaviour 16 narrowed and completed.** "Never sorted or deduped" was proven
    for `provenance` only. Now also proven for `level.axes` order — the one
    reordering that is visible reinterpretation — and for `blocking` dedupe,
    which would drop a count the consumer is entitled to.

    Deliberately left unproven: the order of the two `readonly string[]` leaves,
    a provenance entry's `axes` and an array-valued `observed`. Those are sets —
    `architecture.md` records harness as set containment — so their order carries
    no meaning and pinning it would assert something the domain does not claim.

## Amendment — round 5, on human instruction

Two changes asked for directly, after the pipeline reported.

**The two stale memory files were corrected** under the Boy Scout rule:
`cli.md` still said "No `src/` yet" and `codebase-map.md` still listed both
renderers, `src/` and `tests/` as planned. All were stale from the human
renderer's landing, not from this change.

**The finite-number invariant is enforced now, not deferred.** Round 3 named it
and left it to a future numeric collector; that deferral is withdrawn.

It belongs to `cli/renderers/json.renderer.ts`, which refuses the report by
throwing `UnrenderableReportError` naming the offending field's path. Two homes
were considered and rejected:

* **The contract, as a branded finite type.** It is frozen before the worktree
  split precisely because several contexts bind to it; branding forces every
  producer to change, and needs a runtime smart constructor inside a file whose
  whole point is to be a self-contained type declaration. It would also not stop
  a producer branding a `NaN`.
* **The assessment boundary that maps observations into maturity input** —
  `architecture.md`'s home for a collector speaking off its scale. It does not
  exist yet, so choosing it is the deferral being withdrawn. A check there later
  would be additional, never a replacement: the renderer is the last boundary
  before publication.

The positive case for the renderer: a non-finite number is not a domain
condition with meaning — it is simply wrong, everywhere. It becomes *ambiguous*
only under JSON, where `NaN` and `Infinity` serialise to `null`, and only in
this contract, where `null` means absence. The renderer is the one place both
facts hold at once, so it is where the invariant lives.

Refusal, not repair: no substitute value is faithful, and rendering one would
hide an upstream defect behind a plausible document. Determinism is unaffected —
the same input refuses the same way.

The guard walks the *projected* object rather than checking each numeric site,
so it sees contract fields and nothing else, and a number added to the contract
later is guarded without anyone remembering to guard it. That is the same
argument the return-type annotations rest on.

Behaviours added:

19. **a non-finite `observed`, coverage counter or level rank is refused**, for
    `NaN`, `Infinity` and `-Infinity`, and never rendered as `null`.
20. **the refusal names the offending path**, so a producer can find it.
21. **nothing partial escapes** — the report is refused before any output.
22. **a finite report still renders, zero included** — the guard rejects
    non-finite values, not falsy ones.

## Amendment — round 6, human review of the renderer

Comments trimmed to the invariant that is not visible in the code: the entry
point, the finite-number guard and the two union projections each keep one or
two lines. The worktree history, the rejected alternatives and the reasoning
behind the reflective walk live here and in `architecture.md`, not above the
algorithm they explain. The finite-number walk roots its path at `$`, which
removes the empty-string special case.

**Decision 2 is reprioritised, not reversed.** It led with deterministic key
order; the primary justification is that no field outside the contract reaches
the output. Order is a free consequence: any allowlist must enumerate the
permitted fields, and enumerating them in a literal fixes their order
mechanically. Dropping order as a goal would not remove a line, so the cost of
the projection is the cost of the allowlist alone. A consumer should not read
meaning into JSON key order, and nothing here asks it to.

The duplicated discriminated-union branches stay as they are, uncast.
