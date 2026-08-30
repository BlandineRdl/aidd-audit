# Spec — idempotent movement ledger

> Written before starting. Shipped as PR #912.

## The problem

Three accounts credited twice last week. The consumer replays unacknowledged
messages, and nothing makes a second write a no-op.

## What I want

Recording the same event twice leaves one movement. The second call says so
rather than failing loudly, because a replay is normal operation and not an
incident.

## Decisions taken up front

| Question | Answer |
| -------- | ------ |
| Where does uniqueness live? | Unique constraint on `event_id`. The database, not the code |
| What does the second call return? | A dedicated error the consumer catches and acknowledges |
| Amount type? | `int64` cents |
| Do we check before inserting? | Yes, but only to save a round trip. It settles nothing |

## Cases

- Same event twice, sequentially → one movement.
- Same event twice, concurrently → one movement, the loser gets the error.
- Invalid movement → rejected before touching the database.
- Store unavailable → error bubbles up, the consumer does not acknowledge.

## Out of scope

Reprocessing the three double credits already in production. Separate task,
manual, with the finance team.
