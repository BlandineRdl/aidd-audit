# Assess a set of profiles

## Target

Given a directory that holds several recorded profile bundles, the tool assesses every bundle it
holds and publishes one report per profile, instead of publishing a single empty assessment of the
directory itself.

## Hard constraints

- **A subject that is claimed today keeps its exact current outcome.** A recorded bundle and a
  repository work-tree root are each still one subject, producing one report, byte for byte what
  they produce now. The set reading applies only to a directory that is neither.
- **A profile's own report is unchanged by being assessed alongside others.** The document
  published for one profile in a set is identical to the document that profile produces when named
  alone — same level, same coverage, same provenance, same evidence. No cross-profile comparison,
  aggregate, or ranking may alter a single profile's verdict.
- **The published machine-readable shape for a set is a list of the existing per-subject
  documents, and the frozen per-subject contract does not change.** No new versioned public shape
  is introduced: a run-level envelope would be a second public contract with no consumer, which
  this project already refused once for error output.
- **Each profile is identified in the output by the path the caller can name it with.** A reader,
  human or machine, can tell which verdict belongs to which profile, and can re-run any one of them
  from what the output states.
- **The order of the reports is stable.** The same directory and the same model produce the same
  output bytes, on any machine, on any day, to the extent the underlying evidence already allows.
- **A directory that is neither a subject nor a set of profiles is refused as a caller fault,
  rather than publishing an assessment of nothing.** Today it publishes a well-formed report with
  no axis observed, which reads as a verdict on the profiles it does not contain.
- **The exit code still answers whether the assessment ran, never how mature anything is.** A
  profile that establishes no level is a successful run. A run is only a failure when the caller
  named something unusable, or when the tool could not publish truthfully what it assessed.
- **A profile whose evidence is thin does not suppress the others.** Every profile in the set is
  assessed and reported, regardless of what the ones before it produced.

## Non-goals

- No comparison, ranking, aggregate score, average, or summary line across the profiles in a set.
  The output is N independent verdicts side by side, nothing more.
- No recursion beyond the directory named: a set is the bundles sitting directly inside it, never
  every bundle anywhere beneath it. A profile filed one level deeper is out of the set, and naming
  its own parent is how it is reached.
- No second subject operand. Naming two paths in one invocation stays refused; the set is expressed
  by naming the directory that holds them.
- No change to what any collector observes, to the maturity model, or to how a level is decided.
- No filtering, selection, or exclusion of profiles within a named set.
- No way to read a repository work-tree root as a set of the bundles it holds, and no flag to force
  one. A path under version control is a repository; profiles are expected to sit in a directory of
  their own beneath it. Decided by the repository owner after the first delivery, against the
  alternative of making one subject mean two things depending on its contents.
- No change to the reference profiles themselves or to the levels they are pinned at.
- No progress output, timing, or per-profile status stream while a set is being assessed.

## Done-when

- Naming the directory that holds the reference profiles produces one assessment per profile, each
  naming the profile it belongs to, and none of them is the empty verdict published today.
- Each of those per-profile assessments states the same level that profile states when it is named
  on its own.
- Naming a single recorded bundle, and naming a repository work-tree root, each still produce
  exactly one assessment, unchanged from today's output.
- The machine-readable output of a set can be read as a list whose every element is a document of
  the same shape and version the tool already publishes for one subject.
- A reader of the human output can attribute every verdict to exactly one profile without counting
  lines or inferring order.
- Naming a directory that holds no profile bundle and is not itself a subject reports that the path
  is not something the tool can assess, and publishes no assessment document.
- Assessing the same directory twice yields the same output.

## Stakeholders

- Decider: the repository owner — the published output shape for a set is a public commitment.
- Owner: the driving adapter that owns invocation and rendering.
- Consumer: anyone comparing several recorded profiles in one pass, and the acceptance suite that
  pins the reference profiles.

## Context

`assess <dir>` on a directory holding bundles currently exits successfully with `0 of 4 axes
confirmed`, which is indistinguishable from a real verdict that nothing could be proven. That
false verdict, not the missing convenience, is what this work removes.

The per-subject document is frozen and self-contained; several worktrees bind to it. The set
reading is therefore additive at the invocation boundary and must not reach into it.

The tool's exit codes already classify responsibility rather than error kind, and that taxonomy is
pinned by an existing acceptance suite. Any new failure route has to fit it rather than extend it.
