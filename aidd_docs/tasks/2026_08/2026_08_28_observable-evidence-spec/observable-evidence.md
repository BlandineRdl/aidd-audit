# Observable evidence per AIDD axis

What each axis accepts as evidence. Tables and traps only: the derivation that produced them is in
`plan.md`, and the ceilings this implies for `assess` are in `cli.md`.

**This file dies when the collectors' tests pin its tables.** Until then it is the only place the
four axes have one reading. Every value below is verbatim from `aidd.yml`'s `scales`.

## Applying any table

- **Window.** Every axis measures a habit. Live: the 180 days ending at the most recent commit,
  never wall-clock now, or the same repository reports two levels on two days. Bundle: its own
  declared `period`; a pre-aggregated median cannot be re-sliced.
- **Minimum sample.** Fewer than 5 delivered changes (`size`, `intervention`) or 5 active days
  (`parallelism`) is a sample, not a habit: emit nothing. Live-collector rule only — a bundle
  publishes medians without the counts behind them.
- **One `OBSERVED` observation per axis per collector**, the `harness` one carrying the union of
  everything seen. Two disagreeing observations on one axis resolve `CONFLICTING` and cost the
  axis. `DECLARED` observations may accompany it; `resolveEvidence` never compares them.
- **Several collectors on one axis is designed, not forbidden.** `collectEvidence` runs each,
  tracks `responsibleAxes` and provenance per collector, and lets `resolveEvidence` arbitrate:
  `CONFLICTING` is what two sources genuinely disagreeing looks like, and it is what a post-MVP
  forge collector beside local Git will produce. In the MVP only one collector answers a given
  subject, because the two adapters read different subject kinds — a bundle path, a repository —
  not because anything forbids the other case.
- **`supportedAxes` is what a collector may attempt, never what it delivered.** `collectEvidence`
  reports a COMPLETED run as responsible for every requested axis it supports, whether or not it
  emitted an observation for each. Under the ceilings above the live adapter routinely delivers
  less than it claims: it supports `size` and `intervention` and will emit neither on most
  histories. Anything naming what is missing must read the evidence, not the provenance — the
  provenance says who was asked, the evidence says who answered.
- **Delivered change, on local Git:** the history reachable from `HEAD`, walked `--first-parent`.
  One merge commit is one delivered change, diffstat `git diff M^1 M`. All merges count, no
  filtering by type or size. **No merge on that walk means no delivered change is recoverable**, so
  `size` emits nothing: a squash history and a rebase history look identical afterwards and demand
  opposite readings. `intervention` emits nothing on any local history, merge-based included — a
  merge records that a branch landed, never what followed review.
- **Vocabulary.** Map to a value in `context.vocabulary`; if the loaded model's scale lacks it,
  emit nothing rather than invent a term. `InvalidObservationError` from
  `maturity/engine/scale-comparison.ts` is a backstop for a bug, not the normal path.

## size

| Bucket | Lines changed (+ and -) | Files changed |
| --- | --- | --- |
| S | < 100 | < 5 |
| M | ≥ 100 and < 400 | ≥ 5 and < 10 |
| L | ≥ 400 and < 1000 | ≥ 10 and < 25 |
| XL | ≥ 1000 | ≥ 25 |

Median delivered change, **lower of the two buckets**. Bounds are half-open so a half-integer
median lands in exactly one row. `none` when the window was read and holds zero changes — a
bundle-only value. Measured over all delivered changes, not only AI-attributed ones: the bundle
aggregate carries no per-change attribution, and a rule the two adapters compute differently
breaks their interchangeability.

## harness

Set membership, union of what was seen. Every row is a disjunction: **any one** entry proves the
capability.

| Capability | Any one of these |
| --- | --- |
| `prompts` | one delivered commit carrying an AI attribution trailer (bundle: `commits.ai_coauthored_ratio > 0`); or a versioned transcript by exact name: `session.md`, `prompt-history.md`, `.aider.chat.history.md`; or the directories `.specstory/`, `.claude/history/` |
| `context-engineering` | `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`; or a versioned memory or convention set under `aidd_docs/memory/`, `docs/context/`, `.ai/` |
| `behavior` | `.claude/rules/`, `.claude/agents/`, `.claude/hooks/`, `.claude/skills/`, `.cursor/rules/`, `.cursorrules`, `.windsurfrules`, `.github/agents/`; or a guardrail declaration in a versioned settings file (a permission allow/deny list) |
| `loops` | a versioned executable script, anywhere, satisfying **both** conditions below |

`loops`, both conditions on the script's own content:

1. it invokes one of `claude`, `codex`, `gemini`, `aider`, `cursor-agent` — a closed list, matched
   in command position; extending it is an edit to this file, not a runtime decision;
2. that invocation sits inside a loop whose continuation depends on the exit status of a separate
   command.

