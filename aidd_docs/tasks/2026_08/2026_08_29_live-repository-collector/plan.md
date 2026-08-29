# Live repository evidence collector

One `EvidenceCollector` reading a local working copy: the real filesystem and local Git,
entirely offline. It emits `Observation`s only, never `Evidence`, and holds no maturity,
level or profile knowledge.

Scope was split with `assess-reference-profile-from-cli`, which owns the fixture bundle
adapter. Nothing here reads `profiles/`.

## The deliverable

`src/evidence/adapters/live-repository.adapter.ts`

```ts
class LiveRepositoryEvidenceCollector implements EvidenceCollector {
  readonly id = 'live-repository'
  readonly supportedAxes = ['size', 'harness', 'intervention', 'parallelism']
}
```

`intervention` is declared and never emitted. That is deliberate and is the spec's own
worked example: `supportedAxes` is what a collector may attempt, provenance says who was
asked, evidence says who answered. A merge records that a branch landed, never what
followed review.

Two internal modules, both in `adapters/` because filesystem, Git and config parsing stay
there:

| File | Owns |
| --- | --- |
| `live-repository/git-process.ts` | running `git` with `context.signal`, the shared seam |
| `live-repository/harness-scan.ts` | the exact-name table, the trailer list, `loops` |
| `live-repository/git-history.ts` | the first-parent walk, `size`, `parallelism` |

## Preconditions, before any axis

Read once, in the adapter:

* not a Git work tree -> no tracked tree and no history. Emit nothing, on every axis.
* `git rev-parse --is-shallow-repository` true -> the visible history is a truncation that
  looks ordinary. Emit nothing on `size` and `parallelism`. The harness scan still runs:
  a truncated history does not truncate the tracked tree.
* unborn `HEAD` -> `git log` exits fatal. Emit nothing on `size` and `parallelism`.

An unreadable source is not an empty source. Every "emit nothing" above resolves `UNKNOWN`,
an evidence gap, which is what the situation is.

## harness

Scan domain is the tracked tree (`git ls-files -z`), never the working directory: an
untracked file is not versioned. Matching is by exact name, never by pattern. A named file
matches anywhere in the tree; a named directory matches at the root only.

| Capability | Any one of |
| --- | --- |
| `prompts` | a delivered commit in the window carrying an AI attribution trailer; or `session.md`, `prompt-history.md`, `.aider.chat.history.md`; or `.specstory/`, `.claude/history/` |
| `context-engineering` | `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`; or a tracked file under `aidd_docs/memory/`, `docs/context/`, `.ai/` |
| `behavior` | `.claude/rules/`, `.claude/agents/`, `.claude/hooks/`, `.claude/skills/`, `.cursor/rules/`, `.cursorrules`, `.windsurfrules`, `.github/agents/`; or a permission allow/deny list in a tracked settings file |
| `loops` | a tracked executable script satisfying both conditions below |

Emit exactly one `OBSERVED` observation for `harness`, carrying the union as a
`readonly string[]`. Drop any member absent from `context.vocabulary`'s `harness` scale
rather than invent a term.

**AI attribution trailer** is a closed list, matched in a trailer line of a delivered
commit's message, case-insensitively, on the value side of `Co-Authored-By:` or
`Co-Authored-By`-shaped trailers: `claude`, `codex`, `gemini`, `aider`, `cursor`,
`copilot`, `devin`. Extending it is an edit to this file, not a runtime decision. The
trailer is attribution, never authorship, and is read for `prompts` alone.

**`loops`**, both conditions on the script's own content:

1. it invokes one of `claude`, `codex`, `gemini`, `aider`, `cursor-agent`, matched in
   command position -- a closed list;
2. that invocation sits inside a loop whose continuation depends on the exit status of a
   separate command.

Only shell is reliably recognisable. A script is decidable when it is shell: a
`sh`/`bash`/`zsh` shebang, or a `.sh`/`.bash`/`.zsh` extension.

**The trap that must be tested.** A tracked executable script satisfies condition 1, is not
shell, and condition 2 cannot be decided -> emit **no `harness` observation at all**. Not a
set with `loops` dropped. A set has no per-member unknown, so dropping the member publishes
`CONFIRMED` without it, `scale-comparison` finds it missing, and the report becomes a
practice gap the collector never observed. AIDD would tell a developer who built a loop to
go build a loop.

