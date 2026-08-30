---
paths:
  - "src/**/*.test.ts"
  - "src/**/*.test-adapter.ts"
  - "src/**/*.test-fixture.ts"
  - "tests/**/*.ts"
---

# Testing Decisions

`aidd_docs/memory/testing.md` records where a suite lives, what each behavior is allowed to fake,
and what this repository has already got wrong. Read it before adding or moving a suite.

## Read it before

- Creating a suite for a file that has none.
- Putting a suite under `tests/` rather than beside its subject.
- Adding a double, or faking anything for the subject's benefit.
- Building temporary Git repositories in a new fixture.

## What you get wrong without it

- A suite earns its own file when a measurement says the boundary above it is too coarse, never
  because a file exists.
- A cancellation test is satisfied by the shallow checkpoint and proves nothing about the deep
  one. Only a sweep says so.
- Which assertions photograph today's implementation instead of the capability, and turn red when
  the product improves.

`pnpm mutation` is the technique that found each of those. It is a report to read, not a gate.
