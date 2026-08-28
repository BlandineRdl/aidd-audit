---
paths:
  - "src/**/*.test.ts"
  - "tests/**/*.test.ts"
---

# Tests

A suite proves observable behavior, and is itself only as good as what it would catch.

## Scope

- Test behavior, never files.
- No suite mirrors a source file by reflex.
- Models, helpers and ports get none unless they hold behavior.
- Prefer the smallest boundary that proves the behavior.
- Names describe behavior, never implementation.

## Style

- Chicago-style: run the real deterministic collaborators together.
- Fake only architectural boundaries outside the behavior under test.
- Never mock an internal collaborator.
- Never assert call order.
- Never assert an implementation detail.

## A guard is only as good as the test that kills it

- A rejection test pins the error class *and* a fragment of the message.
- `toThrow(SomeError)` alone passes for any throw.
- `toThrow(/text/)` alone passes for any `Error`, the `TypeError` from the missing guard included.
- Let the fragment name the offending id.
- A guard's test is unproven until the guard has been neutered and the test seen to fail.
- Delete the throw, run, watch it go red, restore.
- A mutation sweep where nothing survives is a suspect harness.
- Run an unmutated control first and confirm it is green.

## Fixtures

- Assert a malformed fixture carries the fault before using it.
- Serialising a value is not writing the text: `{ rank: '.nan' }` becomes a quoted string.
- A type check then rejects it long before the guard under test.
