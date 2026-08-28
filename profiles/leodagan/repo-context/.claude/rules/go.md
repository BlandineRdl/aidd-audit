---
paths:
  - "**/*.go"
---

# Go — loaded when a `.go` file is touched

- Wrap errors: `fmt.Errorf("what failed: %w", err)`. The message says what was
  being attempted, not what went wrong — the wrapped error already says that.
- No `panic` outside `main`. A library that panics decides for its caller.
- A package exposes an interface. The concrete struct stays unexported.
- Context is the first parameter, always named `ctx`, never stored in a struct.
- No new dependency without a written justification in the PR description.

## The one we keep getting wrong

A `select` with a `default` on an unbuffered channel is a busy loop. If you
write one, say in the PR why it is not.
