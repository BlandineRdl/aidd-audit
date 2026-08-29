# Transcribing the Taille axis, and the share that would read it twice

Measured on 2026-08-29 against the GitHub API. Four repositories, three of which are not the subject
this work started from, so the reading is checked somewhere its answer was not wanted in advance.

## What `levels/aidd.md` settles, and what it leaves open

It defines the axis qualitatively: `S` petite ou triviale, `M` complexité moyenne, `L` multi-étapes,
`XL` multi-modules. It says the unit is the delivered feature, that each cell is a minimum, that a
level needs every axis, and that the observation column illustrates without deciding. On the
aggregate it says only *"la taille habituelle des features livrées, pas la plus grosse jamais
faite"*, which excludes a maximum and names nothing else.

It does not settle the bucket bounds, the period, or the aggregate. All three are transcription, and
`architecture.md` records none of them among its forced readings.

## The bucket bounds cannot be founded in the model, and the attempt is recorded here

`XL` means multi-modules, which sounds observable, so it was measured. It is not.

The subject is not a monorepo: `src` carries 2288 of its file touches, against 336 for `app` and 183
for `supabase`. Counting top-level directories therefore says nothing about modules. Taking the
second segment under `src` and `app` instead gives, over the 108 deliveries in the window:

```
modules touched per delivery   1→23  2→28  3→18  4→10  5→10  6→7  7→4  8→3  9→3  12→1  14→1
median 3 · at least two modules on 78.7% of deliveries · at least five on 26.9%
```

Reading "two or more modules" as XL would make four deliveries in five XL, which is plainly not what
the referential means. What counts as a module is an architectural judgement, its depth in the tree
differs between a monorepo and a single application, and no repository declares it in a form a tool
can read.

**So the line and file bounds stay, and the honest move is to record them as a forced reading rather
than keep them as an unexamined default.** They are not derived from the model, no better-founded
alternative is available from a forge or a work tree, and the cost is real: the subject's median sits
45 lines from the M-to-L bound, and moved across it once already when the window's endpoint changed.

## The four repositories

Window is 180 days ending at each subject's most recent commit. `at 1/3` is the highest bucket at or
above which a third of deliveries fall.

| repository | deliveries | active days | size median | size at 1/3 | parallelism median | parallelism at 1/3 |
| ---------- | ---------- | ----------- | ----------- | ----------- | ------------------ | ------------------ |
| mc-tracker-fr/McTracker | 108 | 54 | M | **L** | 2 | **4** |
| BlandineRdl/EquimApp | 22 | 15 | L | L | 2 | 3 |
| BlandineRdl/nfc-wms | 11 | 2 | L | L | — | below the floor |
| MyUBdo-rgb/Darkwaters | 16 | 9 | **S** | **XL** | 1 | 3 |

`BlandineRdl/framework` was dropped as a control: 62 merges and no pull request at all, its branches
having been merged locally. A forge collector has nothing to read there.

## What the controls show

**Darkwaters is the case that decides it.** Its typical delivery is `S` and 43.8% of its deliveries
are `XL`. A median calls it S, a share at a third calls it XL, and both are true statements about
different questions. No single number describes that repository, which is the argument for reporting
two — and the argument for never printing the second without the frequency that earned it.

**A share needs a larger sample than a median.** Darkwaters reaches `3` on parallelism from exactly
three of nine active days, and nfc-wms has two active days against a floor of five. The floors in
`delivery-sample.ts` were chosen for a median, which moves slowly; a share computed from nine
observations moves a whole bucket on one day. **The demonstrated reading is owed its own floor, and
it must be higher.** The value is unchosen and is the decision this document does not close.

**N does not separate cleanly between a third and two fifths.** At two fifths the subject's size
falls back to `M`, its median, while Darkwaters stays `XL` at 43.8%. Raising N therefore silences the
subject without fixing the case that motivated the doubt, which is an argument for choosing N on the
model's words rather than on its effects.

## The verification the plan owed, closed

