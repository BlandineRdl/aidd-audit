---
name: rollback
description: Roll back a release of the ingest platform without losing in-flight batches. Use when a deploy has to be undone.
---

# Procedure — rollback

Decide in under two minutes.

1. **Roll back first, understand after.** `kubectl rollout undo deploy/<name>`.
2. Announce it in `#incidents` with the deploy SHA, before investigating.
3. Check the metric that triggered the alarm has come back. If it has not, the
   deploy was not the cause and the rollback bought nothing — say so.
4. Open an issue with the SHA and what was observed. Same day.

## When a rollback is not enough

If the release ran a migration, the rollback does not undo it — that is why
migrations are additive and spread over two releases. If a migration was not
additive, this procedure does not apply and you are in an incident.
