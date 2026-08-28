---
name: schema-migration
description: Apply a schema change to the ingest database: expand, backfill, contract, one deploy each. Use when a migration touches a table in use.
---

# Procedure — schema migration

Two releases, never one. The rule exists because we took production down for
11 minutes in November doing it in one.

## Release N — additive only

1. Add the column, nullable, with no default. A default on a large table
   rewrites it.
2. Backfill in batches, out of band. Never in the migration itself.
3. Write to both old and new column. Read from the old one.

## Release N+1 — once the backfill is verified

4. Read from the new column. Keep writing to both.
5. Verify for one full week, with the metric that counts disagreements between
   the two.

## Release N+2

6. Stop writing to the old column.
7. Drop it.

## The check that must pass before each step

`SELECT count(*) FROM t WHERE new IS NULL AND old IS NOT NULL` returns 0.
