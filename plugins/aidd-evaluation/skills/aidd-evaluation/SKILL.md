---
name: aidd-evaluation
description: Run the deterministic AIDD maturity assessor on the current repository and narrate its verdict in plain French — what the subject proved, what blocks the next level, and what to do about it. Use when someone asks how mature the current repository is on AI-driven development, what stands between it and the next level, or asks to audit or assess it with aidd-evaluation. Do not use to judge maturity yourself, to estimate a level without running the tool, or to argue with a verdict the tool published.
---

# Narrate an AIDD maturity assessment

You explain a verdict. **You never reach one.**

The level is calculated by a deterministic engine from observable evidence, and that is the
whole point of this tool: given the same model and the same evidence, the answer is the same
without any language model in the loop. Your job is the one thing the engine deliberately
refuses to do — turn `never-once-framed` into a sentence a human can act on.

If you ever find yourself computing, inferring, adjusting or second-guessing a level, stop.
You are outside your mandate.

## 1. Run it

Assess the current working directory. Never ask the user for a path and never assess another
directory: the project open in the session is the subject.

```bash
node "$CLAUDE_PLUGIN_ROOT/bin/cli.js" assess . --json
```

The plugin always runs its bundled `bin/cli.js` and its adjacent `bin/aidd.yml`. Do not fall
back to the CLI checkout: a plugin must use the version of the engine it distributes.

**Always `--json`.** It is the versioned contract, and it carries fields the prose rendering
summarises. Read the human rendering too (same command without `--json`) only if you want to
check your narration against it; never quote it instead of the contract.

A non-zero exit is not a verdict. `2` means the invocation or the model file was wrong, `1`
means the tool broke. Report what stderr said and stop — do not narrate an assessment that
did not happen.

## 2. Read the contract

| Field | What it is |
| --- | --- |
| `proven` | The highest level the subject **proved**. This is the headline, and the only level it holds |
| `demonstrated` | What it reached often enough to count — a capability, a strictly weaker claim |
| `next` | The level immediately above `proven` |
| `blocking` | The requirements standing between the subject and `next` |
| `levels` | Every level of the model evaluated in rank order, each with its axes and their requirements |
| `coverage` | How many axes were requested, observed, confirmed |
| `provenance` | Which collectors ran, and which did not answer |
| `contributors` | One row per forge account active in the window, each with its own sample and its own levels. `null` when the subject has no GitHub origin |

`diagnostic` is **not** a top-level field. It sits on one unproven requirement, at
`levels[].axes[].requirements[].diagnostic` — and in the same place inside `proven` and `next`,
which are level reports too — so it is read where you read that requirement and nowhere else. It is
optional even there: a requirement can be unproven and carry none.

These readings decide whether your narration is honest:

* **`proven: null` does not mean "below White".** It means evidence was insufficient to
  classify at all. Never name White, never say "the lowest level", never imply the subject is
  bad. Say the assessment could not place it, and name what is missing.
* **`demonstrated` is never the answer to "what level is this repo".** Report it below the
  proven level, never in its place, and **never without the share that earned it**. The share
  is a fraction between 0 and 1 in the contract; render it as a whole percentage in prose, and
  name what it counts — `unit: DELIVERIES` is livraisons, `unit: ACTIVE_DAYS` is jours actifs.
  Saying "L" without "sur 40% des livraisons" turns a habit into a maximum.
  **Say nothing about it at all when `demonstrated.level.rank` is not above `proven.rank`, and
  nothing at all when `proven` is null** — the CLI omits it in both cases, and a narration that
  announced a ceiling the tool declined to print would contradict the very output it explains.
  A ceiling with no floor is not a result.
* **A collector that did not answer cost the subject axes it might have passed, and `FAILED` is not
  the only status that says so.** `FAILED` is a source that refused; `TIMED_OUT` one that ran out of
  budget, which is the same loss by another route; `SKIPPED` supported none of the axes the model
  asked for, and its `axes` list is empty, so it cost nothing and explains nothing. All three carry
  a `reason` — only `COMPLETED` does not. Name the source that did not answer and what it said. The
  axes it was asked for are `UNKNOWN`, which is an evidence gap, never a practice one.
* **A `COMPLETED` collector can publish a `diagnostic` on an unproven requirement.** Treat it as
  a report fact, not an inference: `INSUFFICIENT_ACTIVE_DAYS` means the stated number of active PR
  days was below the stated minimum, so the tool withheld the measurement. It is an evidence gap,
  never a recommendation to change the practice.
* **Without a diagnostic, do not guess why a completed collector answered nothing.** `provenance`
  says a collector ran and which axes it was asked for, never what it found per axis. Name who was
  asked and stop there.

## 3. The two gaps are not the same gap, and this is the rule that matters most

Each entry in `blocking` carries `gap`:

* **`PRACTICE`** — evidence proves the practice does not meet the requirement. You may
  recommend improving the practice. Say what to change.
* **`EVIDENCE`** — the requirement could not be established: `UNKNOWN`, `CLAIMED` or
  `CONFLICTING`. You must explain **what evidence is missing or contradictory**, and you must
  not suggest the practice is deficient.

> **Never recommend changing a practice merely because the tool failed to prove that practice.**

Collapsing the two is this product's central failure mode. A repository whose forge could not
be reached is not a repository that works badly.

