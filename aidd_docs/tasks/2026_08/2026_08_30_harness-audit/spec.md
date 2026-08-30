# Harness audit

## Target

Report the measured cost and shape of a repository's agent harness — what it loads at session
opening, how heavy each part is, how much of it repeats, and how it is written — stating every
figure, then placing recommendations in a separate Findings section whose guidelines are explicitly
chosen rather than measured.

## Hard constraints

- The existing `assess` command is untouched: for each of the four reference profiles and for this
  repository, its stdout bytes and its exit code are identical before and after this work.
- The maturity model is untouched: no axis, scale, level or requirement is added or changed, and
  each reference profile reports the level it reports today.
- The audit is published on its own command with its own JSON shape; the existing public assessment
  contract gains no field.
- Measurement sections contain no threshold, comparison, or recommendation. The separate Findings
  section names the chosen guideline, observed value, action and any honest upper-bound token
  removal estimate; it never represents that estimate as an observed saving.
- Session-opening weight is reported as two separate tiers and never as a single figure:
  - **always loaded** — the context file the tool reads at every session, every file it pulls in
    transitively, and every declaration whose summary is present from the first turn;
  - **conditionally loaded** — every part the tool loads only when something triggers it, reported
    as a worst case, labelled as a ceiling and not as an opening cost.
- Token figures are produced with no network access and no credentials, are identical on any
  machine on any day, and every rendering states they are estimates rather than the counts the
  model itself would produce.
- The encoding the estimate was produced with is named in both renderings. Two encodings differ by
  up to a third on the same bytes, so a figure that does not name its encoding is not reproducible.
- The encoding is chosen so that no measured file is systematically over- or under-counted relative
  to another. A harness holding more than one natural language must not have its files made
  comparable only by accident.
- The subject reading is reported separately from the machine-wide reading, and each is labelled
  with what it can be reproduced against.
- The subject reading produces the same output bytes and the same exit code on any machine, on any
  day, for the same subject and tool convention: no timestamp, no duration, no hostname, no
  absolute path the caller did not type.
- The machine-wide reading is labelled as reproducible only against an unchanged machine
  configuration, in the same terms the tool already uses for a source that lives outside the
  subject. It never contributes to a figure the report calls machine-independent.
- The report names which tool's loading convention it read, so a figure is never mistaken for a
  universal one.
- Duplication is measured by exact repetition of normalised word sequences of a fixed length, and
  is reported as a count of shared passages per file pair plus the passages themselves — never as a
  similarity score, never as a percentage, and never with a threshold above which a pair is called
  duplicated. Whole-line matching was measured on this repository and found one shared line in five
  hundred and eighty-two, while the pairs a reader would name share eleven and thirty passages; the
  finer reading is what makes the measurement say anything at all.
- The prose-versus-list figure is derived from a stated, reproducible reading of what a list line
  is, and both renderings state that reading rather than assume it.
- A subject path that names nothing, and a malformed invocation, are the caller's fault; a harness
  the tool cannot read is reported as an absence of measurement, never as a measurement of zero.
- Both a human rendering and a machine rendering exist, and they state the same facts.
- Nothing is committed, pushed, or opened as a pull request.

## Non-goals

- No score, grade, rank, maturity verdict, or model-provider token count. Findings are advice only,
  based on named chosen guidelines, and never change the assessment result.
- Not a fifth maturity axis, and not a new field on the assessment report. Harness weight never
  contributes to a proven or demonstrated level.
- No exact token count from a model provider, and therefore no network call and no credentials.
- No tool other than Claude in this run. Other agent tools' loading conventions are a later
  addition and must not be half-built here.
- No semantic or model-assisted duplication detection. Two passages that say the same thing in
  different words are not detected, and the report does not pretend otherwise.
- No modification of the audited harness: nothing is rewritten, trimmed, split, or reformatted.
- No measurement of how context grows during a session — only what is present at its opening.
- No attribution of any figure to a person.
- No merging of the subject's figures with the machine's into a single reproducible total: the
  combined figure is offered as a machine-local reading only.

## Done-when

- Running the audit on this repository prints an always-loaded tier that includes the project
  context file and every memory file it imports, and a conditional tier that includes the nine
  path-scoped rule files, with the two tiers never added together into a headline figure.
- Running the audit on a repository holding no harness at all produces a report that says nothing
  was found to measure, exits as a success, and names no figure of zero.
- Every file the audit counted is listed with its own length and its own token estimate, so a
  reader can reproduce the tier totals by adding the lines they see.
- The audit names at least one pair of files sharing repeated content when run against a subject
  that has one, and names the shared content's size, without stating whether that is acceptable.
- Each measured file carries a prose-versus-list figure, and the report states what it counted as
  a list line.
- The machine rendering and the human rendering of the same subject carry the same figures, and
  neither carries a figure the other lacks.
- Running the audit twice on the same subject, on different machines, produces identical output
  bytes.
- Running the audit with the network disabled produces the same output as running it with the
  network available.
- The full project gate passes, and the four reference profiles still report the levels recorded
  for them.

## Stakeholders

- Decider: the repository owner — surface, verdict policy and token method were settled by them
  before this spec.
- Owner: the audit tool itself; the harness reading is tool-specific and expected to grow one tool
  at a time.
- Consumer: a developer wanting to know what their harness costs them at every session opening,
  and to decide for themselves whether that is too much.

## Context

- The existing harness axis answers **presence** — which capabilities a repository demonstrates. This
  audit answers **cost and shape** over the same files. They are different questions and the
  decision to keep them on separate surfaces was made deliberately.
- The governing principle of this tool is that a figure is published only when it is observed, and
  that a gap in evidence is never reported as a shortfall in practice. Findings are a deliberate,
  separately labelled exception: their thresholds are published as chosen assumptions, never as
  observed facts.
- This repository has already recorded, in its own architecture notes, that six thresholds were
  invented for the size axis because nothing better-founded was observable. Repeating that here was
  considered and rejected.
- Both readings are in scope, kept apart. Most of a real session's opening weight sits in the
  developer's machine-wide configuration, so measuring only the subject would answer a narrower
  question than the one asked. Reporting them together under one reproducibility claim would make
  that claim false. The tool already carries this exact shape for a source that lives elsewhere: a
  figure honest about what it can and cannot be reproduced against.
