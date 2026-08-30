# AGENTS.md

> Last updated: 3 February 2026.

Billing service. **Go monolith**, a single PostgreSQL database, deployed as one
container.

## Architecture

Three packages, and not one more:

- `internal/api/` — the REST HTTP handlers. One file per resource.
- `internal/store/` — database access. Hand-written SQL queries.
- `internal/billing/` — the business computation.

The service is **synchronous end to end**. A request comes in, a response goes
out. No queue, no background job, no event bus: that is a deliberate choice, it
keeps the system debuggable with a single log.

## Go conventions

- Errors bubble up wrapped with `fmt.Errorf("...: %w", err)`.
- `internal/store` exposes functions, not interfaces: there is one
  implementation and there will not be another.
- No new dependency without a written justification in the PR.

## Tests

- Integration tests run against the shared development database `billing_dev`.
  Warn on the team channel before running a suite that writes.

## Off limits

- `internal/store/migrations/` — human review required.

## Domain rules

See `.claude/rules/`: `sql.md`, `http.md`, `errors.md`, `tests.md`.
