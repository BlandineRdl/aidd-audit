# Brainstorm — worktrees versus containers

> Settled. Kept for the reasoning, not the conclusion.

## The problem

Three agents writing into one checkout collide on the first shared file. Even
when the tasks are disjoint, `git status` is shared state and the commit step
picks up someone else's work.

## Options considered

| | Cost | What it buys |
| - | ---- | ------------ |
| **One worktree per task** | ~200 ms setup, disk | Isolated tree, shared object store, branch per task for free |
| **One container per task** | seconds, image maintenance | Isolated everything, including installed dependencies |
| **One clone per task** | seconds, full object copy | Isolation, no shared history |
| **Serial** | zero | Nothing to solve |

## Chosen: worktrees

The tasks share dependencies — same repository, same lockfile. Containers would
buy isolation I do not need and cost a rebuild per task.

The failure mode to watch: an orphaned worktree holds its branch, and the next
run fails on `already exists`. Hence `claude --worktree`, which owns the
creation and the cleanup, rather than a script of mine that
removes it whatever happens. That line exists because I lost forty minutes to
it once.

## What would change my mind

A task that needs a different runtime version. Then it is a container, and the
runner grows a `--isolation` flag.
