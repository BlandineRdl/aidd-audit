# Plan — Observable evidence per AIDD axis

## Contract

Define, as a product specification, what repository evidence is allowed to support each of the
four AIDD maturity axes, so that every future collector reads the same rules instead of
inventing its own interpretation.

**No production collector is implemented in this worktree.** No file under `src/` changes.

### Acceptance criteria (from the request, verbatim in intent)

1. `size`, `harness`, `intervention`, `parallelism` each have an explicit observable-evidence definition.
2. For each axis the specification names: what can be directly observed; what can only be declared;
   what normalised value is produced; what results in no observation.
3. No absence of evidence is defined as negative evidence.
4. Repository facts are distinguished from developer/documentation claims.
5. Every emitted value belongs to the axis vocabulary defined by the maturity model.
6. MVP evidence sources are named: local filesystem, harness artifacts, local Git.
7. Network / API / LLM-derived evidence is explicitly out of MVP scope.
8. The four reference profiles are explained against the specification with no profile-specific rule.

## Deliverable

`aidd_docs/memory/evidence.md` — a root project-memory file, loaded every session.

It sits beside `architecture.md` and `testing.md` for the same reason those do: it is a frozen,
non-derivable contract that more than one worktree binds to, and a divergence would only surface
at composition time. `memory/internal/` is for AIDD workflow traces, not for a product contract,
so it is the wrong home.

Two pointer edits follow from that placement, and nothing else:

- `CLAUDE.md` — add `@aidd_docs/memory/evidence.md` to the project memory block.
- `aidd_docs/memory/README.md` — add the line inside the `<!-- files:start -->` markers.

## The rules the specification must state

These were derived from `levels/aidd.md`, `aidd.yml`, `src/evidence/`, and all four fixtures.
They are the substance of the deliverable, not a summary of it.

### Cross-cutting

- **Observation window.** Every axis is a *habitual* measure. The window is the 180 days ending at
  the most recent commit date in the subject, never at wall-clock now — otherwise the same
  repository yields a different level tomorrow and the determinism invariant breaks.
- **Minimum sample.** Below 5 delivered changes in the window (`size`, `intervention`), or 5 active
  days (`parallelism`), a median is a sample and not a habit: emit no observation.
- **One OBSERVED observation per axis per collector.** For the set-valued `harness` axis that single
  observation carries the union of every capability the collector saw. Two OBSERVED observations
  disagreeing on one axis resolve to `CONFLICTING`, which costs the whole assessment; a collector
  must never race itself.
- **`CONFLICTING` is unreachable in MVP** — one collector serves a subject. It exists for post-MVP
  sources, and the resolution rule already handles it.
- **DECLARED observations may accompany the OBSERVED one.** `resolveEvidence` compares OBSERVED
  values only, so a claim never contradicts a fact into `UNPROVEN`.
- **Absence read is not absence of reading.** A source that was read and contained zero is an
  observation. A source that could not be read is no observation at all — `UNKNOWN`. This line is
  the whole of criterion 3 and must be stated once, precisely, and applied per axis.
- **A document about a practice is not the practice.** `docs/brainstorm/2026-06-auto-retry.md` in
  arthur's bundle describes a retry loop and says he has not built one. Prose is a claim.
- **Vocabulary.** A collector maps to a value present in `context.vocabulary` for that axis; if the
  loaded model's scale does not carry it, it emits nothing for that axis. `assessment` rejects an
  off-scale value as a backstop (`evidence/models/axis.model.ts`).
- **Prose is never parsed in MVP.** Interpreting free text requires a language model, and an LLM may
  narrate a result, never decide one. `declaratif.md` therefore yields no observation.

### size → what proves it

- Observed: the diffstat of each change delivered in the window (live Git: merged changes;
  fixture: `git-activity.json.pull_requests`).
- Normalised: the median delivered change, bucketed on two proxies, **taking the lower bucket** —
  conservative, and a 2000-line change in one file is not "multi-modules".
  - lines changed (additions + deletions): `<100 → S`, `100–399 → M`, `400–999 → L`, `>=1000 → XL`
  - files changed: `<5 → S`, `5–9 → M`, `10–24 → L`, `>=25 → XL`
- `none` when the window was read and holds zero delivered changes.
- No observation: history unreadable, or fewer than 5 delivered changes.
- Only declared: any prose about "the biggest feature I ever shipped".
- **Named limit.** Size is measured over all delivered changes, not only AI-attributed ones. The
  fixture aggregate cannot express per-change attribution, and a rule the two collectors compute
  differently breaks their interchangeability. AI involvement is carried by `harness` and
  `intervention`, and no level is reached on one axis alone.

### harness → what proves it

