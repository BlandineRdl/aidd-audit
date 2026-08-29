# Measurements taken on 2026-08-29

Every figure below was read from the GitHub API against `mc-tracker-fr/McTracker`, or from that
repository's local history. They are the plan's verifiable target: the implementation is done when
`assess` reproduces them. Recorded here because they were established once, at cost, and because a
plan whose target is a memory is a plan nobody can falsify.

Window: the collector's own 180 days, ending at the most recent commit, so **2026-02-28 to
2026-08-27**.

## What the local history can and cannot see

```
merges on the first-parent walk, in window        7
non-merge commits on the first-parent walk         209
of those, subjects ending in "(#NN)"               101   GitHub squash-merge signature
delivered changes actually in the window           108   101 squashed + 7 merged
```

The live collector reads 7 of 108 deliveries. Everything it derives from branch shape rests on that
sample. This is the whole reason for phase 1.

## Attribution

```
commits carrying a Co-authored-by line             22    of which 20 are renovate[bot]
commits attributing an agent on that line          1
commits mentioning "claude" anywhere in a message  19    prose, never a trailer
```

The offline autonomy rule shipped in `git-history.ts` therefore stays silent on this subject, and
correctly so. Prose is never parsed.

## The four axes, measured from the forge over 108 deliveries

| axis | sustained (median) | demonstrated (share >= 1/3) |
| ---- | ------------------ | --------------------------- |
| size | **M** — 355.5 lines, 11.5 files | **L** — 39.8% of deliveries are L or XL |
| harness | prompts, context-engineering, behavior | same, the axis is a set |
| intervention | **key-steps** — median 1 commit after open | not read, see the plan's decisions |
| parallelism | **2** | **3** — 40.0% of active days reach 3 or more |

Expected verdicts: **sustained Blue, demonstrated Copper.** Blue is blocked at Green by size M.
Copper is blocked at Silver by `loops` missing from the harness, which is a practice gap and not a
measurement question.

### Size distribution, 108 deliveries

```
S: 43   M: 22   L: 16   XL: 27
shares at or above:   M 60.2%   L 39.8%   XL 25.0%
percentiles, lines:   p50 372   p75 1763   p90 4556
```

Bimodal. The median falls in the valley between the two modes, on one of the two least populated
buckets. The four largest deliveries are genuine multi-module features, not generated-file noise:

```
#137  feat(web): redesign dashboard with sidebar layout + listings audit   30 237 lines, 438 files
#123  feat(site): replace notices with sites + consignes model             17 087 lines, 292 files
#204  feat(planning): planning 30j + smart auto-fill + drag highlight      15 652 lines, 180 files
#210  feat(offline): P3 photos + P4 UI/boot/DI swap                         9 185 lines, 133 files
```

### Parallelism distribution, 50 active days

```
23 days at 1 · 7 at 2 · 7 at 3 · 6 at 4 · 2 at 5 · 2 at 6 · 1 at 7 · 1 at 10 · 1 at 11
mean 2.64 · median 2 · shares at or above:  2 → 54%   3 → 40%   4 → 26%
```

The mean is 2.64 and would not reach Copper's 3 either. It is also the one aggregate the model
excludes by name, since "un pic isolé ne compte pas" describes exactly what a mean permits. Twenty
days out of fifty is not an isolated spike, which is why a share reading survives that sentence
where a mean and a maximum do not.

### Intervention distribution, 108 deliveries

```
commits after the PR was opened:  0 → 45   1 → 14   2 → 15   3 → 10   4 → 6   then a tail to 69
median 1 (committedDate) · median 0 (authoredDate) · 41.7% of PRs have none at all
reviews submitted on the 30 most recent merged PRs: 0
```

A worked example of why the top of the scale is not readable here. PR #267 carries one commit
authored at 08:49:23, was opened at 08:50:08 and merged at 08:55:32. Zero commits after opening,
and the fact records only that the PR was opened once the work was finished.

## The size verdict turns on where the window ends

Recorded after phase 2 shipped, because the collector and the hand measurement above disagree and
both are right.

```
window ending at the most recent commit    2026-02-28 .. 2026-08-27   108 deliveries   median 355.5 lines → M
window ending at the most recent merged PR 2026-02-18 .. 2026-08-17   124 deliveries   median 449   lines → L
```

