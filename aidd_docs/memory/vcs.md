# VCS

The version-control conventions this project follows: branches, commits, and the platform.

## Setup

- Main branch: `main`
- Platform: **none**. Local Git only. A remote is not required for the MVP; GitHub/GitLab integrations are explicitly post-MVP.
- No CI. Docker and hosted infrastructure are out of scope.
- `pnpm-lock.yaml` is committed. `node_modules/` and `dist/` are ignored.

## Branches

Work is split across **Git worktrees, one per bounded context**, and only once the model, the decision semantics, the public contract and the dependency rules are frozen (`aidd_docs/INSTALL.md` step 8):

- `maturity` · `evidence` (resolution + fixture collector) · live repository collector · `assessment` + CLI

Agents must not redefine shared semantics inside their context. Contracts first, implementations in parallel.

## Commits

- No convention is fixed yet; the repository holds a single `Initial commit`.

## Commit Strategy

AI should auto commit: `never`
