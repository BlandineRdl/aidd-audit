---
paths:
  - "src/**/*.test-adapter.ts"
---

# Test Doubles

One alternative implementation of a port, not a scenario machine.

- Own file, never an inline factory in a suite.
- A concrete port implementation, so an adapter, filed in `adapters/` with the production ones.
- Only a boundary is ever faked; `test-` separates it from the one that ships.
- Name states what it stands for, not what a test does with it.
- Two concepts, two classes.
- Never one class with a union widened until it plays both parts.
- Constructor takes what the double *is*.
- Never a behaviour callback, never a mode selector.
- A constructor selecting between behaviours follows the branches of a test, not anything the system has.
- Controlled behavior only; never reproduce production business logic.
- A failing double takes `unknown`, not `Error` — that is what `catch` binds under `strict`.
- It emerges because a business test needs it.
- No library of doubles written ahead of them.
