---
objective: "A repository is reported twice, as the level it sustains and as the level it has demonstrably reached, both from forge evidence, so that opportunity is never mistaken for capability."
status: implemented
---

# Plan: Two readings of maturity, and the forge collector that makes them observable

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | Report a sustained level and a demonstrated level per subject, sourced from the forge, and stop publishing values the local graph cannot support. |
| **Source** | Session decisions of 2026-08-29, grounded in measurements taken against the GitHub API for `mc-tracker-fr/McTracker`. Recorded in `measurements.md` beside this plan. |

## Phases

| #   | Phase        | File                         |
| --- | ------------ | ---------------------------- |
| 1   | Silence the local artefact | [`phase-1.md`](./phase-1.md) |
| 2   | Forge collector, one reading | [`phase-2.md`](./phase-2.md) |
| 3   | Fix N on control repositories | [`phase-3.md`](./phase-3.md) |
| 4   | Two readings end to end | [`phase-4.md`](./phase-4.md) |
| 5   | Renderers and their guard rails | [`phase-5.md`](./phase-5.md) |
| 6   | Bundle format and the four fixtures | [`phase-6.md`](./phase-6.md) |

## Resources

| Source | Verified          |
| ------ | ----------------- |
| `gh` 2.96.0, authenticated on `BlandineRdl`, scopes include `repo` | The forge is reachable without adding a dependency or a token to the project. |
| GitHub GraphQL `repository.pullRequests` | One query returns `createdAt`, `mergedAt`, `additions`, `deletions`, `changedFiles` and each commit's `authoredDate` / `committedDate`. Three pages of 50 cover the whole window. |
| GitHub GraphQL `pullRequest.reviews` | Zero reviews on the thirty most recent merged PRs of the subject. Measuring corrections from a review timestamp is not available on this repository shape. |
| GitHub GraphQL `pullRequest.closingIssuesReferences` | Empty on every sampled PR, the four largest included. Grouping PRs into features by the issue they close is not constructible here. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| A reading is a tag on an observation, not a second value on it. | `resolveEvidence` compares observations sharing an axis and calls a disagreement `CONFLICTING`. Two readings emitted as two values of one axis would resolve to `CONFLICTING` and destroy both. Tagging keeps the comparison inside a reading, where it belongs. |
| `checkMaturity` runs twice and is not modified. | It already takes a model and an observation array and returns a level. Two readings are two arrays. Touching the frozen decision engine to express a reporting change would put a reporting concern inside the domain. |
| An axis carrying one reading falls back to it for the second. | Harness is a set and intervention is single-valued. Without the fallback the demonstrated run would find them `UNKNOWN` and report no level at all, which would make the second reading useless on every subject. |
| Intervention stays single-valued. | The forge sees "no commit after the PR was opened", which on a subject with no review and minute-long merges records when the PR was opened, not whether a human took over from the agent. Promoting that to `never-once-framed` would assert autonomy from a workflow habit. |
| The sustained level stays the primary figure, and the demonstrated level never prints without its frequency. | Two headline numbers invite quoting the higher one. A demonstrated level is meaningless without the share of occasions that earned it, so the two are one sentence, never two. |
| Silencing the local artefact precedes the forge collector. | The live collector currently emits a size and a parallelism the merge graph does not support. Adding a second collector that emits the true values would make both axes `CONFLICTING`, taking the subject from three axes confirmed to one. |
| Network at runtime is accepted, and offline stops being guaranteed. | Three of four axes are unobservable or artefact-prone on a squash-merged history. The offline path keeps working because the forge collector stays silent without credentials, but it is no longer a promise the project makes. |
