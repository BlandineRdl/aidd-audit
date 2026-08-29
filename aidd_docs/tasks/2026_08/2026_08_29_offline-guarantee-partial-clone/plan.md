# The offline guarantee must hold on a partial clone

**Owed before anyone claims `aidd-audit assess .` is offline in every case.** Not a blocker
for the live repository collector: on the shape at issue the adapter already answers
`UNKNOWN` for both Git-derived axes, so nothing wrong is published. What is at risk is the
promise, not the result.

## The claim

`cli.md`: *"Execution requires no network. Ever."* That is a product constraint, not a
degraded mode, and it is absolute — a command that *may* reach the network on some
repositories already breaks it, whatever happens on the others.

A review of the live repository collector reported that on a blobless or treeless clone,
`git diff --numstat M^1 M` lazily fetches the missing blobs from the promisor remote, and
fails outright when that remote is gone. `git diff` is the one command in this collector
that needs blob contents; `git log`, `git ls-files` and `git rev-parse` read commits, the
index and refs, none of which a partial clone omits.

## What is verified, and what is not

**Not reproduced.** Two attempts to build a partial clone in the development environment
failed: `git clone --filter=blob:none --no-local file://…` left `extensions.partialClone`
empty both times, once with `warning: filtering not recognized by server`, once silently.
Nothing partial was ever created, so the lazy fetch was never exercised and neither was any
remedy. Git 2.50.1.

**The review's report is the only evidence, and it is second-hand here.** The lazy-fetch
behaviour is documented Git behaviour and the reasoning is sound, but this file must not
pretend it was confirmed. First task below is to confirm or refute it.

## Work

1. **Reproduce it, or establish it does not happen.** Build a genuine partial clone —
   `uploadpack.allowFilter` on the source, or a real remote — assert
   `extensions.partialClone` is actually set, then run `readGitDerivedMetrics` against it
   with the network severed and observe whether Git attempts a fetch. If it does not, this
   whole task closes with a test recording that, and `cli.md` needs no change.
2. **If it does: one guard, at the seam.** Refuse the repository shape up front rather than
   patching call sites — `git-process.ts` is the single place every spawn passes through, and
   a scattered fix is how a wall silently loses a folder later. Two candidate mechanisms,
   both to be verified rather than trusted:
   * `GIT_NO_LAZY_FETCH=1` in the environment of every spawn, which turns a lazy fetch into a
     failure instead of a network call. **Unverified in this environment** — it could not be
     exercised without a partial clone. Confirm it exists and does what it claims on the Git
     version in use before relying on it.
   * a partial-clone precondition beside the shallow one in `readGitDerivedMetrics`, reading
     `extensions.partialClone` / `remote.<name>.promisor`.

   Prefer both: the environment variable makes the guarantee structural for every present and
   future command, and the precondition makes the refusal legible instead of surfacing as a
   confusing `GitCommandFailedError`.
3. **Scope the refusal to what actually needs blobs.** `size` is the axis that runs
   `git diff`. `parallelism` and the trailer read use `git log` only. Refusing all of them
   would cost evidence gaps the situation does not warrant — under-measuring is worse than
   not measuring, and so is under-reporting coverage.
4. **A test that would have caught it**, built on a real partial clone, asserted partial
   before use. The fixture must carry the fault: a clone whose `extensions.partialClone` is
   empty is not a partial clone, and a test built on one proves nothing — which is exactly
   how this investigation failed twice.

## Why it is filed here and not as an issue

`vcs.md`: no CI, no GitHub Actions, no platform integrations — issues included — before the
MVP. The debt lives with the code that owes it.
