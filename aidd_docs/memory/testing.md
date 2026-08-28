# Testing

How this project is tested: TDD boundaries, doubles, and validation.

## Strategy

* TDD at the **use-case boundary**: failing behavior test → minimum implementation → refactor.
* A test describes observable behavior through a public API.
* Tests follow behavior, not files. Models, helpers, ports and classes get no suite of their own unless they hold behavior clearer to test directly.
* Prefer the smallest boundary that proves the behavior.
* Test names describe behavior, never implementation.

## Where a test lives

* A suite sits **beside the code it exercises**: `engine/maturity-engine.test.ts` next to `maturity-engine.ts`.
* `tests/` holds only what has no such neighbour, and exists for that alone:
  * `tests/maturity/aidd-model.test.ts` — conformance of `aidd.yml`, a data file, not a function;
  * `tests/assessment/vocabulary-conformance.test.ts` — the one place allowed to import all three contexts;
  * the acceptance suite over `profiles/` **(owed)** — the whole chain, no single unit.
* **Co-location is not mirroring.** `resolve-evidence.test.ts` exists because resolution is a behavior, not because `resolve-evidence.ts` is a file. `scale-comparison.ts` is owed nothing.
* Three suffixes mark what never ships: `*.test.ts`, `*.test-adapter.ts`, `*.test-fixture.ts` — one glob, read by `vitest` and by `dependency-cruiser`.

## Behaviors under test, and what each one fakes

**Chicago-style**: run the real deterministic collaborators together, fake only architectural boundaries outside the behavior under test. No mocks of internal collaborators, no call-order assertions, no implementation-detail tests.

| Behavior | Proves | Doubles |
| -------- | ------ | ------- |
| `maturity-engine` | maturity semantics | none — handed a model and observations |
| `resolve-evidence` | evidence resolution | none — takes domain values, returns one |
| `compose-assessment-report` | projection into the public contract, coverage derivation | none — real evidence, real `checkMaturity` |
| `collect-evidence.usecase` | collector execution, degradation, provenance, resolution | `FakeInMemoryEvidenceCollector`, `FailingEvidenceCollector`; real resolver |
| `assess-maturity.usecase` **(owed)** | orchestration and assessment result; coverage is `compose-assessment-report`'s to prove | real domain collaborators, fakes at external ports only |

The first three are not use cases: each takes domain values and returns one, so it is tested directly.

## Doubles

* A double is one alternative implementation of a port, not a scenario machine. Always an adapter — only a boundary is ever faked — so `.test-adapter.ts`, filed in `adapters/` with the production ones.
* The discipline itself is a rule: `.claude/rules/03-testing/3-test-doubles.md`, loaded when one is edited.

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

Gap: `NOT_MET` is a practice gap, `UNPROVEN` an evidence gap — see **The conservative rule** in `project-brief.md` for what each may recommend.

### The three vocabularies must stay compatible

* The four evidence-status names live in three independent declarations: `evidence/models/observation.model.ts`, `maturity/models/axis-observation.model.ts`, and the public contract. Peers never import each other and the contract is self-contained; the duplication is the price.
* A member added to one declaration and not the others compiles today. The divergence would surface only at composition time.
* `tests/assessment/vocabulary-conformance.test.ts` is the one place allowed to import all three, and it splits across two gates:
  * `pnpm typecheck` — statuses, `ObservedValue` and `Threshold` each asserted `Identical` between declarations. The only way to check the last two at all: the contract keeps no runtime list of either.
  * `pnpm test` — the status names alone, `EVIDENCE_STATUSES` against `EVIDENCE_CONFIDENCES` against the contract's own status keys.
* Not a shared import.

## Integration and acceptance

* Integration tests only where the real boundary matters: `live-repository.adapter` runs against temporary real Git repositories and the real filesystem. Do not mock Git to test the Git adapter.
* Profiles are acceptance fixtures, not domain identities. Production code holds no profile-specific knowledge.
* Missing input yields `UNKNOWN`, never fabricated negative evidence.

| Profile    | Expected | Deliberate hole    |
| ---------- | -------- | ------------------ |
| `perceval` | Red      | no `repo-context/` |
| `bohort`   | Blue     | none               |
| `leodagan` | Green    | no `session.md`    |
| `arthur`   | Copper   | no `declaratif.md` |

* **`leodagan` is the trap the harness axis has to survive.** Expected Green, so `aidd.yml` requires `prompts` of him, yet `session.md` — the prompt-to-commit trace — is exactly what he lacks. A collector that confirms `prompts` only from a transcript file makes Green and above unreachable, and three fixtures out of four fail at once.
* `profiles/` ship their own `*.test.ts`. They stay out through vitest's `include` and a second exclusion; drop either and `profiles/bohort/code/pricing.test.ts` fails on a `zod` it does not have while `profiles/arthur/code/usage-summary.test.ts` adds five green tests that prove nothing.

## What one unobserved axis costs

* Every level of `aidd.yml` declares all four axes, so a single `UNKNOWN` leaves even White unproven and the report has no level to name. The conservative rule taken to its end.
* The weight is therefore on collector coverage: a collector that silently contributes nothing costs the whole assessment, not one rung.
* `proven: null` is that result — "insufficient evidence to classify", never "below White". `tests/maturity/aidd-model.test.ts` pins it; the renderer's matching duty is in `cli.md`.

### `aidd-model.test.ts` is a model conformance test, not a decision test

* It reads the canonical `aidd.yml` from disk on purpose — four axes, seven distinct ranks, a few expected reference points — so a typo in the model fails at commit rather than at assessment.
* Decision tests stay free of the filesystem and of YAML.
* It reads through `loadMaturityModel`, so the loader's guards are what fail here: a threshold off its scale, a level short of an axis or a rank that dips stops the suite at collection, naming the fault. The reference points then prove the model still grades what it should.

## What this repository already got wrong

* The model loader shipped **three times** with a live guard nothing held, green suite each round. The pattern never varies: the test names the rule and asserts something weaker.
* One honest mutation sweep over that loader ran 61 mutations; **22 survived**.
* An earlier sweep reported every mutant killed — an invalid reporter name was making every run die at startup, which reads exactly like success.
* What to do about it is a rule: `.claude/rules/03-testing/3-tests.md`, loaded when a suite is edited.

## Tools

* Vitest only; dependency-cruiser runs with the test command.
* Verify the offline constraint with the network disabled, on a repository and on a fixture bundle, in both renderings:

```bash
aidd-audit assess ./profiles/arthur   # and --json
aidd-audit assess .                   # and --json
```
