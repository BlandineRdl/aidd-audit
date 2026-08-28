---
name: migrate-external-api
description: Phased migration of a third-party API client — new client alongside the old, reads before writes, a disagreement metric before cutover. Use when replacing or upgrading a provider SDK.
---

# Migrate an external API

Same shape every time, on five clients now. Written down after the third one,
where I improvised and shipped a cutover I could not roll back.

## The rule that produces every step below

**Every phase ships alone and reverts alone.** If a phase cannot be reverted by
a deploy, it is two phases.

## Steps

1. **Read the provider's changelog end to end.** Not the migration guide — the
   changelog. The guide tells you what they want you to change; the changelog
   tells you what actually changed.
2. **List the semantic differences**, not the signature differences. Retries,
   idempotency, pagination, error taxonomy, rate limits. Signature changes are
   found by the type checker; semantic changes are found in production.
3. **New client alongside the old, unused.** Ships on its own, reverts on its own.
4. **Reads first.** A wrong read is visible. A wrong write is not.
5. **A disagreement metric before the write cutover.** Count the cases where old
   and new disagree. Cut over when it is flat at zero for a week, not when the
   tests pass.
6. **Writes.** One real transaction in test mode, checked by hand, before the
   phase is called done.
7. **Remove the old client** in a later release, never the same one.

## Stop conditions

- The disagreement metric is not flat → do not cut over, whatever the deadline.
- The phase touches a file another track is rewriting → wait, do not merge.
- The provider's deprecation date moves closer than the remaining phases → say
  so to the client, in writing, the day you notice.

## What this procedure does not cover

Anything with a data migration attached. That is `schema-migration`, and it is
a different set of rules.
