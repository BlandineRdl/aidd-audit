---
objective: "A repository hosted on a forge reports one row per account active in the window — what each offers to measure, the level their own sample proves, and what they authored of the harness — so that a shared repository stops publishing one level that describes nobody."
status: planned
---

# Plan: A level per contributor, and the roster that carries it

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | Add a contributor roster to a subject with a GitHub origin: one row per account active in the window, with its own sample, its own sustained and demonstrated levels where the sample supports them, and its authorship of the harness files. The repository-level answer is unchanged. |
| **Source** | `aidd_docs/tasks/2026_08/2026_08_30_per-person-attribution-brief.md`, and the session of 2026-08-30 that settled the forks it left open. Measurements taken the same day against `mc-tracker-fr/McTracker` are in `measurements.md` beside this plan. The nine phases were drafted in parallel and contradicted each other in thirteen places; `resolutions.md` settles each one and stands over any phase that disagrees with it. |
| **Size**   | Nine phases. `project-brief.md` names tech leads and organisations as a later audience, and this is that audience's feature — it is a roadmap item delivered early, not a fix. |

## Phases

| #   | Phase        | File                         |
| --- | ------------ | ---------------------------- |
| 1   | The delivery walk learns who | [`phase-1.md`](./phase-1.md) |
| 2   | The contributor walk, and the identity dictionary | [`phase-2.md`](./phase-2.md) |
| 3   | One person's deliveries, both readings | [`phase-3.md`](./phase-3.md) |
| 4   | The harness scan reports what proved it | [`phase-4.md`](./phase-4.md) |
| 5   | Who authored the harness | [`phase-5.md`](./phase-5.md) |
| 6   | The roster port and its adapter | [`phase-6.md`](./phase-6.md) |
| 7   | A level per contributor, in the contract | [`phase-7.md`](./phase-7.md) |
| 8   | Both renderings, and the section that stays | [`phase-8.md`](./phase-8.md) |
| 9   | Memory, sentinels, and the gate | [`phase-9.md`](./phase-9.md) |

## Resources

