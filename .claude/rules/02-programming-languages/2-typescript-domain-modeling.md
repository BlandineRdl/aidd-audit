---
paths:
  - "src/**/*.ts"
  - "tests/**/*.ts"
---

# TypeScript

Use the type system to prevent invalid domain states.

- Prefer discriminated unions for correlated fields.
- Independent unions must not permit invalid combinations.
- Never cast to bypass type safety.
- Narrow the value or fix the type.
- Name a repeated meaningful primitive union.
- Handle discriminated unions exhaustively.
