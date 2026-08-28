# Coding Assertions

The checks that must pass for code to count as done. Minimal, run after every change.

**Status: `pnpm check` runs and exits zero.** `pnpm build` stays red until `src/cli/assess.command.ts` lands — tsup has no entry point yet.

## The command surface

One assertion, one command, one verdict. An agent reading `pnpm architecture failed` knows it breached a boundary; it does not have to decode a red test run.

| Command | Checks |
| ------- | ------ |
| `pnpm typecheck` | TypeScript, `strict` |
| `pnpm test` | Vitest, behavior only |
| `pnpm architecture` | dependency-cruiser boundary rules, then the proof that those rules bite |
| `pnpm check` | the three above, in that order, fail-fast |

`pnpm check` is the single source of truth. A human, an agent, a worktree or a future CI run the same gate without depending on anything being installed.

## Before commit

`pnpm check`.

Lefthook runs it on `pre-commit` and refuses the commit on failure. **The hook is a local net, not the gate** — it can be bypassed, uninstalled, or absent from a fresh worktree, and nothing about correctness may rest on it. `lefthook install` is wired through the `prepare` script, so `pnpm install` arms it.

## Before push

`pnpm check`, then `pnpm build` — tsup must produce `dist/cli.js`. Build is deliberately outside `check`: a broken bundle blocks distribution, not correctness.

## The boundary rules

`pnpm architecture` must fail on any of these. This is the wall parallel worktree agents are most likely to breach, so it fails mechanically rather than in review:

- `maturity/` importing `evidence/`, `assessment/` or `cli/`
- `evidence/` importing `maturity/`, `assessment/` or `cli/`
- a domain or use-case file importing `node:fs`, `node:child_process`, or any vendor package
- `assessment/` importing a concrete adapter — it may compose public APIs only

### The rules are themselves under test

**A dependency-cruiser rule that matches nothing reports success.** A green `pnpm architecture` would otherwise be ambiguous: either the architecture holds, or the wall was never there.

`scripts/prove-boundary-rules.mjs` closes that gap. It writes one sentinel violation per rule, cruises, and fails unless every rule fired — matching on the pair *(rule, violating file)*, so no sentinel can vouch for another. It always removes what it wrote, and sweeps stale sentinels before starting.

Adding a boundary rule means adding its sentinel. A rule with no sentinel is a rule nobody has checked.

Two failure modes it exists to catch, both of which silently disarmed a rule here:

- `to.path` matches the **resolved** module, not the import specifier: `import 'node:fs'` resolves to `fs`, so `^node:fs$` never matches. Use `^(node:)?fs$`.
- `dependencyTypes: ['npm']` excludes a devDependency, which is `npm-dev`. The rule keeps a dedicated devDependency sentinel so it cannot be narrowed back.

## Behavior

If a fix is needed, spawn 1 agent per failing assertion (typecheck / test / architecture = up to 3 agents).