Matching is **by exact name, never by pattern**. A named file matches anywhere in the tracked tree
(perceval's transcript sits under `code/`); a named directory matches at the root.

Where both a bundle's `context_files` counts and its `repo-context/` tree exist and disagree, the
tree decides: it is the fact, the counts are a recording of it.

## intervention

| Median `m` of corrective commits after open | Value |
| --- | --- |
| `m >= 2.5` | `after-the-fact-most` |
| `m >= 1.5` and `m < 2.5` | `after-the-fact-some` |
| `m < 1.5` | `key-steps` |

Promoted to `never-once-framed` when the share of changes with no corrective commit at all is
≥ 0.9. `not-applicable` when the window was read and holds zero changes — bundle-only.
`never-framing-included` is never observable: nothing records who chose the task.

## parallelism

Median, over active days, of the number of distinct branches receiving a commit that day. The
**median**, not `max_concurrent_branches`: the grid says "un pic isolé ne compte pas". Active days
only, so an intermittent contributor is not measured as mostly zero.

## Admissible for nothing

| Source | Why |
| --- | --- |
| `sonar-measures.json` | Code quality is the prerequisite, not an axis (`levels/aidd.md`, Hors périmètre) |
| `sessions_per_week`, `tokens_per_week` | Usage volume, explicitly out of scope |
| `role`, `experience_years`, `team_size` | Seniority, explicitly out of scope |
| `code/` as a source of measurement | A snapshot has no time dimension. Not a rule about where to look: an artifact proving `prompts` counts wherever it sits |
| `pull-requests.json` | A fraction of the window, so a worse measurement of a habitual quantity than the aggregate beside it |
| A transcript's content beyond `prompts` | One session cannot establish a habit |
| `declaratif.md` | Prose, never parsed |
| `.worktreeinclude` | A capability, not a count |
| `context_files.last_updated` | Testing "maintenue" needs a freshness cutoff the grid does not size |

**Sources in scope:** local filesystem, harness artifacts on it, local Git. A fixture bundle is a
recorded stand-in for those same facts, admissible under the same rules.
**Out, explicitly:** any network call, any forge API, Sonar or hosted telemetry, and any evidence
produced or interpreted by a language model.

## Traps

Each of these was got wrong at least once while writing the tables above, and each was invisible to
the worked profiles.

**A `Co-Authored-By:` trailer is attribution, not authorship.** The commit's author is still the
person (`vcs.md`). Reading a trailer-carrying commit as unattended inverts `intervention`: on a
repository that attributes AI help scrupulously, every commit reads as unattended, the zero-touch
share hits 1.0, and the subject is awarded the autonomy value reserved for work no human touched.
The more disciplined the attribution, the higher the score.

**An out-of-date scan set manufactures a practice gap.** A capability whose artifact sits off the
table is omitted from the set; the set is still published `CONFIRMED`; `scale-comparison.ts` finds
the member missing; `requirement-outcome.ts` returns **`NOT_MET`**, a practice gap, not `UNPROVEN`.
AIDD would tell a developer who has rules, agents and hooks to go adopt rules, agents and hooks —
what `project-brief.md` forbids outright. This is structural: a set-valued axis has no way to say
"I could not observe this member". Keeping the table current is the condition under which this axis
tells the truth.

**A set has no per-member "unknown", so `loops` uncertainty costs the whole axis.** A collector
that finds a script satisfying condition 1 and cannot decide condition 2 emits **no `harness`
observation at all** — `UNKNOWN`, an evidence gap. It must not quietly drop `loops` from the set,
which would publish a practice gap it did not observe. Only shell is reliably recognisable, so the
population most likely to have built a loop is the most likely to be unclassifiable.

**Absence read is not absence of reading.** A source read and found empty is an observation; a
source that could not be read is none. That distinction is the whole of "no absence of evidence is
negative evidence". `white`'s `includes: []` is satisfied by *every* harness set, empty or not —
`[].every(...)` is true — so it never demands an empty one.

**Prose is never parsed, and a document about a practice is not the practice.** Arthur's
`docs/brainstorm/2026-06-auto-retry.md` describes a retry loop and says he has not built it.
Following a pointer out of an instruction file to a directory it names is also prose parsing.

**Globs over-report on the capability that gates Red.** `prompt-*.md` would let
`prompt-toolkit-notes.md` prove `prompts`, and `session-store.md` would prove it on any web project.

**Shallow and unborn repositories look ordinary.** `git rev-parse --is-shallow-repository` true
means the visible history is a truncation: the most recent commit is still the most recent, so the
window looks satisfied and a deep enough truncation clears the minimum sample, yielding a
confidently wrong median published as `CONFIRMED`. Emit nothing on any Git-derived axis. `HEAD` on
a repository with no commit is unborn and `git log` exits `fatal` — unreadable, `proven: null`,
emphatically not White.

**Under-measuring is worse than not measuring.** Every axis here is a minimum threshold, so a
fallback that guesses low publishes `CONFIRMED` too low, which becomes `NOT_MET`, which is a
practice gap. Emitting nothing produces `UNPROVEN`, an evidence gap, which is what the situation
is. This is why `size` has no per-commit fallback on a history without merges, and why squash
detection by subject suffix or commit clustering is forbidden: both are inferences about a
workflow, not observations of it.

## The four profiles, derived

No rule above names a profile, and no cell needed an exception.

| Profile | size | harness | intervention | parallelism | Level | Next level blocked by |
| --- | --- | --- | --- | --- | --- | --- |
| perceval | S | {prompts} | after-the-fact-most | 1 | Red | size, harness, intervention |
| bohort | M | {prompts, context-engineering} | after-the-fact-some | 1 | Blue | size, harness, intervention |
| leodagan | L | {prompts, context-engineering, behavior} | key-steps | 1 | Green | parallelism |
| arthur | XL | {prompts, context-engineering, behavior} | key-steps | 4 | Copper | harness (loops), intervention |

`intervention` blocks Blue and Green because the scale ascends in autonomy: `after-the-fact-most`
is *below* `after-the-fact-some`. Leodagan proves `prompts` from his co-authored commits, not from
the `session.md` he lacks — that is the trap `testing.md` says the harness axis has to survive.

**This table is a derivation, not a validation.** It cannot show a rule being wrong. No fixture has
a half-integer median, none disagrees between its lines and files bucket, none disagrees between
`context_files` and its tree, none supplies an active-day count, and none is a live repository.
Every trap listed above passed it.
