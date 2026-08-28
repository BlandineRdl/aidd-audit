---
paths:
  - "**/*_test.go"
  - "**/*.test.ts"
---

# Tests — loaded when a test file is touched

- Test first. The test must fail **for the right reason** before the
  implementation exists. Assert on the failure message, not just on the failure.
- Table-driven by default. One case per line beats one function per case.
- The test name says the behaviour: `retries_a_failed_batch_then_carries_on`,
  not `TestSync2`.
- Integration tests run against ephemeral containers. Never a shared database —
  we lost a day in March to two branches truncating the same table.

## What does not count as a test

- A test that mocks the thing under test.
- A test written after the code that passes on the first run.