## size

Delivered change = one merge commit on the `--first-parent` walk from `HEAD`. Diffstat is
`git diff --numstat M^1 M`. All merges count, no filtering by type or size.

* **No merge on the walk -> emit nothing.** A squash history and a rebase history look
  identical afterwards and demand opposite readings. No per-commit fallback: under-measuring
  publishes `CONFIRMED` too low, which becomes a practice gap.
* Window: the 180 days ending at the most recent commit's date, never wall-clock now, or the
  same repository reports two levels on two days.
* Fewer than 5 delivered changes in the window -> a sample, not a habit. Emit nothing.

Compute the median lines changed (`+` and `-` summed) and the median files changed across
the delivered changes, bucket each, and emit the **lower** bucket. Bounds are half-open, so
a half-integer median lands in exactly one row.

| Bucket | Lines | Files |
| --- | --- | --- |
| S | < 100 | < 5 |
| M | >= 100, < 400 | >= 5, < 10 |
| L | >= 400, < 1000 | >= 10, < 25 |
| XL | >= 1000 | >= 25 |

`none` is bundle-only and never emitted here.

## parallelism

Median, over active days in the window, of the number of distinct branches receiving a
commit that day. The median, not the peak: an isolated spike does not count. Active days
only, so an intermittent contributor is not measured as mostly zero.

**A reading is forced here and must be recorded in the commit body.** Local Git does not
record which branch a commit was made on. What it does record is the merge graph, so a
branch is recovered as a merge side: for each merge `M` on the first-parent walk,
`git rev-list M^1..M^2` is the branch it absorbed; first-parent commits that are not merges
are the mainline. Group every commit by its author date, count distinct branches per day,
take the median over days holding at least one commit.

This is a fact about the recorded graph, not an inference about a workflow, and it carries
the same ceiling as `size`: no merges -> nothing recoverable -> emit nothing. Fewer than 5
active days -> emit nothing.

What it rules out: reachability-based attribution, where every commit belongs to every
descendant branch and the count is meaningless; and any read of local branch refs, which
describe today's tips, not the days being measured.

## Cancellation

Every `git` invocation is passed `context.signal`. Check the signal between phases too, so
a long filesystem scan is not a silent hang. Exceeding the budget must surface as a
rejection the use case turns into `TIMED_OUT`, never as a hang and never as an empty
successful run.

## Resilience inside the collector

The harness scan and the Git walk fail independently. One unreadable source must not cost
the other: emit what was readable and complete. The use case reports a COMPLETED run as
responsible for every requested axis it supports, whether or not it emitted an observation
for each -- that is designed. Only a subject that is not a Git work tree at all makes the
whole run empty.

## Tests

Integration, against real temporary Git repositories and the real filesystem, built per
test in `os.tmpdir()` and removed after. Do not mock Git to test the Git adapter. Suites sit
beside their subject in `adapters/live-repository/`.

Behaviours that must be pinned:

* not a Git work tree -> no observations at all
* shallow clone -> harness only, no `size`, no `parallelism`
* unborn `HEAD` -> no `size`, no `parallelism`
* history with no merge -> no `size`, no `parallelism`, harness unaffected
* 4 delivered changes -> nothing; 5 -> a `size` observation
* lines and files buckets disagreeing -> the lower one wins
* a half-integer median -> exactly one bucket
* window excludes a commit older than 180 days before the most recent commit
* wall-clock now is not the window's end
* the trailer proves `prompts` with no transcript file present -- the trap the harness axis
  has to survive
* an untracked `CLAUDE.md` proves nothing
* `prompt-toolkit-notes.md` proves nothing: exact names, never globs
* a named directory found below the root proves nothing
* a shell script looping an agent on another command's exit status -> `loops` in the set
* a non-shell script invoking an agent -> **no `harness` observation at all**
* a harness member absent from `context.vocabulary` is dropped, not invented
* an aborted signal surfaces as a rejection
* the harness scan surviving an unreadable history, and the reverse

## Out of scope, explicitly