## 3b. The contributor roster names people, and that changes what you may say

`contributors` is `null` on a subject with no GitHub origin. Say nothing about contributors at all;
there is no roster to narrate and its absence is not a finding.

When it is present, `status` is `COMPLETED`, `FAILED` or `TIMED_OUT`. A failed roster is an evidence
gap about the roster itself — name that the accounts could not be enumerated and why, and stop.
`COMPLETED` with no rows means the walks answered and nobody was active in the window; it is the
only status entitled to say that, and you must not say it for the other two.

Each row carries `account` (`null` is the unattributed bucket, commits whose address the forge maps
to no account), the counts `commits` / `deliveries` / `activeDays`, `observed`, `proven`, `next`,
`demonstrated`, `blocking`, and `harnessAuthorship`.

**`observed` holds one entry per axis the model declares, resolved or not.** An axis nobody answered
is present holding `evidence: "UNKNOWN"` and `value: null`, exactly as an unproven requirement is,
so the list length tells you nothing about how much was measured. `value` is filled on `CONFIRMED`
and `null` on every other status: **read only the `CONFIRMED` entries as measurements**, and read
the rest as axes this account's own sample could not settle.

**Every rule above applies per row, and three more apply only here.**

* **The repository's level and a row's level answer different questions.** The repository line
  covers every delivery in the window whoever made it; a row covers one account's own. They can
  disagree, and on a shared repository they usually do — a repository can be Green while no single
  contributor is, because the blend takes each axis from whoever was strongest on it. Say which one
  you are quoting, every time.
* **A row with `proven: null` is an evidence gap about a sample, never a judgement of a person.** A
  person's sample is a fraction of the repository's and clears the sample floors far less often, so
  an unclassified row is the ordinary outcome on a shared repository. Read `observed` before you say
  a row establishes nothing: it usually established most of its axes and fell short on one. Name
  what it did measure, then what it could not.
* **`harnessAuthorship` is a fact and never a verdict, and it is not a share of anything.** It counts
  the harness files an account committed to (`files`) and the commits it made to them (`commits`).
  The size of the harness set is `contributors.harnessPaths`, one number on the block rather than on
  a row. The rows do **not** divide that set between them: a file one account wrote and another later
  edited counts once for each, so `files` summed across rows can exceed `harnessPaths`. **Write no
  percentage out of these numbers and no ranking**, and never say a row owns a proportion of the
  harness. `null` is a walk that did not run, which is a different statement from `{ files: 0 }`, an
  account that wrote none of it. It measures who set the harness up, never who uses it, and the
  harness axis itself is the repository's — every row carries the same value on it, which the report
  states explicitly. A contributor who authored none of the harness and relies on all of it daily is
  not thereby deficient. **Derive no recommendation, no ranking and no concern from this field**, and
  do not present a low count as a problem to address.

> **You are narrating a measurement about people. The conservative rule is not softer here, it is
> stricter: a practice gap on a row may be explained, and nothing else about a person may be.**

## 4. Vocabulary comes from the report

`vocabulary` is the loaded model's published scale vocabulary. Its `descriptions` explain each
raw ordinal value and set member; quote those descriptions when explaining a term. Do not carry a
second AIDD glossary and do not consult `levels/aidd.md` to translate a custom model: the report is
the only vocabulary authority available to this skill. Numeric thresholds remain numbers.

The evidence statuses are contract tokens: `CONFIRMED` can satisfy a requirement; `CLAIMED`,
`CONFLICTING` and `UNKNOWN` are evidence gaps, never practice failures.

## 5. Write the answer

In French, and in this order:

1. **Le verdict, en une phrase.** Le niveau prouvé, ou le fait qu'aucun n'a pu être établi.
2. **Ce qui l'a gagné**, si c'est utile — les axes, en langage humain, pas en ids.
3. **Ce qui bloque le niveau suivant**, un point par axe, avec pour chacun : ce qui est
   observé, ce qui est demandé, et de quel type d'écart il s'agit.
4. **Ce qu'il faudrait faire**, uniquement pour les écarts de pratique. Ancre chaque conseil
   dans le seuil que l'exigence porte, jamais dans ton intuition. Pour `loops`, tu peux lire
   les `scripts` du `package.json` du sujet et nommer sa vraie commande de validation plutôt
   qu'un exemple générique.
5. **Ce qu'on ne sait pas**, s'il y a des écarts de preuve ou un collecteur en échec — ce qui
   manque pour le savoir, jamais ce qu'il faudrait changer.

Match the length to the question. "C'est quoi mon niveau" gets three lines and an offer to
detail; "qu'est-ce qui me bloque" gets the full breakdown.

## 6. Never

* Name a level that is not in the report, or a rank the report did not publish.
* Present `demonstrated` as the level, or state a demonstrated value without its share.
* Read `proven: null` as White, as zero, or as a bad result.
* Recommend a practice change for an `EVIDENCE` gap.
* Recompute, average, round or "correct" anything the contract carries.
* Soften or inflate a verdict because it seems harsh or generous. It is a measurement.
* Narrate a run that exited non-zero.
* Present a row's level as the repository's, or the repository's as anyone's.
* Read an unclassified row as a weak contributor, or rank contributors against each other.
* Derive any recommendation, concern or comparison from `harnessAuthorship`.
* Name the unattributed bucket as if it were a person.
