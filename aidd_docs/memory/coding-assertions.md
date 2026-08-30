# Coding Assertions

The checks that must pass for code to count as done. Minimal, run after every change.

## The command surface

One assertion, one command, one verdict. An agent reading `pnpm architecture failed` knows it breached a boundary; it does not have to decode a red test run.

| Command | Checks |
| ------- | ------ |
| `pnpm typecheck` | TypeScript, `strict` |
| `pnpm test` | Vitest, behavior only — and tsup, which `tests/cli/process-contract.test.ts` runs to build the binary it spawns |
| `pnpm architecture` | dependency-cruiser boundary rules, then the proof that those rules bite |
| `pnpm comments` | that every multi-line `//` block declares its purpose |
| `pnpm mutation` | Stryker over the decision logic. Minutes, not seconds — see `testing.md` |
| `pnpm check` | `typecheck`, `test`, `architecture`, `comments`, in that order, fail-fast. Not `mutation` |
| `pnpm format` | Biome, rewrites files in place |
| `pnpm format:check` | Biome, reports without rewriting |

Formatting is deliberately outside `check`: a mis-indented file blocks nothing about correctness. That reason once covered `build` too; it no longer does — see **Before push**. Biome is a formatter here and nothing else — its linter is off, `typecheck` and `architecture` already own those verdicts.

### Comments are judged mechanically, over the whole tree

`.claude/rules/01-standards/1-comments.md` bans `/** */` outright and requires a multi-line `//` block to open with `INVARIANT:`, `SAFETY:`, `COMPAT:` or `LIMITATION:`. `scripts/check-comment-tags.mjs` is what makes that a verdict rather than a suggestion — it was the one rule in `.claude/rules/` with no mechanical counterpart, and a rule nothing checks is a rule nobody has checked.

**The docblock is banned because TypeScript already does its job.** A signature states the parameters, the return and the shape, so what remains of the form is an invitation to restate the name. It was also the one place narration could hide from a check that governed only `//`; an attempt to keep docblocks and judge them *by placement* was written and thrown away — sixty lines, a state machine for multi-line imports, wrong twice before it was right, and it still left the genre unjudged. Removing the form removed the hole and the machinery at once.

**File-header prose is not an exception.** What a module is for belongs in `aidd_docs/`, and a header repeating it is duplication. One line, or nothing.

**It judges every governed file in the tree**, tracked or not — `git ls-files --cached --others`, so a new file is caught before it is ever added. It was scoped to the current branch's changed files while the repository still held 220 non-conforming blocks; that migration is done and the scoping went with it.

**Governed is `src/**.ts`, `tests/**.ts`, `scripts/**.mjs` and the root configs** — `*.config.ts`, `*.cjs`, `*.mjs`. The root was outside it once, and that is where the last docblock in the repository sat: `.dependency-cruiser.cjs`, the file defining the architecture rules. A gate that cannot reach the files configuring the gate is the same failure this whole section exists to close.

**A single line needs no tag, and that is the rule's one soft edge.** A long reason compressed onto one line passes; wrapped back to the project's `lineWidth` of 100 it becomes a block, and a block needs a tag. Biome does not wrap comments, so nothing reports the overrun — this is a review catch, and the migration produced nineteen of them in one batch.

The script checks two things and reads nothing: no `/**`, and a run of two or more `//` lines opens with a tag. A tag is therefore a claim, not a passport — `INVARIANT:` in front of narration satisfies it and defeats it. What it buys is that an untagged block and a docblock are both impossible, and that a mislabelled tag is a sharp review target, which is a better position than prose nobody enforced.

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

**`ports/` is domain and the three `domain-has-no-*` rules say so.** They omitted it once while `no-orphans` in the same file exempted `contracts/` and `ports/` as domain — one config calling the same folder two things, and `evidence-collector.port.ts`, frozen in `architecture.md`, free to import `node:fs` with the gate green. Widening those three earned three sentinels in `src/evidence/ports/`, one per rule.

**Landing `src/harness/` widened every rule that matches by folder name, and two new ones besides.** `harness-is-a-peer` and `assessment-never-depends-on-harness` are new — the context feeds no assessment, so both directions needed their own rule, since neither could be read off `maturity-is-a-peer` or `evidence-is-a-peer`'s existing pattern. The three `domain-has-no-*` rules match a **fixed list of folder names**, not any folder holding pure functions, so `measurement/` and later `advice/` each had to be **added to that list by hand, in all three rules**, and then given their own sentinel per rule in their own folder. Only `no-orphans` reaches a new folder by pattern, through its `pathNot`. Reading this the other way round — that a new folder of pure functions is covered because the rules match by folder name — is exactly the belief the paragraph below warns produces a silently missing wall. Total: nine dependency-cruiser rules became eleven, `scripts/prove-boundary-rules.mjs` went from proving eight of them to proving ten — `no-orphans` stays the one rule proven by convention rather than by sentinel, on both counts — and the sentinel count rose from 25 to 44.

**`advice/` repeated the same widening, for the same reason.** The findings feature added a new folder, `src/harness/advice/`, holding pure functions over an already-composed report — `guidelines.ts`'s five chosen constants and `harness-findings.ts`'s pure comparison against them. No new dependency-cruiser rule was needed, since `advice/` breaks no boundary `harness-is-a-peer` or `assessment-never-depends-on-harness` did not already cover by matching `^src/harness/`; only the three `domain-has-no-*` rules, matching by folder name, needed widening to include it — `no-orphans` was already exempt on `contracts/` and `ports/` alone and does not reach `advice/` either way. Each of the three earned its own sentinel in `src/harness/advice/`, proven by neutering: removing `advice` from one rule's folder set at a time and confirming `pnpm architecture` fails, naming that exact rule and `src/harness/advice/__boundary-sentinel__{fs,proc,vendor}.ts`, before restoring it. The rule count stayed at ten proven; the sentinel count rose from 44 to 47.

**Moving a file can walk it out from under a rule, and nothing says so.** These rules match on paths, so a rule written against `^src/[^/]+/adapters/` stops applying the moment the file it guarded moves to `^src/[^/]+/loading/` — no violation, no warning, one fewer wall. The sentinel keeps passing, because it still proves the rule bites in the folder it names. Whenever a file crosses folders, re-read every rule whose path mentioned the folder it left, and give the folder it entered its own sentinel.

The script traps `SIGINT` and `SIGTERM` as well as using `finally`, because a surviving sentinel is worse than a failed run: `pnpm architecture` cruises before it sweeps, so a leftover makes `depcruise` exit 1, `&&` short-circuits, and the sweep never gets its turn. A `SIGKILL` still escapes; the start-of-run sweep is the recovery.

Two failure modes it exists to catch, both of which silently disarmed a rule here:

- `to.path` matches the **resolved** module, not the import specifier: `import 'node:fs'` resolves to `fs`, so `^node:fs$` never matches. Use `^(node:)?fs$`.
- `dependencyTypes: ['npm']` excludes a devDependency, which is `npm-dev`. The rule keeps a dedicated devDependency sentinel so it cannot be narrowed back.

**Prose has the same failure and no sentinel at all.** A comment naming a position — `the candidate gate below`, `Every table below`, `further down` — stops being true the moment its code moves, and a stale comment compiles. Three survived two refactors of `harness-scan.ts`, each caught by a reviewer rather than by a check. Name what a comment refers to instead of where it sits, and when a file is split, re-read what crossed with the code and what was left behind.
