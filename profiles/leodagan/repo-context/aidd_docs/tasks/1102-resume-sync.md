# Plan — resume synchronisation where it fails

> Owner: me. Reviewed by @marc before the branch existed. PR #1102.

## Why now

Three nightly failures in a row last week. Each one restarts 40,000 records
from zero, the window is four hours, and a full run takes 22 minutes when
nothing goes wrong. Three failures put us a day behind.

## The shape of the fix

Batches. Retry the batch, not the run.

## Steps, in order

| # | Step | Done when |
| - | ---- | --------- |
| 1 | Failing test: a batch that fails once then succeeds | It fails because `writeLocal` is called once, not twice |
| 2 | Batch loop with `batchSize`, default 100 | Test 1 passes, existing tests still pass |
| 3 | Retry per batch with exponential backoff | Test on give-up after the last attempt |
| 4 | `dryRun` that counts without writing | Test asserting `writeLocal` was never called |
| 5 | Replay the night of the 12th, cutting the network halfway | No duplicates in the database |

## Decisions taken up front

- **Backoff doubles.** Three clients retrying in lockstep finish the network's
  job for it. `2 ** attempt * 100` ms.
- **No resume across process restarts.** That needs progress persisted, so a
  table and a migration. Worth it past an hour of processing; we are at 22
  minutes.
- **`batchSize` is an option, not a constant.** The nightly job and the manual
  reruns do not want the same value.

## What could go wrong

A batch that partially wrote before failing would duplicate on retry.
`writeLocal` is already an upsert on the remote id — verified before writing
the plan, not after.