No network, ever. No forge API. No `intervention` value. No fixture bundle reading. No
knowledge of White/Red/Blue/Green/Copper/Silver/Gold. No knowledge of perceval, bohort,
leodagan or arthur. No evidence resolution -- `resolveEvidence` already owns it. No change
to the port, the models, the use case or the contract.

---

# Repairs after review

An independent review found the delivery satisfies twelve of fourteen acceptance criteria and
fails the one the product exists for: *absence of signal never becomes an artificial negative
observation*. Three independent routes reached a manufactured practice gap, and 24 mutants
survived a green suite. What follows settles the readings the repairs share; the rest is in
the review.

## One rule, replacing three local ones

> A harness member is **undecidable** when a source that could have proven it, and that no
> other route has proven, could not be read or could not be parsed.

`undecidable` costs the whole axis, which is `UNKNOWN` — an evidence gap, and honest. The
failure it replaces is silently publishing a `CONFIRMED` set missing a member, which the
engine reads as `NOT_MET`, a practice gap nobody observed. That is the one outcome
`project-brief.md` forbids outright.

It follows that:

* an unreadable settings file, script, or tracked file is `undecidable`, never "absent";
* a shell script that invokes an agent inside a loop construct whose continuation cannot be
  classified is `undecidable`, never "no loops";
* a script with an agent invocation and **no loop construct at all** is decidably *not* a
  loop. Absence read is still an observation; this rule is about sources that could not be
  read, not sources that were read and said no;
* a member already proven by another route suppresses undecidability about it. Nothing is
  hidden once the set is known to contain it.

## `hasAiAttributionTrailer` returns three answers, not two

The function ignores the shallow guard, the window and the merge-based definition of a
delivered change so that no filter can hide a trailer — and then returned `false` on every
git failure, hiding every trailer. Incoherent within one function.

```ts
/** true: found. false: the history was read and holds none. null: it could not be read. */
export function hasAiAttributionTrailer(path: string, signal: AbortSignal): Promise<boolean | null>
```

`null` for an unborn `HEAD`, any `GitCommandFailedError`, and a `maxBuffer` overflow. The
overflow is the likely one: the command streams every commit message in the repository, so
the bigger the subject, the more reliably AIDD manufactured a `prompts` gap. Prefer letting
`git` do the filtering — `--grep` with `-1` returns at most one line and removes the buffer
ceiling entirely — but a `null` on overflow is required either way.

`scanHarness` takes `boolean | null` and applies the rule above: `null` with no other route
proving `prompts` is `undecidable`.

## Closed lists are closed, and say so

Every table in `harness-scan.ts` is a closed list whose currency is the condition under which
the axis tells the truth. An entry missing from one is a manufactured practice gap, and
eleven of the twenty-one entries were unpinned. Each list needs a test that dies when an
entry is removed.

`SETTINGS_FILES` was narrower than both this plan and the spec, which say "a versioned
settings file" without naming one. It stays a closed list — an open reading is unbounded —
and gains the guardrail files of the tools already named elsewhere in these tables:
`.claude/settings.json`, `.claude/settings.local.json`, `.cursor/environment.json`,
`.gemini/settings.json`, `.aider.conf.yml`. Widening it is an edit to this file.

## The trailer list must not match a person

`devin`, `gemini` and `cursor` are plausible human given names or surnames.
`Co-Authored-By: Devin Marsh <devin@example.com>` proved `prompts` on a repository with no
AI involvement at all. That over-reports rather than manufacturing a gap, so it inflates a
level instead of demanding work — the less dangerous direction, and still a claim the
evidence does not carry.

Match an agent identity, not a bare given name: an unambiguous agent token
(`claude`, `codex`, `aider`, `copilot`, `cursor-agent`, `claude-code`), or a known agent
address (`noreply@anthropic.com`, `devin-ai-integration`, `copilot@github.com`,
`bot@cursor.sh`, an address whose local part or domain carries one of those tokens).
A bare `devin`, `gemini` or `cursor` in a display name is not enough on its own.

## What the tests owe

`testing.md` records that this repository's model loader shipped three times with a live
guard nothing held, green suite each round, and that one honest sweep ran 61 mutations with
22 survivors. The same thing happened here. Every repair below lands with the mutant that
proves it, seen red before it is seen green:

* each closed-list entry, removed one at a time;
* `signal` dropped from the `execFile` options — the frozen port's central duty, and today
  nothing proves a subprocess is ever killed;
