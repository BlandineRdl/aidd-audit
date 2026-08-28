# Architecture

> Kept up to date with the code. Last reviewed 2026-07-12.

B2B billing. Three packages in one repository.

```
web/      Next.js app router. Server components by default.
api/      Route handlers. No business logic here, only transport.
shared/   Domain logic and types. Depends on nothing.
```

## The rule that matters

`shared/` never imports from `web/` or `api/`. It is the package we would keep
if we rewrote everything else. Any computation that two documents share belongs
there — that is where `computeTotal` ended up after PR #1284.

## Data

PostgreSQL through Prisma. One schema, no sharding, no read replica. We are at
4 GB and 180 requests per minute; none of that is close to a limit.

Money is **stored** in cents as integers. In-flight computation still runs on
floats and rounds at the end — see `round2` in `shared/pricing.ts`. That is a
known gap, not a design: it is what produced `0.30000000000000004` in PR #1284,
and the rounding helper papers over it rather than fixing it. Moving the
computation to integers is not filed yet.

## What we tried and dropped

- **Event sourcing on invoices** (Q1 2026). Abandoned after two weeks: the
  audit trail we wanted is already covered by the `invoice_history` table, and
  the rebuild cost was real.
- **A separate PDF service.** One deployment for 40 lines of code.