Set membership, union of what is present. Brand-agnostic: what counts is what is in place, never
the vendor.

- `prompts` — at least one delivered commit in the window carries an AI attribution trailer
  (live: `Co-Authored-By:` naming an assistant; fixture: `commits.ai_coauthored_ratio > 0`), **or** a
  versioned prompt/session transcript is present. Sufficient, not necessary, either way: a capability,
  not a habit, so one demonstration proves it. This is what keeps leodagan reachable at Green with
  no `session.md`.
- `context-engineering` — a versioned agent-instruction file at the root, or a versioned memory /
  architecture / convention document set it points at.
- `behavior` — versioned rules, agents, hooks, or skills. Any one of them, since arthur carries
  behavior on skills and agents with zero rules and zero hooks.
- `loops` — a versioned script that re-invokes an AI CLI while a project command keeps failing.
  Both conditions, on the script's content. Nothing in the four bundles satisfies it.
- No observation: the filesystem could not be listed, or the commit history could not be read.
- An empty set is an observation, and `white` requires `includes: []` — so an empty set is not a
  failure to observe.

### intervention → what proves it

- Observed, per delivered change: the count of human-authored commits after the change was opened,
  and whether that count is zero. This is `levels/aidd.md`'s own observation column, read literally.
- Normalised from the median `m` of that count over the window:
  - `m >= 3 → after-the-fact-most` ("beaucoup de commits correctifs")
  - `m == 2 → after-the-fact-some` ("quelques commits correctifs")
  - `m <= 1 → key-steps` ("presque aucun commit correctif")
  - promoted to `never-once-framed` when the share of delivered changes with zero human-authored
    commits after open is `>= 0.9` ("sans aucun commit d'un humain")
- `not-applicable` when the window was read and holds zero delivered changes.
- `never-framing-included` is **not observable from a local repository**. Gold is therefore
  unreachable in MVP. Name the ceiling and what would lift it, rather than approximating it.
- No observation: history unreadable, or fewer than 5 delivered changes.

### parallelism → what proves it

- Observed: for each active day in the window, the number of distinct branches receiving at least one
  commit that day (fixture: `git-activity.json.parallelism.median_concurrent_branches`).
- Normalised: the **median over active days**. The median, because "un pic isolé ne compte pas" —
  `max_concurrent_branches` is exactly the isolated peak the grid excludes. Active days only, so an
  intermittent contributor is not measured as zero.
- No observation: history unreadable, or fewer than 5 active days.
- A worktree-enabling artifact (`.worktreeinclude`) is a capability, not a count. It proves nothing
  about this numeric axis.

### What is admissible for nothing

Each of these must be named, with its reason, so no future collector reaches for it:

- `sonar-measures.json` — code quality is the prerequisite, not an axis (`levels/aidd.md`, hors périmètre).
- `assistant_usage.sessions_per_week` / `tokens_per_week` — usage volume, explicitly out of scope.
- `profile.json.role` / `experience_years` / `team_size` — seniority, explicitly out of scope.
- `code/` — a snapshot with no time dimension; every axis is a measure over a window.
- `pull-requests.json` — the last page of PRs, a fraction of the window. A partial sample must never
  compete with a window-complete aggregate on a habitual measure; letting it emit is how an axis
  resolves `CONFLICTING` and the assessment loses its level.
- `session.md` beyond `prompts` — one session cannot establish a habit.
- `declaratif.md` — prose, and prose is never parsed in MVP.

### Sources

In: the local filesystem, harness artifacts on it, and local Git. The fixture bundle is a recorded
stand-in for those same facts, which is why it is admissible.

Out of MVP, explicitly: any network call, GitHub/GitLab or any forge API, Sonar or hosted telemetry,
and any evidence produced or interpreted by a language model.

## Worked profile table (must be verified against the fixtures, not copied from here)

| Profile | size | harness | intervention | parallelism | Level | Blocked at the next level by |
| --- | --- | --- | --- | --- | --- | --- |
| perceval | S | {prompts} | after-the-fact-most | 1 | Red | harness, size |
| bohort | M | {prompts, context-engineering} | after-the-fact-some | 1 | Blue | harness, size |
| leodagan | L | {prompts, context-engineering, behavior} | key-steps | 1 | Green | parallelism |
| arthur | XL | {prompts, context-engineering, behavior} | key-steps | 4 | Copper | harness (loops), intervention |

Every cell above must fall out of the general rules. If a cell needs a profile-specific exception,
the rule is wrong, not the profile.

## Validation

- `pnpm check` stays green (nothing under `src/` moves, so this only proves nothing was broken).
- Each of the eight acceptance criteria is traceable to a named section of the deliverable.
- Each of the sixteen profile cells is recomputed from the fixture files and matches.
