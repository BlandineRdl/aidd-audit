# AGENTS.md

Solo. Six client repositories, one way of working across all of them. This file
is symlinked into each; if it says something repository-specific, that is a bug.

## Where things are

- `docs/context/` — brief, the six clients, testing, vcs. Imported from
  `CLAUDE.md`, so it is loaded before anything I say.
- `.claude/skills/` — `/plan`, `/verify`, `/harden`, and the external API
  migration procedure.
- `.claude/agents/` — spec review before the work, migration audit during it.
- `superpowers` is enabled in `.claude/settings.json` for the generic parts —
  worktrees, plans, code review. What is here is only what is mine.

## Non-negotiable


## Running them

One session per task, isolated: `claude --worktree <task-id>`. Four terminals on
a normal day, up to seven when three tracks overlap. `.worktreeinclude` carries the `.env` files across: a worktree is
a fresh checkout, and the first check would otherwise fail for a missing secret
rather than for the task.

## Off limits

- Client credentials and IAM policy.
- Production manifests.

## Known gap

Nothing relaunches a failed task. A worktree whose check fails stays as it is
and I pick it up the next morning. See `docs/brainstorm/2026-06-auto-retry.md`.
