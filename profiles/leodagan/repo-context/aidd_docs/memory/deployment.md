# Deployment

Kubernetes, one namespace per environment. Rollout is progressive: the scheduler
last, always, because it holds the leases.

- A migration ships in its own deploy, before the code that needs it.
- `deploy/prod/` manifests are off limits to generation.
- Rollback procedure: `.claude/skills/rollback/SKILL.md`. It exists because a
  rollback that drops in-flight batches costs a day of replay.
