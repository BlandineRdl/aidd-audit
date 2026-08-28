# Spec — migrate the Stripe connector to API v2

> Client B. Written before the work started. Track 3 of the July batch.

## Why

v1 is deprecated in November. Nothing is broken today; this is a deadline, not
an incident, which is why it can run as a background track.

## Phases

Each phase is separately shippable and separately revertible. That is the whole
point of splitting them — a migration that only lands as one 4,000-line commit
cannot be paused, and this one will be paused.

| Phase | What | Its check |
| ----- | ---- | --------- |
| 1 | v2 client alongside v1, unused | `pytest tests/payments -q` |
| 2 | Reads go through v2, writes stay on v1 | `pytest tests/payments -q` + one week of the disagreement metric |
| 3 | Writes go through v2 | full suite + a real payment in test mode |
| 4 | Remove v1 | `grep -r stripe.v1 src/` returns nothing |

## Dependencies

Phase 3 touches the nightly dunning job, which track 1 is also rewriting. **The
two must not run at the same time.** Whichever gets there second waits.

Added during phase 2: v2 paginates by cursor, v1 by offset, and that job pages
by hand on the offset. Under a cursor its loop never ends. Track 1 owns the
rewrite, so the fix belongs there, not here.

## Decisions taken up front

- **Idempotency keys are ours, not Stripe's.** v2 changed the retry semantics;
  deriving the key from our own order id keeps the behaviour identical across
  the cutover.
- **No dual-write.** Writing to both APIs would double the webhooks and there is
  no reconciliation budget on this project.
- **Amounts stay integers.** They already are; stating it so nobody helpfully
  introduces a `Decimal`.

## Out of scope

Subscriptions. This client does not use them, and the v2 subscription model is
a different migration.
