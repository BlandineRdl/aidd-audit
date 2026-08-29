# Reference profiles, assessed end to end

`aidd-audit assess ./profiles/<name>` must report the level `profiles/README.md` gives that
subject, through the shipped pipeline, with every value read from the bundle itself.

| Profile | Expected |
| --- | --- |
| `perceval` | Red |
| `bohort` | Blue |
| `leodagan` | Green |
| `arthur` | Copper |

## What is missing

One collector ships, and its subject is a Git work tree root. A bundle is not that subject, so
every axis resolves `UNKNOWN` and every profile reports `proven: null`. The gap is one adapter
and its wiring, not a change to any rule.

`aidd_docs/tasks/2026_08/2026_08_28_observable-evidence-spec/observable-evidence.md` already
decides what each axis accepts. Nothing below re-derives it; the tables there are the
specification and the phases only implement them.

## The subject kinds are told apart by a marker, not by elimination

A bundle is a directory holding `profile.json`. That file is the manifest that says the
directory records one subject's evidence; its *content* is admissible for nothing — role,
experience and team size are out of scope, and `available` is a listing, not an observation.

The live collector already declines anything that is not a work tree root, so the two
collectors answer disjoint subjects and `resolveEvidence` never has to arbitrate between them.

## The recorded tree

`repo-context/` is what a bundle records of its subject's repository, so a root-anchored
directory name (`docs/context/`, `.claude/rules/`) is matched under it. A name matched
*anywhere* keeps its bundle-relative path, which is what lets `code/prompt-history.md` prove
`prompts` for a subject that recorded no `repo-context/` at all.

Implemented as a rebase: a bundle path loses a leading `repo-context/` and every other path
stands as it is. Two files rebasing onto one recorded path is possible; the first walked wins,
and only file *reads* are affected — name matching cannot tell them apart anyway.

## A bundle records no file mode

`loops` treats a file as a script when the recorded tree marks it executable or it carries a
shell shebang. A bundle carries no mode, so the shebang is all it has — and a bundle therefore
accepts **any** interpreter's shebang, not only a shell's, since the mode that carried the rest
on the live side is missing. A file with no shebang at all stays unseen; were it an agent loop,
the set would publish without `loops`, a practice gap rather than the evidence gap the situation
is. The exposure is a file both executable and shebang-less, which no shell runs portably.

Treating every file as a candidate instead would feed prose to the invocation recogniser —
arthur's `docs/brainstorm/2026-06-auto-retry.md` describes a retry loop he has not built, and
reading it would make `loops` undecidable and cost him the whole harness axis.

## Phases

### 1 — One harness scan, two trees

`harness-scan.ts` reads a tracked tree through `git ls-files` and `join(root, path)`. Both
adapters need the same scan over different trees, and the `loops` recogniser is far too large
to duplicate.

Move it to `src/evidence/adapters/harness/` and give it a source seam:

```ts
export interface HarnessTreeEntry {
  readonly path: string
  readonly regularFile: boolean
  /** Whether the recorded tree marks it executable; null when the tree records no mode. */
  readonly executable: boolean | null
}

export interface HarnessTree {
  entries(): Promise<readonly HarnessTreeEntry[]>
  /** First `bytes` of a file, utf8; null when it could not be read. */
  probe(path: string, bytes: number): Promise<string | null>
  /** Whole file, utf8; null when it could not be read. */
  read(path: string): Promise<string | null>
}
```

`scanHarness(tree, hasAiAttributionTrailer, signal)`. Behaviour-preserving: `git ls-files`'s
`100755` is `executable: true`, `100644` is `false`, and a candidate is a shell shebang or
`executable === true` — identical to today. The existing suite is the oracle and must stay
green unchanged except for how it builds its subject.

`src/evidence/adapters/live-repository/tracked-tree.ts` supplies the git implementation.

### 2 — One size table, two adapters

`bucketForLines`, `bucketForFiles` and `lowerBucket` are private to `git-history.ts` and a
bundle needs the same table. Extract to `src/evidence/adapters/size-buckets.ts`. A table the
two adapters computed differently would break their interchangeability.

### 3 — The bundle adapter

`src/evidence/adapters/fixture-bundle.adapter.ts`, id `fixture-bundle`, supporting all four
axes, emitting only `OBSERVED` observations — the one declarative artifact a bundle carries is
prose, and prose is never parsed.

`fixture-bundle/bundle-tree.ts` walks the directory (skipping symlinks) and rebases as above.
`fixture-bundle/recorded-activity.ts` reads `git-activity.json`:

* `size` — `pull_requests.median_lines_changed` and `median_files_changed` through phase 2's
  table, lower bucket; `none` when `pull_requests.total` is `0`.
* `intervention` — `median_correction_commits_after_open` through the spec's table, promoted to
  `never-once-framed` when `merged_without_human_edit_after_open / total >= 0.9`;
  `not-applicable` when `total` is `0`.
* `parallelism` — `parallelism.median_concurrent_branches`. The median, never the max.
* AI attribution — `commits.ai_coauthored_ratio > 0`, feeding `scanHarness`'s
  `hasAiAttributionTrailer`. An unreadable or malformed file yields `null` there, which is
  "the commit record was not read" and leaves `prompts` undecidable unless the tree proves it.

A field absent or not a number costs its axis and nothing else. Every emitted value is checked
against the loaded scale first, exactly as the live adapter does.

### 4 — Wiring

Add the collector to `assess.command.ts`'s `collectors`. No signature changes.

### 5 — Acceptance

`tests/acceptance/reference-profiles.test.ts` drives `runAssess(['assess', <path>, '--json'])`
with a capturing `CommandIo` and asserts exit `0`, the expected `proven.label`, and
`coverage.axesConfirmed === 4`.

In process, not through `dist/cli.js`: `tests/cli/process-contract.test.ts` builds that bundle
with `clean: true` while vitest runs files in parallel, and `testing.md` reserves `dist/` to it.

### 6 — Memory

`cli.md`, `codebase-map.md`, `testing.md` and `architecture.md` all state that no profile
reaches its level and that the bundle adapter is planned. Correct them.
