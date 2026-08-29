---
name: audit
description: Codebase audit report — performance pillar (re-run after remediation)
argument-hint: N/A
---

# Codebase Audit: performance — aidd-audit

The two unbounded serial loops are gone: N `git diff` processes became one per 500 merges, and the file scan now stops the moment its answer is settled.

- **Date**: 2026_08_29 (re-run)
- **Scope**: `src/` — the collection path
- **Health**: good
- **Findings**: 0 critical, 0 warning, 0 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| — | performance | — | none | — | — |

One row from the first run is **withdrawn as a false positive rather than fixed**, and that is a correction to the audit, not a decision about the code — see Coverage.

## Top actions

None. If a repository is ever measured and found slow, the next thing to look at is `scanScripts`: it still opens every tracked file up to the point `loops` is proven, and on a tree that proves nothing that is still one handle per file. Filtering candidates by path before opening would fix it and would also change *what* proves `loops`, so it is a product decision and not a performance one.

## Coverage

- **The per-merge `git diff` N+1 — closed.** `git-history.ts:281` replaces one `git diff --numstat M^1 M` per delivered change with one `git log --no-walk --diff-merges=first-parent --numstat` naming up to 500 merges at a time. The equivalence was verified against this repository before the change: `--diff-merges=first-parent` produces byte-identical numstat rows to `git diff M^1 M`. A repository with 300 in-window merges went from ~300 sequential subprocesses to one. The 500 bound is argv, not git — a command line the kernel refuses would cost the whole `size` axis.
- **The per-side `git log` — closed by bounding, not batching.** `readParallelism` runs its side queries eight at a time through `inBoundedParallel`, and records results in the order the sides were listed rather than the order they returned, so no report can depend on which spawn finished first. Each side is its own revision range and genuinely cannot be batched into one invocation without losing which side a commit came from; the comment says so where the code is.
- **The whole-tree file scan — closed for the common case.** `harness-scan.ts:80` breaks as soon as `loops` is proven. It is outcome-neutral by construction: `scanHarness` suppresses undecidability about a member already in `capabilities`, and this scan reports no other member. On a repository whose retry script sits early in the tree, that is the difference between one open and fifty thousand.
- **The eleven per-file regexes — closed.** `SPAWNER_CALLS` is built once at module level.
- **`readMostRecentCommitDate`'s whole-history scan — withdrawn.** The first run proposed `git log -1 --date-order --format=%aI HEAD`. **That fix is wrong**: `--date-order` sorts by *commit* date and the function takes the maximum *author* date, which a rebase or an applied patch separates. There is no single-line git form for the maximum author date, and the concern was negligible anyway — every commit's date in a 100k-commit history is about 2.6 MB against a 64 MB `maxBuffer`. The scan is required for correctness and stays. Recorded as an audit error, not as a deferred fix.

Every finding here was and remains a countable static property — a loop whose trip count is the repository's own size, a process per iteration. No runtime measurement was taken and no duration is claimed. The 578-test suite still passes, including the 22 tests over `git-history.ts` that constrain the walk, the window and the sample floors, so the batching changed cost and not reading.

- **Scanned**: performance
- **Skipped**: performance runtime profiling — no profiler or bundle analyzer available or applicable (no database, network, browser payload or render path); static heuristics only
