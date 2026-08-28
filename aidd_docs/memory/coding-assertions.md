# Coding Assertions

The checks that must pass for code to count as done. Minimal, run after every change.

**Status: both gates run and exit zero.** `pnpm build` stays red until `src/cli/assess.command.ts` lands — tsup has no entry point yet.

## Before commit

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `pnpm typecheck` | TypeScript, `strict` |
| 2 | `pnpm test` | Vitest, plus the dependency-cruiser boundary rules |

## Before push

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `pnpm test` | the full suite: decision, resolution, integration, acceptance |
| 2 | `pnpm build` | tsup produces `dist/cli.js` |

## The boundary rules

dependency-cruiser must fail the build on any of these. This is the wall parallel worktree agents are most likely to breach, so it fails mechanically rather than in review:

- `maturity/` importing `evidence/`, `assessment/` or `cli/`
- `evidence/` importing `maturity/`, `assessment/` or `cli/`
- a domain or use-case file importing `node:fs`, `node:child_process`, or any vendor SDK
- `assessment/` importing a concrete adapter — it may compose public APIs only

## Behavior

If a fix is needed, spawn 1 agent per assertion to fix (e.g. typechecking / tests / boundary rules violated = 3 agents).
