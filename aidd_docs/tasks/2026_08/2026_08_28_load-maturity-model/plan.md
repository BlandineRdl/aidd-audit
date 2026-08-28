---
objective: "An untyped YAML file reaches the engine only as a MaturityModel that was checked for shape, vocabulary, axis coverage and cumulativity — and no path anywhere casts its way there."
status: implemented
---

# Plan: load a maturity model the engine can safely evaluate

## Overview

| Field      | Value                                                                             |
| ---------- | --------------------------------------------------------------------------------- |
| **Goal**   | A YAML loader that refuses an invalid model, so `checkMaturity` may trust its input |
| **Source** | [`contract.md`](./contract.md), itself from [`../2026_08_28_maturity-engine-refactor/review.md`](../2026_08_28_maturity-engine-refactor/review.md) |

## Phases

| #   | Phase                                     | File                         |
| --- | ----------------------------------------- | ---------------------------- |
| 1   | The loader refuses what the engine trusts | [`phase-1.md`](./phase-1.md) |
| 2   | Cut the cast and make the docs true       | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| The loader is a plain adapter, not a port implementation. No `maturity-model.port.ts`. | `assessment` and `cli` are unwritten, so a port would have one implementation and no consumer — a wall with no door. It arrives with the consumer that needs to inject it. `architecture.md` currently promises it; the promise moves rather than the code. |
| The adapter exports two functions: `loadMaturityModel(path)` and `parseMaturityModel(source)`. | One concept, one seam. `load` owns the filesystem — legal only in `adapters/` — and delegates every check to `parse`, which takes a string. Sixteen rejection cases are then behaviour tests over text, not sixteen temp files. |
| The engine keeps its guards; the loader does not replace them. | Explicit scope, not a parallel rule: the **loader** is the gate on untyped input; the **engine's** throws are a backstop for hand-built models — the tests today, `assessment` later. `scale-comparison.ts` says the loader will take the function away; that comment becomes false and is rewritten, not honoured. |
| `invalid-maturity-model.error.ts` moves from `engine/` to `models/`. | The adapter must throw it and does not otherwise depend on the decision engine. A domain error shared by both belongs to neither's folder. |
| A level declares **exactly one** requirement per declared axis. | AC5 asks for coverage and AC6 for cumulativity; cumulativity is only well-defined when each (level, axis) pair names one threshold to compare. Two requirements on one axis are rejected as ambiguous rather than silently intersected. |
