# AGENTS.md

Project instructions for coding assistants.

## Context

B2B billing application. Next.js, Prisma, PostgreSQL. Monorepo with three
packages: `web`, `api`, `shared`.

## Conventions

- Strict TypeScript. No `any`, no `@ts-ignore` without a comment justifying it.
- Domain errors go through `DomainError`, never `throw new Error`.
- Dates are handled in UTC and converted only for display.
- Commits follow Conventional Commits.

## Tests

- A behaviour change without a test is not mergeable.
- Tests must fail before the implementation. A test written afterwards that
  passes on the first run has not been checked, only written.
- No mocking the payment module; use the double provided in `test/doubles/`.

## Off limits

- `api/payments/`: critical module, changes by human review only.
- Prisma migrations already applied in production.

## Before proposing code

- Check whether an equivalent function already exists in `shared/`.
- Ask a question rather than guess a business rule.
