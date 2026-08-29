# Coding Assertions

The checks that must pass for code to count as done. Minimal, run after every change.

## The command surface

One assertion, one command, one verdict. An agent reading `pnpm architecture failed` knows it breached a boundary; it does not have to decode a red test run.

| Command | Checks |
| ------- | ------ |
| `pnpm typecheck` | TypeScript, `strict` |
| `pnpm test` | Vitest, behavior only — and tsup, which `tests/cli/process-contract.test.ts` runs to build the binary it spawns |
| `pnpm architecture` | dependency-cruiser boundary rules, then the proof that those rules bite |
| `pnpm check` | the three above, in that order, fail-fast |
| `pnpm format` | Biome, rewrites files in place |
| `pnpm format:check` | Biome, reports without rewriting |

Formatting is deliberately outside `check`: a mis-indented file blocks nothing about correctness. That reason once covered `build` too; it no longer does — see **Before push**. Biome is a formatter here and nothing else — its linter is off, `typecheck` and `architecture` already own those verdicts.

`pnpm check` is the single source of truth. A human, an agent, a worktree or a future CI run the same gate without depending on anything being installed.

## Before commit

`pnpm check`.

Lefthook runs `biome format --write` on the staged files, restages what it rewrote, then runs it on `pre-commit` and refuses the commit on failure. **The hook is a local net, not the gate** — it can be bypassed, uninstalled, or absent from a fresh worktree, and nothing about correctness may rest on it. `lefthook install` is wired through the `prepare` script, so `pnpm install` arms it.

## Before push

`pnpm check`, then `pnpm build` — tsup must produce `dist/cli.js`. The entry is `src/cli/main.ts`, and both it and the command it wraps, `assess.command.ts`, exist — `pnpm build` is green.

Build used to sit outside `check` on the ground that a broken bundle blocks distribution, not correctness. **That is no longer true.** `tests/cli/process-contract.test.ts` spawns `dist/cli.js` to observe the exit codes a caller sees, and builds it in `beforeAll` so it can never test a stale artefact — so a bundle that will not build now fails `pnpm test`, and with it `pnpm check`. The explicit `pnpm build` here still earns its place: it is the one that proves the *published* entry point, and it reports a bundling fault as a bundling fault instead of as a failed hook.

## The boundary rules

The walls themselves are in `architecture.md` under **Dependency rules**. `pnpm architecture` is what makes them fail mechanically rather than in review — this is the boundary parallel worktree agents are most likely to breach.

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
