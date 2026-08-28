# Contract: load a maturity model the engine can safely evaluate

- **Date**: 2026_08_28
- **Source**: user request, planning-ready. Origin: `../2026_08_28_maturity-engine-refactor/review.md` findings 1, 2, 4, 6, 8.
- **Context**: `maturity`

## Intent

Give the runtime a loader that turns an untyped YAML file into a `MaturityModel` the
engine may evaluate without re-checking it. Today the only path from YAML to the engine
is `YAML.parse(...) as MaturityModel` — a cast that asserts what nothing verified.

## Acceptance criteria

1. Loading the canonical `aidd.yml` returns a `MaturityModel`.
2. Malformed model data is rejected.
3. Thresholds outside their axis vocabulary are rejected.
4. Requirements targeting undeclared axes are rejected.
5. Every level must cover every declared axis.
6. Levels must be cumulative.
7. No production path relies on `YAML.parse(...) as MaturityModel`.

## Constraints inherited from project memory

- The loader is a **driven adapter** under `src/maturity/adapters/`. It is the only place
  the YAML parser and the filesystem may appear in this context
  (`.dependency-cruiser.cjs` forbids both in `models|usecases|contracts|engine`).
- No `validation/` layer. The adapter parses, checks shape and vocabulary, and guarantees
  cumulativity before returning. Settled in the prior review; the boundary rules and their
  sentinels no longer cover `validation/`.
- `maturity` stays a peer of `evidence` and imports neither `assessment` nor `cli`.
- Rejection is `InvalidMaturityModelError`. The message names what is wrong, so a hand-edited
  `aidd.yml` or a `--model` file fails with a sentence, not a stack trace.
- Cumulativity means: for every axis, a higher rank never asks less than the rank below.
  `checkMaturity` reports the highest `MET` level without re-checking the levels beneath it,
  so a model that dips would name a level whose predecessors are `NOT_MET`.
- The engine's existing guards stay. Scope is explicit: the **loader** is the gate on untyped
  input; the **engine's** throws are a backstop for hand-built models (tests today,
  `assessment` later). They are not a parallel implementation of the same rule.
- Tests: Vitest, behavior at the boundary, no mocks of internal collaborators.
  `tests/maturity/aidd-model.test.ts` is a conformance test that reads the real file on purpose.

## Out of scope

- `maturity-model.port.ts`. No consumer exists (`assessment` and `cli` are unwritten). A port
  with one implementation and zero consumers is a wall with no door; it arrives with its
  consumer. `architecture.md` must be updated to say so rather than keep promising it.
- Anything in `evidence`, `assessment` or `cli`.
