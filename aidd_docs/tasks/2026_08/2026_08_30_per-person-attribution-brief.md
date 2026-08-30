# Brief: attributing a maturity level to a person rather than to a repository

A planning brief, not a plan. It states a problem, the facts already measured, the decisions that
must be settled before any code, and the traps. Written 2026-08-30 for a session with no other
context. **Turn it into a plan; do not start by implementing.**

---

## 1. The project

`~/Dev/aidd-audit` — a CLI that inspects a repository and reports the highest AIDD maturity level it
can *prove*, deterministically, offline where possible. `assess <path>` renders prose, `--json`
renders a frozen contract.

The maturity model is `aidd.yml` (runtime) transcribed from `levels/aidd.md` (human documentation,
never loaded). Seven cumulative levels — White, Red, Blue, Green, Copper, Silver, Gold — over four
axes: Taille, Harness, Intervention, En parallèle. A level is reached only when every axis is.

Read `aidd_docs/memory/` first: `project-brief.md`, `architecture.md`, `cli.md`, `testing.md`,
`codebase-map.md`, `coding-assertions.md`. They are loaded into context automatically and they are
accurate as of 2026-08-30.

## 2. What already exists, so none of it is re-derived

Three collectors behind one port, chosen at the composition root in `cli/commands/assess.command.ts`:

- `live-repository` — a local work tree. Harness from the tracked tree; size and parallelism from the
  first-parent walk, **withheld when merges are under a quarter of what landed** (a squash history
  cannot support them).
- `forge-repository` — the GitHub API through `gh`. Size, intervention, parallelism from merged pull
  requests. **Deliveries opened by a bot are excluded** (`author.__typename === 'Bot'`).
- `fixture-bundle` — a recorded `git-activity.json`, used by the four acceptance profiles.

**One axis, one source.** When the subject is a work-tree root with a GitHub origin, the forge owns
size, intervention and parallelism, and the live collector is built for the harness alone. Two
collectors answering one axis would resolve to `CONFLICTING` and destroy both.

**Every axis carries two readings**, tagged on the observation: `SUSTAINED` (the median, what the
subject habitually does) and `DEMONSTRATED` (the highest value reached on at least a third of
occasions, with a floor of ten). `checkMaturity` runs twice, unmodified. The contract has a
`demonstrated` block beside `proven`; prose prints the sustained level first and never prints a
demonstrated value without the share that earned it.

## 3. The problem

`levels/aidd.md` opens with:

> Sept niveaux d'adoption de l'IA dans le workflow d'**un développeur**.

It measures **a person**. Every collector measures **a repository**. Nothing reconciles the two, so a
repository where several people work reports one level that blends their practices, with nothing
saying so.

## 4. The crux, which is the harness axis

Three axes filter by author trivially — the forge query already returns `author`, and the bot
exclusion does exactly this. Size, intervention and parallelism are per-delivery, and a delivery has
an author.

**Harness does not.** And the referential is more specific than it first looks:

> **Harness** | Ce que **la personne a mis en place** autour du modèle.

So the harness is already per-person *in the text*, while the collector reads it as a property of the
repository: `.claude/rules/` either exists in the tracked tree or it does not. Attributing it to a
person would mean attributing it by **who committed those files**, and that has a hard consequence:

> A developer who joins the repository tomorrow, relies on its harness every day, and has committed
> nothing to it scores **nothing** on that axis, therefore White.

Defensible by the text — they set nothing up. False to the lived reality — they benefit from it
daily. **Nobody has decided this, and it is the first thing the plan must settle.**

## 5. Facts already measured, so nothing is re-measured

Against `mc-tracker-fr/McTracker` (locally `~/Dev/work/mc-tracker`), window 2026-02-28 to 2026-08-27:

```
commits, whole history        784   BlackSun 712 (two identities) · Ayaerna 38 · bots 34
merged PRs in the window      108   BlandineRdl 87 · renovate 20 · dependabot 1
Ayaerna's pull requests         0   every one of their 38 commits landed without a PR
```