| Source | Verified          |
| ------ | ----------------- |
| `gh` 2.96.0, authenticated on `BlandineRdl` | Already the project's forge access. No dependency and no token is added. |
| GitHub GraphQL `repository.defaultBranchRef.target ... on Commit { history }` | Accepts `since` and `after`, and returns `author { name email user { login } }` per commit. 783 commits of the subject walked in eight pages of 100. |
| The identity collapse | Four git identities — `Black Sun` and `BlackSun`, each under two emails — all resolve to the one login `BlandineRdl`. A join on email alone would have published the same person as two rows; GitHub performs the mapping and the tool never guesses it. |
| Bot accounts on a commit | `renovate[bot]`, `github-actions[bot]`, `dependabot[bot]` appear as ordinary logins. `GitActor.user` is typed `User`, so the `__typename === 'Bot'` route the pull-request walk uses is unavailable here; the login suffix is. |
| The window against the subject's second contributor | `Ayaerna`, 38 commits, 2025-04-23 to 2025-05-02 — sixteen months outside a 180-day window ending at the subject's last commit. `mc-tracker` therefore has **one** human row today, and is not the multi-contributor demonstration this feature needs. Darkwaters, or any repository with two active pull-request authors, is. |
| `repository.pullRequests` | Already walked by `pull-request-history.ts`, and already selects `author { __typename }`. Adding `login` beside it is one line and changes no filtering. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| The roster is a second port, never a second collector. | `EvidenceCollector` is frozen in `architecture.md` and emits observations that `resolveEvidence` compares by axis. N contributors emitting `size` would be N values of one axis, which resolves to `CONFLICTING` and destroys the axis for everyone — trap two of the brief, reached by construction. A roster answers a different question and gets its own port. |
| The contributor walk enumerates people; it answers no axis. | This is what keeps "one axis, one source" intact while adding a second forge query. Nothing it returns reaches `resolveEvidence`, and no collector learns of it. |
| A person is a forge account, and a git identity is never the key. | Measured on the subject: `Black Sun` and `BlackSun`, under two emails, are one person, and the strings do not match the login `BlandineRdl` that carries their pull requests. Keying on the commit's identity publishes one person as up to four rows and joins to nothing. |
| A commit whose email GitHub maps to no account is attributed to nobody, in a row of its own. | Merging it into a named account would be a guess, and dropping it would silently shrink a count the roster publishes. The row states what it is: commits nothing observable can attribute. |
| Bots are excluded by the `[bot]` login suffix, and this is a convention rather than a typed fact. | `__typename` distinguishes them on a pull request and is unavailable on a commit's author. GitHub reserves the suffix for app accounts, so the exclusion is sound in practice — but it is a string rule, it is written down as one, and a human account ending in `[bot]` would be wrongly dropped. Consistent with the pull-request walk, which already excludes bot-opened deliveries from every axis. |
| A contributor with no activity in the window gets no row. | Every floor, median and share in this codebase is taken over the same 180 days; a roster on a different span would put two periods in one document. The section header names the span — "active in the last 180 days" — so an absence is explained by the scope rather than read as a verdict. The cost is real: a former contributor disappears, and `Ayaerna` is exactly that case on the subject this was measured against. |
| Splitting by person shrinks every sample, and the floors are not lowered for it. | `MINIMUM_DELIVERED_CHANGES` is 5 and `MINIMUM_DEMONSTRATED_SAMPLE` is 10, per person now rather than per repository. A team of four sharing thirty deliveries will have members below both, and their rows will carry an evidence gap where the repository-level reading carried a level. That is the conservative rule working, not a regression. **Not to be lowered so that a given contributor classifies** — the argument for the values is in `delivery-sample.ts` and none of it changes because the sample is now one person's. |
| The harness axis stays the repository's, and every row carries the same value on it. | The referential says the harness is what the person set up, but what is observable is that the files exist in the tree and are available to everyone. Attributing them by authorship would score a developer who joins tomorrow and relies on them daily at White. Attributing them by use is not observable at all and is rejected outright rather than left open. The consequence is stated in the output instead of hidden: two contributors of one repository share one axis of the four their level is made of. |
| Harness authorship is published as a fact, never as an axis. | Who wrote the files that prove `prompts`, `context-engineering`, `behavior` and `loops` is observable and worth reading. It is not a level, it decides nothing, and no recommendation is derived from it — "has never touched the harness" does not prove a problem, and `project-brief.md` forbids recommending a practice change from a failure to prove one. |
| Harness authorship is read from local Git, joined through the forge's dictionary. | The forge can answer `history(path:)` but only one path at a time, and the harness set is dozens of files. One local `git log` over those paths returns commit, email and file in a single process, offline and free; the dictionary built in phase 2 turns each email into the account the row is keyed on. |
| `scanHarness` gains the paths that proved each member. | It reports capabilities today, and authorship needs to know which files earned them. The addition is a third field on `HarnessScan`, beside `capabilities` and `undecidable`; the existing two are untouched, so nothing that reads capabilities changes. |
| The repository-level `proven` is unchanged, and named for what it is. | Question three of the brief: the four reference profiles and `mc-tracker` must report exactly what they report today, or this is not a refinement. The roster is additive beside it, and prose says the repository line covers all deliveries whoever made them — otherwise a reader meets two answers and no rule for choosing. |
| The contract grows one nullable block and `schemaVersion` stays 1. | The same reasoning `demonstrated` already shipped under: a consumer reading `proven` alone sees exactly what it saw before the field existed. The block is versioned and additive forever, so its shape is settled here rather than discovered in a renderer. |
| The composition root wires the roster, and one walk means one walk. | The adapter was specified with a slug alone and then needed three things construction could not reach: the harness scan, the proving paths under it, and the delivered-changes sample the forge collector had already walked. `cli/` builds both collectors already, so it builds a delivery reader memoised on its walk and shared with the forge collector, and a `HarnessTree` the roster scans for itself. Without the shared reader, phase 1's split is decorative and a GitHub subject is walked three times. The cost is that the tree is scanned twice per assessment; a local walk is the cheaper half of that trade, and handing one scan to both would move a collector's constructor no other phase touches. |
| A read that failed is `FAILED`, never an empty roster. | Both walks answer `null` rather than throwing — five refusals do, from an unparseable page to a page cap reached with more offered. Classified only on thrown errors, every one of them would assemble zero records and publish `COMPLETED`, which renders as "no account was active in the last 180 days". A failed read would have stated something about people, which is the product's central failure mode reached by omission. `COMPLETED` with no records means the walks succeeded and the window held nobody, and only that sentence may say so. |
| The roster carries its own status; `provenance` stays about collectors. | `ProvenanceEntry` names a `collector` and lists the axes it attempted. The roster is not one and answers no axis, so filing it there would make the word mean two things. Its failure is a status on its own block, with the reason. |
| The section exists whenever the subject has a GitHub origin, decided offline. | `git remote get-url` is local, so the shape of the document depends on the subject and never on whether the network answered. When the forge refuses, the section is present and empty with the reason named — the alternative, falling back to the repository-only rendering, would make the same subject produce two different documents depending on credentials, and `cli.md` promises the same bytes on any machine. |
| Rows are ordered by deliveries descending, then by login. | Determinism reaches the output. A roster in the order the forge happened to page is not reproducible. |
| A row publishes what it observed and the level it aims at, added after the phases. | A row whose `proven` was null published its blockers and nothing it had measured — on a real subject, an account with seven deliveries had established its size and its intervention and showed neither. `observed` carries one entry per declared axis with the status it resolved to; `next` carries that row's own next level, whose requirements pair each threshold with what *this* account observed rather than what the repository did. Both are additive, and `schemaVersion` does not move. |
| The plugin's bundled binary is a second published surface. | `plugins/aidd-evaluation/bin/cli.js` is produced by `pnpm build:standalone` and committed, and the plugin runs it rather than the checkout. Nothing in `pnpm check` proves it matches `src/`, so a contract change that does not rebuild it ships an older shape to every plugin user. Rebuilt here, and recorded in `coding-assertions.md` so the next contract change does not have to rediscover it. |
| `--author` is not built. | It was the natural answer while the roster was one person at a time. The table states every row, so a flag selecting one adds a surface with nothing behind it. |
| A row prints its counts, and its demonstrated reading only above its own proven level. | The count is what separates "nothing to measure" from "measured and low", and it is the whole reason a reader can tell those apart — prose prints active days where the sample supported a reading and the commit count where it did not, while `--json` carries all three on every row. The demonstrated reading follows the repository's own rule rather than a looser one: never without the share that earned it, and never at all under a row that proved no level, because a ceiling with no floor states nothing that can be read safely. |

## Out of scope

| Left out | Why |
| -------- | --- |
| A roster on a subject with no GitHub origin. | Without a forge there is no account, no delivery and no dictionary. The four reference profiles and any local-only repository keep their prose byte for byte. Their `--json` gains exactly one additive key, `contributors: null`, on the same footing `demonstrated` already shipped under, and `schemaVersion` does not move. |
| Lowering any sample floor. | Named here so that a member falling below one is never treated as a reason to move it. |
| A per-person harness level. | Decided against above, not deferred. |
| Recommending anything from a row. | The tool publishes facts and levels; reading a thin row as a performance problem is a human act on a human's own team. |