The subject's last ten days are direct commits on the mainline with no pull request, so the two
definitions of "the most recent delivery" fall ten days apart. Those ten days pull sixteen further
deliveries in at the start of the window, and the median crosses the 400-line bucket bound. Files
say `L` under both, so the lower of the two buckets is what moves: `M` on one window, `L` on the
other.

**mc-tracker is Green under the collector's window and Blue under the other**, and nothing in the
model settles which endpoint is the right one. The live collector ends at the most recent commit
because its unit of delivery is a merge on the first-parent walk; the forge collector ends at the
most recent merged pull request because that is its unit. Each is internally consistent, and they
are not interchangeable, which the collector port promises they should be.

Intervention and parallelism are unmoved by the choice: `key-steps` and `2` under both windows.

## Verification closed on 2026-08-30

The parallelism figure counts only pull requests merged inside the window, so a branch abandoned or
merged later contributes nothing. The all-states query first written to check this looped on its own
page — `gh` threads a cursor only for a variable literally named `endCursor` — and was rerun:

```
186 pull requests   145 merged · 33 closed unmerged · 8 open
merged only    49 active days   median 2   at or above 3  40.8%   4  26.5%
every state    54 active days   median 2   at or above 3  44.4%   4  35.2%
```

The median is unmoved. The demonstrated reading would be 4 rather than 3 if abandoned and open
branches counted, and they do not, so **3 is a floor and not a measurement** wherever it appears
above.

## Whose work is being measured, and the bots that are not anyone's

Recorded on 2026-08-29, after phase 5, from a note that the tool cannot yet tell a whole team apart.

`levels/aidd.md` opens with *"Sept niveaux d'adoption de l'IA dans le workflow d'un développeur"*. It
measures **a person**. Every collector here measures **a repository**, and nothing reconciles the
two. The subject makes the gap concrete at two very different scales.

**A teammate who uses no AI.** `Ayaerna` authored 38 of the subject's 784 commits. On this repository
it turns out to cost nothing measurable, because **not one of those commits went through a pull
request**: every merged PR in the window is authored by `BlandineRdl` or by a bot. The forge
collector's sample is therefore already one person's. That is luck, not design, and a team that
opened PRs each would blend two practices into one level with nothing saying so.

**Bots, which are nobody's practice, and which cost a level.** Twenty Renovate pull requests and one
Dependabot sit in the assessed window, 19% of its 108 deliveries:

```
with bots     108 deliveries   median 355.5 lines · 11.5 files   → size M   share at or above L 39.8%
humans only    87 deliveries   median 742   lines · 14   files   → size L   share at or above L 49.4%
```

Excluding them more than doubles the median and moves the bucket from `M` to `L`, which moves the
subject's sustained level from **Blue to Green**. The model's own words settle the direction: it
measures *"la taille habituelle des features livrées avec l'IA"*, and a dependency bump opened by a
scheduled bot is neither a feature nor delivered with AI. Counting it is wrong by the referential,
not merely inconvenient.

**What is owed, in order.** Excluding bot-authored deliveries is the narrow, well-founded fix and
needs only the PR author, which the query already returns. Attributing a level to a person rather
than to a repository is the wider question behind it, has no answer here yet, and must not be settled
by quietly picking the most active author.

### What excluding them actually did, once shipped

Both directions, and the second was not predicted.

```
                 deliveries   median lines   size   median commits after open   intervention
with bots               108          355.5      M                           1   key-steps
humans only              87          742        L                           2   after-the-fact-some
```

Size rose as expected. **Intervention fell**, because a scheduled bump is merged as it was opened: all
twenty-one bot deliveries carried zero corrective commits and pulled the median from two down to one.
The subject's `key-steps` was bot-flattered, and its honest reading is `after-the-fact-some`.

The subject stays **Blue**, and what blocks Green moved from a falsified size to a real practice gap
on intervention. The demonstrated level falls back to Blue with it, since intervention has one
reading and now blocks Green in both.

A correction that improves one axis and worsens another is the shape to expect from removing a
contaminant. A change that had only improved things would have deserved more suspicion than this one.
