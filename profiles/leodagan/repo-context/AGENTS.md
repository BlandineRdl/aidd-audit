# AGENTS.md

Event ingestion platform. Go for the services, React for the admin console,
Kubernetes deployment.

## Before anything else

Restate what is about to be done, with the edge cases identified, **before**
writing code. Wait for approval.

## Where things are

- `aidd_docs/memory/` — brief, architecture, codebase map, assertions, testing,
  vcs, deployment. Read before proposing a change, not after someone rejects one.
- Plugins are declared in `.claude/settings.json`: `aidd-context`, `aidd-dev`,
  `aidd-vcs`. They are installed, not vendored — do not look for them in the
  tree.
- `.claude/rules/` — one file per business domain, loaded according to the files
  touched.
- `.claude/skills/` — adding an endpoint, schema migration, rollback.
- `.claude/agents/` — schema review before a migration, connector review on any
  change under `connectors/`.

## Off limits

- `internal/crypto/`: human review required, no generation.
- Production manifests under `deploy/prod/`.

## Warning sign

If the same fix is applied twice, the problem is in these instructions, not in
the code. Raise the rule before fixing again.
