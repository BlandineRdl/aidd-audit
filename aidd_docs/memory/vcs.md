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

AI should auto commit: `never`
