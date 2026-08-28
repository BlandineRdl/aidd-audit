# Conventions

> The short version. The long version is in the code review history.

## Naming

- Functions that compute return a value and touch nothing: `computeX`, `formatX`.
- Functions that write say so: `saveX`, `sendX`.
- Booleans read as questions: `isDraft`, `hasDiscount`.

## Errors

Business errors go through `DomainError` with a stable code. The API layer maps
codes to HTTP statuses in one place, `api/errors.ts`. A `throw new Error` in
domain code is a bug, and the lint rule says so.

## Dates

UTC in the database, UTC in the domain, converted at display only. The bug that
made us write this down: an invoice dated 2026-01-01 in Paris was filed in the
2025 fiscal year.

## Tests

One behaviour per test, named after the behaviour and not the function.
