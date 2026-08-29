# VCS

The version-control conventions this project follows: branches, commits, and the platform.

## Setup

- Main branch: `main`
- Platform: **GitHub**, private repository `BlandineRdl/aidd-audit`, `origin` over https. It is a backup and a sharing point, nothing more: no part of the build, the gate or the product depends on it, and the MVP still works from a clone with no remote.
- No CI, no GitHub Actions, no platform integrations (issues, PR automation, releases). Those stay post-MVP. Docker and hosted infrastructure are out of scope.
- `pnpm-lock.yaml` is committed. `node_modules/` and `dist/` are ignored.

## Branches

Work is split across **Git worktrees, one per bounded context**, and only once the model, the decision semantics, the public contract and the dependency rules are frozen (`aidd_docs/INSTALL.md` step 8):

- `maturity` · `evidence` (resolution + fixture collector) · live repository collector · `assessment` + CLI

Agents must not redefine shared semantics inside their context. Contracts first, implementations in parallel.

## Commits

- **Conventional Commits**, subject in lowercase imperative: `type(scope): what changed`. Scope is optional and names a context (`maturity`, `architecture`), never a file.
- Types in use: `feat`, `fix`, `docs`, `test`, `chore`.
- The subject says what changed; **the body says why**, and is expected on anything but a trivial change. It is the only place a future reader learns which reading was forced and what it rules out.
- Commits authored with an agent carry a `Co-Authored-By:` trailer.
- `Initial commit` is the one exception, and it predates the convention.

## Commit Strategy

AI should auto commit: `never`.

- The one exception: the SDLC pipeline ran to its end — framed, delivered, review approved with no blocker — **and a human validated that outcome**. Both conditions, in that order.
- A green gate is not validation. Neither is an approving reviewer: the pipeline reviews its own work, so the last word belongs to someone outside it.
- Until that word is given, the work stays uncommitted in the worktree.
- An agent reaching the end of the pipeline reports what it built and stops. It never commits in anticipation of approval.
- `/aidd-orchestrator:01-sdlc` ending in "a draft pull request" does not override this rule.
- Push and pull request follow the same gate. `origin` is a backup and a sharing point, so anything that reaches it has been seen by a human first.

## Merge Strategy

Merge commit by default. Squash only when the branch's commits are not worth reading.

- **The criterion is the reader, never the tool.** The commit rule above makes the body the only place a future reader learns which reading was forced; squashing eleven such bodies into one summary destroys eleven distinct answers to *why*. A branch of `wip`, `fix typo`, `re-fix` carries none of that, and there one clean commit beats it. Ask whether the individual commits would be read, not which button is tidier.
- On GitHub that means **Create a merge commit**, never *Squash and merge* or *Rebase and merge*.
- The merge subject is `Merge pull request #N: <what landed, lowercase>`, with a body, on the same footing as any other commit.