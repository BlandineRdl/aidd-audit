---
paths:
  - "src/**/*.ts"
  - "tests/**/*.ts"
  - "scripts/**/*.mjs"
---

# Clean Code

Keep code small, intention-revealing, and aligned with one responsibility.

## Functions

- One decision or one transformation per function.
- Read at a single level of abstraction.
- Keep branching local to its rule.
- Never mix orchestration, mapping, and domain decisions.

## Naming and abstraction

- Prefer domain names over technical names.
- Extract when naming it clarifies the caller.
- Never extract merely to shorten.
- Prove an abstraction removes duplication or responsibility.
- No generic machinery for one case.

## State

- Reject impossible states at boundaries.
- No defensive checks in the core.
- Never store what another field determines.
- Prefer immutable values and explicit returns.
- Mutate nothing the caller cannot see.

## Comments

See `1-comments.md`. Comments are exceptional, and a multi-line block declares its purpose with a tag.

## Refactoring

- Refactor when reading no longer matches behavior.