* each `throwIfAborted` between phases, removed one at a time;
* each `catch` in the adapter, its abort rethrow removed **separately** — a test green
  whichever of two guards you delete holds neither;
* the deleted column dropped from the diffstat sum; no fixture currently deletes a line;
* each size bucket bound, and the window's length and its lower-bound comparison;
* the window applied to parallelism, not only to size;
* `readMostRecentCommitDate` reduced to `git log -1`, which the code's own comment forbids;
* the trailer's whole-token match and its value-side restriction.

A rejection test pins the error class **and** a message fragment naming the offending id.

---

# Second repair: the cause, not the examples

The first repair fixed the five loop shapes the review happened to name and left their cause
intact. A re-review reproduced the forbidden outcome through the real engine on a sixth
shape, and found the undecidability trigger had been widened at the same time as it was
narrowed. What follows settles the four readings that were wrong in principle. None of them
is a patch for an example.

## Double quotes are not opaque

`"$rc"` is a variable reference. Shell performs parameter expansion inside double quotes and
not inside single quotes, so blanking both before tokenising loses exactly the information
the exit-status analysis exists to read. `rc=$?` was learned and then never found again.

**Strip single-quoted content; keep double-quoted content.** That is shell's own rule, and
following it closes `while [ "$rc" -ne 0 ]`, `"${rc}"`, `[[ "$rc" ]]` and `"$?"` at once
rather than one at a time. The quoted form is what ShellCheck mandates (SC2086), so the
version being punished is the better-written one.

## An identifier is not an invocation

Condition 1 is "invokes one of the agents, **matched in command position**". A bare token
anywhere in a non-shell file is not that. `const claude = require('anthropic')` binds a
name; `gemini.generate_content()` calls a method on an object. Both currently cost the whole
harness axis, on repositories using the very SDKs this product is built for.

In a non-shell file, condition 1 needs invocation *shape*: the agent name as a string
literal that begins a command, or an argument to a recognised process-spawning call
(`subprocess.run`, `execFile`, `execSync`, `spawn`, `spawnSync`, `system`, `popen`,
backticks). A bare identifier decides nothing and must leave the scan silent — not
undecidable. "Could not be parsed" is a claim about the source; a file read in full whose
tokens simply are not invocations was parsed fine.

## `for ... in` is decidably not a retry

A `for x in <list>` loop iterates a list. Its continuation depends on the list, never on an
exit status, so an agent inside one runs once per item. That is decidable, and the answer is
"not a retry loop" — never undecidable. `|| exit 1` inside it is fail-fast, which stops the
loop early and still never re-runs the agent on the same input.

`project-brief.md` defines the capability as "a script re-runs the AI until a project command
passes". Only `while` and `until` can do that. So:

* `for ... in` containing an agent -> decidably no `loops`;
* `while`/`until` containing an agent, continuation positively recognised as exit-status
  driven -> `loops`;
* `while`/`until` containing an agent, continuation not recognised -> **undecidable**. A
  while-loop around an agent is plausibly a retry we failed to classify, and guessing "no"
  there is the one direction that manufactures a practice gap.

`read` joins `true`, `[` and `test` as not-a-project-command: `while read -r line; do claude
…; done` consumes input, it does not retry. Iterating is not re-running.

## A display name is not an identity

`claude` sat in a list commented "Tokens no person is called", in a repository whose own
documentation is written in French. `Claude Dupont <claude.dupont@example.com>` proved
`prompts`; so did `Codex Ltd` and `Jan Copilot`. The rule the first repair stated — match an
agent identity, not a bare given name — was applied to three names and not to the one most
likely to collide.

Apply it uniformly. A trailer proves an agent when **any** of:

* the address is a known agent address, or its whole local part is an agent token on a
  domain in the closed vendor list;
* the display name, entire and trimmed, is composed only of agent tokens and agent words
  (`bot`, `[bot]`, `ai`, `code`, `agent`, `assist`, `assistant`, `github`, `google`).
  `Claude`, `Claude Code`, `GitHub Copilot` and `Gemini Code Assist` qualify;
  `Claude Dupont`, `Jan Copilot` and `Codex Ltd` do not. `assist` is on the list because
  this section first wrote `assistant` and named `Gemini Code Assist` as qualifying, which
  the word list as written refused — the two could not both hold, and the over-reporting
  direction is the safer one to resolve it in.

