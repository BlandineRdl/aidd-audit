# Architecture

> Last updated: 3 February 2026.

Billing service. One Go binary, one PostgreSQL database.

## Request flow

```
HTTP  →  internal/api  →  internal/billing  →  internal/store  →  PostgreSQL
```

Synchronous end to end. A request comes in, a response goes out, one log line
carries the whole thing. That is the property we optimise for.

## Packages

| Package | Owns |
| ------- | ---- |
| `internal/api` | HTTP handlers, one file per resource |
| `internal/billing` | Amounts, tax, proration |
| `internal/store` | SQL, hand written |

## Deliberately absent

- No queue. No background worker. No event bus. Everything that happens,
  happens inside a request, and that is why we can debug it.
- No cache. The database answers in under 5 ms at p99.

## Scale

40 requests per second at peak, 12 GB of data. Nothing here is close to a
limit, and no decision below assumes growth.
