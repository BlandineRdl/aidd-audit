---
paths:
  - "internal/store/**"
---

# SQL — loaded when `internal/store/` is touched

- Queries are written by hand. No query builder, no ORM.
- Every query has an `EXPLAIN` in the PR description if it touches a table over
  a million rows.
- No `SELECT *` in application code. Naming the columns is what makes a schema
  change fail at compile time instead of at runtime.
- Migrations are additive. A column is dropped in a later release than the code
  that stopped using it, never in the same one.

## Timeouts

Every query runs under a context with a deadline. A query without one holds a
connection until PostgreSQL decides otherwise, and the pool has 20 slots.
