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
| `pnpm format` | Biome, rewrites files in place |
| `pnpm format:check` | Biome, reports without rewriting |

Formatting is deliberately outside `check`, for the same reason as `build`: a mis-indented file blocks nothing about correctness. Biome is a formatter here and nothing else — its linter is off, `typecheck` and `architecture` already own those verdicts.

`pnpm check` is the single source of truth. A human, an agent, a worktree or a future CI run the same gate without depending on anything being installed.

## Before commit

`pnpm check`.

Lefthook runs `biome format --write` on the staged files, restages what it rewrote, then runs it on `pre-commit` and refuses the commit on failure. **The hook is a local net, not the gate** — it can be bypassed, uninstalled, or absent from a fresh worktree, and nothing about correctness may rest on it. `lefthook install` is wired through the `prepare` script, so `pnpm install` arms it.

## Before push

`pnpm check`, then `pnpm build` — tsup must produce `dist/cli.js`. Build is deliberately outside `check`: a broken bundle blocks distribution, not correctness.

## The boundary rules

`pnpm architecture` must fail on any of these. This is the wall parallel worktree agents are most likely to breach, so it fails mechanically rather than in review:

- `maturity/` importing `evidence/`, `assessment/` or `cli/`
- `evidence/` importing `maturity/`, `assessment/` or `cli/`
- a model, use-case, contract, engine or resolution file importing `node:fs`, `node:child_process`, or any vendor package
- `assessment/` importing concrete infrastructure from `adapters/` or `loading/` — it may compose public APIs only

### The cruise sees production only

* `depcruise` excludes `*.test.ts`, `*.test-adapter.ts`, `*.test-fixture.ts`.
* Why: suites sit beside their subject, so `vitest` becomes an `npm-dev` import from inside `engine/`, `resolution/`, `composition/` and `usecases/` — `domain-has-no-vendor-sdk` would fire on every one. The rules describe what `dist/cli.js` may depend on; a test file is not in that graph.
* The cost: no rule constrains the test graph any more, `no-circular` included.
* **A production file must never carry one of those suffixes** — it walks out of every wall at once, silently, and nothing reports it.
* Sentinels are named `__boundary-sentinel__*.ts` and stay inside the cruise.

### The rules are themselves under test

**A dependency-cruiser rule that matches nothing reports success.** A green `pnpm architecture` would otherwise be ambiguous: either the architecture holds, or the wall was never there.

`scripts/prove-boundary-rules.mjs` closes that gap. It writes a sentinel violation for every rule in every folder that rule reaches, cruises, and fails unless each one fired — matching on the pair *(rule, violating file)*, so no sentinel can vouch for another. It always removes what it wrote, and sweeps stale sentinels before starting.

Adding a boundary rule means adding its sentinel, and so does widening one: a rule extended to a new folder is unproven there until a sentinel sits in it. When several rules widen into the same folder, each one needs its own sentinel there — one rule's sentinel proves nothing about the others sharing that path. A rule with no sentinel is a rule nobody has checked.

**Moving a file can walk it out from under a rule, and nothing says so.** These rules match on paths, so a rule written against `^src/[^/]+/adapters/` stops applying the moment the file it guarded moves to `^src/[^/]+/loading/` — no violation, no warning, one fewer wall. The sentinel keeps passing, because it still proves the rule bites in the folder it names. Whenever a file crosses folders, re-read every rule whose path mentioned the folder it left, and give the folder it entered its own sentinel.

The script traps `SIGINT` and `SIGTERM` as well as using `finally`, because a surviving sentinel is worse than a failed run: `pnpm architecture` cruises before it sweeps, so a leftover makes `depcruise` exit 1, `&&` short-circuits, and the sweep never gets its turn. A `SIGKILL` still escapes; the start-of-run sweep is the recovery.

Two failure modes it exists to catch, both of which silently disarmed a rule here:

- `to.path` matches the **resolved** module, not the import specifier: `import 'node:fs'` resolves to `fs`, so `^node:fs$` never matches. Use `^(node:)?fs$`.
- `dependencyTypes: ['npm']` excludes a devDependency, which is `npm-dev`. The rule keeps a dedicated devDependency sentinel so it cannot be narrowed back.

## Behavior

If a fix is needed, spawn 1 agent per failing assertion (typecheck / test / architecture = up to 3 agents).
