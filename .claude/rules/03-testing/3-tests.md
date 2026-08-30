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
- An internal input seam may use a faithful in-memory implementation when its production
  translation has its own integration suite. Keep the consumer test on observable interface
  behavior, and name the translation test separately.
- Never mock an internal collaborator outside that documented seam.
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
- A threshold is pinned only by rows on both sides of it.
- An interior point leaves the constant free across a range.
- `>= 2.5` asserted at 2 and 4 admits anything in `(2, 4]`.
- Assert the last value below and the first value at or above.

## Fixtures

- Assert a malformed fixture carries the fault before using it.
- Serialising a value is not writing the text: `{ rank: '.nan' }` becomes a quoted string.
- A type check then rejects it long before the guard under test.
