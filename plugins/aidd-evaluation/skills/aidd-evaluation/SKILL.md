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
| `coverage` | How many axes were requested, observed, confirmed |
| `provenance` | Which collectors ran, and which failed |
| `diagnostic` | A collector-provided reason why an unproven requirement has no observation |

Three readings decide whether your narration is honest:

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
* **A collector with `status: FAILED` cost the subject axes it might have passed.** Say which
  source refused and why. Those axes are `UNKNOWN`, which is an evidence gap, never a practice
  one.
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