Over-reporting inflates a level rather than demanding work, so this is the safer direction —
but it is still a claim the evidence does not carry, and the code said it had closed it.

## A comment claiming a guarantee is a guarantee owed

Two comments in the delivered code assert that every entry of a closed list is held by a test
that dies when it is removed. For the twenty-one evidence-vocabulary entries that is true.
For the parser tables — `COMMAND_PREFIXES` (14 of 16 unheld), `NOT_A_COMMAND`,
`LOOP_TERMINATORS`, `KEYWORDS_BEFORE_COMMAND` — it is not. The comment argues those entries
are load-bearing for the exact failure under repair. That argument and the missing test
cannot both stand: pin them, or stop claiming them. Pin them.

This is the repository's documented pattern — a live guard nothing held, green suite each
round — reappearing inside the repair meant to end it.

---

# Known limits at hand-off

Each was found by review, judged, and left deliberately. None is a silent hole.

* **A partial clone can make `git diff` reach the network.** On a blobless or treeless clone,
  `git diff --numstat M^1 M` fetches the missing blobs from `origin`, and fails outright when
  the remote is gone. `cli.md` says execution requires no network, ever — so on that one
  repository shape this collector breaks a product constraint. The failure is safe today: the
  adapter catches it and answers `UNKNOWN` for both Git-derived axes. The fix is to refuse a
  partial clone up front, the way the shallow guard already refuses a truncated one
  (`git rev-parse --is-shallow-repository` has a sibling in `remote.origin.promisor` /
  `extensions.partialClone`). It belongs with the other preconditions, not in a patch.
* **A tracked file deleted from the working copy costs the whole harness axis.** That is the
  One Rule applied literally — the file could not be read — and an ordinary mid-edit state.
  Reading blobs from the index (`git show :path`) is the correct fix and is a scope change.
* **An agent reached through a script the loop calls** — `until pnpm check; do ./fix.sh; done`
  where `fix.sh` invokes the agent — is read as "an agent, no loop" on `fix.sh` alone.
  Following the call would mean resolving arbitrary commands to files.
* **A shell function reached through a variable or `$( … )`**, and a header variable assigned
  from another variable (`j=$i`), stay unresolved. One hop is followed for `$?` only.
* **Spawners outside the closed list**, handed a compound command line, are silent unless the
  agent name begins a literal.
* **The Gemini and Cursor trailer addresses are unverified** against real tool output —
  nothing offline can establish them. A wrong entry under-reports, and the repair is to add
  the real address, never to loosen back to a bare name.
* **`intervention` is never emitted**, so a live repository reports `proven: null` whatever
  else is observed. That is `cli.md`'s ceiling, not a gap in this work.

---

# Subject kinds: a provisional gate, not a product rule

The CLI hands every subject to every collector, and this one answers only for the root of a
Git work tree. That gate exists because `profiles/` is tracked *inside this repository*: without
it, `assess profiles/perceval` resolves to the AIDD root and publishes this project's own
`CLAUDE.md` and `.claude/rules/` as perceval's evidence — the wrong subject's harness, reported
as fact. Better `UNKNOWN` than a confident answer about something else.

It is a gate on the only distinction available today, not the distinction that belongs there.
Three subject kinds want three answers, and only the first two are settled:

| Subject | Should be answered by |
| --- | --- |
| a repository root | the live repository collector |
| a reference or profile bundle | the bundle collector, once it exists |
| a directory inside a repository | an explicitly unsupported subject, or a scoped assessment with defined bounds |

**The known consequence:** `cd packages/api && aidd-audit assess .` now yields no evidence at
all. That is a real limitation of this adapter, deliberately accepted here, and not a decision
that a subdirectory can never be assessed. It is the third row above, unresolved.

Resolving it properly means the command routing by subject kind rather than each collector
guessing, which needs the bundle adapter to identify its own subject first. Not this feature's
work. `harness-scan.ts` already scans repository-wide when handed a subdirectory, so the module
is ready for whichever answer the third row gets; only the adapter's applicability gate stands
in the way, and it is one call.
