# Testing

How this project is tested: TDD boundaries, doubles, and validation.

**Status: strategy and reference fixtures are frozen; no test file exists yet.**

## Strategy

Use **TDD at the use-case boundary**.

Tests describe observable business behavior through a use case's public API:

```text
failing behavior test → minimum implementation → refactor
```

Tests follow behavior, not files. Do not test models, helpers, ports, or classes independently unless they own meaningful behavior that is clearer to test directly.

Main use cases:

* `check-maturity.usecase` — maturity semantics;
* `resolve-evidence.usecase` — evidence resolution;
* `collect-evidence.usecase` — collection, degradation, provenance, coverage;
* `assess-maturity.usecase` — orchestration and assessment result.

## Style and doubles

Use **Chicago-style testing**: exercise real deterministic collaborators together and fake only architectural boundaries outside the behavior under test.

Prefer simple fakes implementing project ports. Avoid mocks of internal collaborators, call-order assertions, and implementation-detail tests.

Examples:

* `check-maturity.usecase` → fake `maturity-model.port`;
* `collect-evidence.usecase` → fake collectors;
* `assess-maturity.usecase` → real domain collaborators, fakes only at external ports.

A fake provides controlled behavior; it must not reproduce production business logic.

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

One unobserved axis proves nothing at all. Every level of `aidd.yml` declares all four axes, so a single `UNKNOWN` leaves even White unproven and the report has no level to name. That is the conservative rule taken to its end, and `tests/maturity/aidd-model.test.ts` pins it. It puts the weight on collector coverage: a collector that silently contributes nothing costs the whole assessment, not one rung.

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
