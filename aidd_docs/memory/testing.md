# Testing

How this project is tested: TDD boundaries, doubles, and validation.

**Status: strategy and reference fixtures are frozen; `tests/maturity/`, `tests/cli/` and both `tests/evidence/` suites exist. Orchestration and the acceptance suite are still owed.**

## Strategy

Use **TDD at the use-case boundary**.

Tests describe observable business behavior through a use case's public API:

```text
failing behavior test → minimum implementation → refactor
```

Tests follow behavior, not files. Do not test models, helpers, ports, or classes independently unless they own meaningful behavior that is clearer to test directly.

Main behaviors:

* `maturity-engine` — maturity semantics. Not a use case: it takes domain values and returns one, so it is tested directly and without doubles;
* `resolve-evidence` — evidence resolution. Not a use case: it takes domain values and returns one, so it is tested directly and without doubles;
* `collect-evidence.usecase` — collector execution, degradation, provenance, and evidence resolution;
* `assess-maturity.usecase` — orchestration, coverage, and assessment result.

## Style and doubles

Use **Chicago-style testing**: exercise real deterministic collaborators together and fake only architectural boundaries outside the behavior under test.

Avoid mocks of internal collaborators, call-order assertions, and implementation-detail tests.

Examples:

* `maturity-engine` → no double at all: it is handed a model and observations;
* `collect-evidence.usecase` → `FakeInMemoryEvidenceCollector`, `FailingEvidenceCollector`, and the real resolver;
* `assess-maturity.usecase` → real domain collaborators, fakes only at external ports.

A double is one alternative implementation of the port, not a scenario machine.

* Own file, never an inline factory in a suite.
* Concrete port implementation, so `.adapter.ts`.
* Name states what it stands for: an available in-memory source, an unavailable boundary.
* Two concepts, two classes — not one class with a union widened until it plays both parts.
* Constructor takes what the double *is*, never a behaviour callback or a mode selector.
* Controlled behavior only. It never reproduces production business logic.
* A failing double takes `unknown`, not `Error` — that is what `catch` binds under `strict`.
* It emerges because a business test needs it. No library of doubles written ahead of them.

A constructor that selects between behaviours is driven by the branches of the test, not by anything the system has.

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

Gap:

* `NOT_MET` → practice gap;
* `UNPROVEN` → evidence gap.

An evidence gap must never produce a recommendation that assumes the underlying practice is deficient.

### The three vocabularies must stay compatible

The four evidence-status names live in three independent declarations: `evidence/models/observation.model.ts`, `maturity/models/axis-observation.model.ts`, and the public contract. The duplication is deliberate — the two contexts are peers that never import each other, and the contract is self-contained so an internal refactor cannot reshape it.

**Owed, not yet written:** a conformance test under `tests/assessment/`, the one place allowed to import all three, asserting the vocabularies stay compatible. `ObservedValue` and `Threshold` are in the same position.

Not a shared import. A member added to one declaration and not the others compiles today, and the divergence would surface only at composition time.

## Integration and acceptance

Use integration tests only where the real boundary matters.

`live-repository.adapter` runs against temporary real Git repositories and the real filesystem. Do not mock Git to test the Git adapter.

Keep a small acceptance suite for the reference profiles:

| Profile    | Expected | Deliberate hole    |
| ---------- | -------- | ------------------ |
| `perceval` | Red      | no `repo-context/` |
| `bohort`   | Blue     | none               |
| `leodagan` | Green    | no `session.md`    |
| `arthur`   | Copper   | no `declaratif.md` |

Profiles are acceptance fixtures, not domain identities. Production code contains no profile-specific knowledge.

Missing input yields `UNKNOWN`, never fabricated negative evidence.

`leodagan` is the trap the harness axis has to survive. He is expected Green, so `aidd.yml` requires `prompts` of him, yet his `session.md` — the prompt-to-commit trace — is exactly what he lacks. A collector that confirms `prompts` only from a transcript file makes Green and above unreachable, and three fixtures out of four fail at once. See the term's definition in `project-brief.md`.

Vitest's `include` is restricted to `tests/**/*.test.ts`, and `profiles/` is excluded twice over. Without it vitest runs the fixtures' own `*.test.ts` as this project's suite: `profiles/bohort/code/pricing.test.ts` fails on a `zod` it does not have, and `profiles/arthur/code/usage-summary.test.ts` contributes five green tests that prove nothing about the product.

One unobserved axis proves nothing at all. Every level of `aidd.yml` declares all four axes, so a single `UNKNOWN` leaves even White unproven and the report has no level to name. That is the conservative rule taken to its end, and it puts the weight on collector coverage: a collector that silently contributes nothing costs the whole assessment, not one rung.

`proven: null` is a result, not a failure — "insufficient evidence to classify", never "below White". The engine must not special-case it, and no renderer may fall back to `proven ?? white`: that single line would collapse the difference between having proved the baseline and having proved nothing, which is the difference the product sells. `tests/maturity/aidd-model.test.ts` pins it.

That file is a **model conformance test**, not a decision test. It reads the canonical `aidd.yml` from disk on purpose, checks the four axes and the seven distinct ranks, and lands on a few expected reference points. Decision tests stay free of the filesystem and of YAML; this one exists so a typo in the model fails at commit rather than at assessment.

It reads `aidd.yml` through `loadMaturityModel`, so the loader's guards are what fail here: a threshold off its scale, a level short of an axis or a rank that dips stops the suite at collection, naming the fault. The reference points then prove the model still grades what it should.

## A guard is only as good as the test that kills it

The maturity model loader shipped three times with a live guard nothing held, and
each round the suite was green. The pattern is always the same: the test names the
rule, and asserts something weaker than the rule.

**A rejection test pins the error class *and* a fragment of the message.**
`toThrow(SomeError)` alone passes for any throw, and `toThrow(/some text/)` alone
passes for any `Error` — including the `TypeError` from the guard's absence. Assert
both, and make the fragment name the offending id, so the message stays useful to
whoever hits it.

**A guard's test is unproven until the guard has been neutered and the test seen to
fail.** Delete the throw or force the condition, run the suite, watch that test go
red, restore. Written but unproven is the state every escaped defect here was in:
one honest sweep over this loader ran 61 mutations and 22 survived.

**A sweep where nothing survives is a suspect harness, not a good result.** Run an
unmutated control first and confirm it is green. A sweep here once reported every
mutant killed because an invalid reporter name made every run die at startup, which
reads exactly like success.

**A fixture for invalid input must be asserted before it is used.** Building a
malformed YAML document through `YAML.stringify` is not the same as writing that
YAML: `{ rank: '.nan' }` serialises to `rank: ".nan"`, a quoted *string*, which the
type check rejects long before the finiteness check under test. Assert the
serialised text carries what the case needs, then parse it.

## Tools and conventions

* Vitest only.
* dependency-cruiser runs with the test command.
* Tests live under `tests/`, grouped by use case or integration boundary.
* Test names describe behavior, not implementation.
* Do not create tests merely to mirror `src/`.
* Prefer the smallest test boundary that proves the behavior.

## Offline verification

Before the deadline, with the network disabled:

```bash
aidd-audit assess ./profiles/arthur
aidd-audit assess ./profiles/arthur --json
aidd-audit assess .
aidd-audit assess . --json
```

Offline execution is a product constraint, not a degraded mode.