The all-states query was rerun with the cursor threaded the way `gh` expects — the variable must be
named `endCursor` — and it returns **186 pull requests**: 145 merged, 33 closed without merging, 8
open. Recomputing the subject's parallelism over all of them, against the merged-only figures the
collector actually reads:

```
merged only    49 active days   median 2   at or above 2  55.1%   3  40.8%   4  26.5%
every state    54 active days   median 2   at or above 2  63.0%   3  44.4%   4  35.2%
```

**The median does not move.** The shares rise, and at one third the demonstrated reading would be 4
rather than 3 if abandoned and still-open branches counted. They do not: the collector reads merged
pull requests, so 3 is a floor rather than a measurement, and the document says so where the figure
is used.

## The table at three candidate values of N

`—` is a sample under the floor for that reading. Parallelism uses the merged-only distribution,
which is what the collector reads.

| repository | axis | at 1/4 | at 1/3 | at 2/5 |
| ---------- | ---- | ------ | ------ | ------ |
| McTracker | size | XL (25.0%) | **L** (39.8%) | M — falls to the median |
| McTracker | parallelism | 4 (26.5%) | **3** (40.8%) | 3 (40.8%) |
| EquimApp | size | XL (31.8%) | L (77.3%) | L |
| EquimApp | parallelism | 3 (40.0%) | 3 | 3 (40.0%) |
| nfc-wms | size | XL (27.3%) | L (90.9%) | L |
| nfc-wms | parallelism | — | — | — |
| Darkwaters | size | XL (43.8%) | XL | XL |
| Darkwaters | parallelism | — | — | — |

**The subject's two shares sit just above the chosen third**: 39.8% on size and 40.8% on
parallelism, against 33.3%. Six and seven points of margin, not a hair — but a quarter would make
three of the four controls XL, and two fifths would silence the subject's size while leaving
Darkwaters at XL, which is the case that motivated the doubt. **This decision is taken with its
effect on the subject already known, and that is stated here rather than hidden.** What defends it is
that N was argued from the model's words before the table was read, and that no value of N fixes
Darkwaters.

**One task was not done in the order it asked for.** Task 2.2 required each control's expected level
to be written down *before* measuring it. It was not: the three were chosen for having a forge and
enough history, and measured straight away. Nothing can retroactively make that a blind test, so the
controls prove less than they were meant to — they show what several real distributions look like,
not that a prediction survived them.

## Recommendation

* Keep the line and file bounds. Record them in `architecture.md` as a fourth forced reading, naming
  what was tried instead and why it failed.
* Record the median as a fifth forced reading. `habituelle` excludes a maximum and licenses a central
  measure; nothing in the model licenses one aggregate over another.
* Take **N = 1/3** for the demonstrated reading, argued from `chaque cellule est un minimum` and from
  Copper's own illustration naming *"PR de taille L et XL"*, a mix rather than a majority. Not from
  what it yields for any repository.
* Give the demonstrated reading a floor of its own, above the median's five.

## Decided on 2026-08-29

**N is one third. The demonstrated reading needs ten, on whichever sample its axis counts**: ten
delivered changes for size, ten active days for parallelism. The median keeps its floor of five,
because a median moves slowly and a share does not.

Ten is chosen, not measured, on the same footing as every other floor here. What it buys, read
against the four repositories above:

| repository | size demonstrated | parallelism demonstrated |
| ---------- | ----------------- | ------------------------ |
| McTracker | available, 108 deliveries | available, 54 active days |
| EquimApp | available, 22 deliveries | available, 15 active days |
| Darkwaters | available, 16 deliveries | **withheld**, 9 active days |
| nfc-wms | available, 11 deliveries | **withheld**, 2 active days |

It withholds exactly the reading that was thin. Darkwaters reached `3` on parallelism from three of
nine days, which ten days would not have licensed; its size reading stands on seven `XL` deliveries
out of sixteen, which is a repetition rather than an accident and is not what the floor is guarding
against.

A floor of twenty was weighed and rejected: it would have withheld both readings from EquimApp, a
mobile application near completion whose 22 deliveries over 15 active days are an ordinary finished
project rather than a thin sample. A rule that has nothing to say about a finished application is
measuring the wrong thing.