**On this subject a per-person reading changes nothing**, because the forge sample is already one
person's. That is luck, not design. The problem bites on a repository where several people open pull
requests, which is the "tech leads and organisations" audience `project-brief.md` names as a later
one. **This is a roadmap item, not an urgent fix**, and the plan should say so rather than imply
otherwise.

Fuller measurements, including everything behind the current levels, are in
`aidd_docs/tasks/2026_08/2026_08_29_dual-reading-and-forge-collector/measurements.md`.

## 6. What the plan must settle before writing code

In this order. The first has no obvious answer; the others have several plausible ones.

1. **Is the harness attributed by authorship of its files, or shared by the whole repository?**
   Authorship follows the referential's own words and makes a newcomer White. Sharing keeps the
   current behaviour and quietly makes one axis of four not per-person. A third option — attributing
   it to anyone who has *used* it — is not observable and should be rejected explicitly rather than
   left hanging.
2. **How is the person named, and what does a repository-level assessment become?** `assess <path>`
   takes a path today and `proven` answers "this repository". If levels are per-person, does the
   command take a `--author`, read the local git identity, or report a level per contributor? Each
   changes the CLI surface and the public contract. Note that the contract is versioned and
   additive-only.
3. **What guarantees a single-contributor repository does not change its answer?** The four
   acceptance profiles and mc-tracker must report exactly what they report today, or the change is
   not a refinement.

## 7. Constraints that will bite

- **Never commit, push, or open a pull request.** `aidd_docs/memory/vcs.md` forbids it without an
  explicit human word in the session, and names the SDLC orchestrator specifically as not overriding
  it. Leave the tree dirty and report.
- **`pnpm check` is the gate**: typecheck, tests, dependency-cruiser plus the proof its rules bite,
  and the comment-tag check. It must be green and it must stay offline — the CLI test fixture puts a
  refusing `gh` on the child's PATH so the suite never reaches the network.
- **Comments**: no `/** */`, and any block of two or more `//` lines opens with `INVARIANT:`,
  `SAFETY:`, `COMPAT:` or `LIMITATION:`. Mechanically enforced.
- **Any chosen constant is documented as chosen, not measured**, with the cost of each direction and
  an explicit "not to be lowered so that a given repository classifies". Follow the existing floors in
  `src/evidence/adapters/delivery-sample.ts` for the tone and the level of detail expected.
- **Determinism**: the same subject and model must produce the same bytes on any machine, any day.
- **The conservative rule**: a practice gap (`NOT_MET`, observable evidence proves the practice falls
  short) and an evidence gap (`UNPROVEN`, it could not be established) must stay visibly distinct.
  Never infer a level from missing information; withholding is always safer than inventing.

## 8. Traps, each of which has already been hit once on this codebase

- **Do not settle question 2 by "taking the most active author".** That is a choice dressed as a
  measurement.
- **Do not emit two values for one axis.** `resolveEvidence` calls a disagreement `CONFLICTING` and
  both are lost. Readings are tagged; anything new needs its own dimension or its own source.
- **Do not add a collector beside an existing one for the same axis.** Choose the set at the
  composition root, as `assess.command.ts` already does for the forge.
- **Do not fit a threshold to a repository's hoped-for result**, and if a decision is under that
  pressure, write that it is rather than hide it.
- **Do not trust prose in commit messages.** Nineteen of mc-tracker's commits mention "claude" and
  exactly one attributes an agent on a trailer. Prose is never parsed.
- **Verify a claimed rule bites.** A dependency-cruiser rule matching nothing reports success;
  `scripts/prove-boundary-rules.mjs` exists for that, and a new rule needs its own sentinel.
- **Neuter a new guard and watch its test go red** before believing it. This repository shipped a
  model-loader guard three times with a green suite that asserted something weaker.
