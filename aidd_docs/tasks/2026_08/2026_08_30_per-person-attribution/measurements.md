# Measurements, 2026-08-30

Taken against `mc-tracker-fr/McTracker` through `gh api graphql`, to settle the forks the brief left
open. Everything here is a reading of the forge, reproducible against a fixed forge state and not
beyond it.

## The commit history carries the account, and it collapses identities

`repository.defaultBranchRef.target ... on Commit { history(first:, since:, after:) }` returns, per
commit, `author { name email user { login } }`. Eight pages of 100 covered the subject's 783 commits.

Whole history, tallied by resolved account:

```
 711  BlandineRdl          2025-12-09 -> 2026-08-27
  38  Ayaerna              2025-04-23 -> 2025-05-02
  20  renovate[bot]        2026-04-15 -> 2026-08-09
  13  github-actions[bot]  2026-03-04 -> 2026-04-12
   1  dependabot[bot]      2026-04-16 -> 2026-04-16
```

The 711 are **four** git identities: `Black Sun` and `BlackSun`, each under
`18490995+BlandineRdl@users.noreply.github.com` and under `brondel@protonmail.com`. All four resolve
to one login. Neither name matches the login string, so no local heuristic recovers this — the
mapping is GitHub's, and it is the reason the roster is keyed on the account.

## The window holds one human

Windowed at 180 days ending at the subject's last commit — 2026-02-28 to 2026-08-27 — 237 commits:

```
 190  BlandineRdl        (106 as `Black Sun`, 84 as `BlackSun`, both emails)
  20  renovate[bot]
  13  github-actions[bot]
   1  dependabot[bot]
```

`Ayaerna` is absent: their activity ended sixteen months before the window opens. **`mc-tracker` is
therefore not a demonstration of this feature.** It has one human row, and its repository-level
answer and its single roster row will state the same thing. A repository with two contributors
opening pull requests inside one window is what exercises the feature end to end, and the brief's
own figure of "Ayaerna 38 commits" was taken over the whole history rather than the window.

## Bots are recognised by their login, not by their type

Every bot above resolves through `user { login }` like any account. `GitActor.user` is typed `User`,
so the `author { __typename }` discriminator that `pull-request-history.ts` uses to drop bot-opened
deliveries has no counterpart on a commit. The `[bot]` suffix is GitHub's own convention for app
accounts and is what the roster excludes on — a string rule, recorded as one.

## What was not measured

* No timing of the commit walk against a large repository. The page cap and the window bound it, but
  the round trip is not measured, exactly as the pull-request walk's is not.
* No second repository. Darkwaters was named in session as the multi-contributor case and its forge
  was not queried; the feature's acceptance needs one such subject.
