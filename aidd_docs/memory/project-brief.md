# Project Brief

What this project is, the problem it solves, and its domain language. The non-derivable "why", not the "how".

## What it is

- An evidence-based AIDD maturity assessment: it inspects a repository, its harness configuration and its Git activity, then reports the highest maturity level that repository can *prove*.
- For developers working with AI coding agents. Tech leads and organisations are a later audience the core must not preclude.

## Why it exists

- Self-declared AI maturity is unreliable. The governing principle is **don't ask what you can observe, and don't pretend to know what you can't prove**.
- The differentiator: the level is **calculated deterministically and explained, never inferred by a language model**. An LLM may narrate the result, never decide it.
- The architectural invariant everything else serves: given the same maturity model and the same observable evidence, the result is always the same, without an LLM, with enough provenance to explain exactly why. **Offline holds for the evidence a subject carries**; a forge reading is reproducible against a fixed forge state and not beyond it.

## Domain language

| Term | Meaning |
| ---- | ------- |
| Observation | A raw fact read from a repository, before normalisation |
| Evidence | A normalised observation resolved to one status |
| `CONFIRMED` | Observable evidence proves the requirement. The only status that can satisfy one |
| `CLAIMED` | The developer or the docs claim it, but it could not be independently observed |
| `CONFLICTING` | Available observations disagree |
| `UNKNOWN` | Insufficient evidence to decide. Not a negative result — "not proven" |
| `MET` / `NOT_MET` / `UNPROVEN` | Assessment outcomes for a requirement or axis. Not evidence statuses |
| Axis | One of the four measured dimensions: Taille, Harness, Intervention, En parallèle |
| Level | One of seven cumulative ranks: White, Red, Blue, Green, Copper, Silver, Gold |
| Coverage | How much of the intended evidence a collection run actually obtained |
| Provenance | Which collector produced a given piece of evidence |
| Profile | An acceptance fixture under `profiles/` standing in for one developer's repository |
| No proven level | A valid assessment result, reported as `proven: null`. Evidence coverage was insufficient to establish even the baseline; it does **not** mean the subject sits below White |
| `prompts` | Demonstrated prompt-driven AI usage. Not tied to the presence of a prompt-history or transcript file |
| `context-engineering` | What the AI knows: project memory, architecture, conventions |
| `behavior` | How the AI acts: rules, agents, hooks, guardrails |
| `loops` | A script re-runs the AI until a project command passes |
| Contributor | An account the forge attributes work to inside the window. A person is an account; a git identity is never the key, because two addresses under two name strings can resolve to one login and no local heuristic recovers that mapping |
| Roster | One row per contributor, each with its own sample and its own levels. Not evidence: it answers no axis and reaches no resolution |
| `emailAddresses` | How many distinct email addresses the forge collapsed into one account. Addresses, not identities: GitHub joins on the address, and the author name travels in the query and decides nothing, so counting name-and-address pairs would publish a larger number about a mapping nobody made |
| Unattributed | The row for commits whose email GitHub maps to no account. Attributed to nobody, on purpose, and stated rather than hidden |
| Harness authorship | Who wrote the files that proved a harness member, as **two counts that may be absent**: the distinct proving paths an account committed to in the window, and the distinct commits it made to them. They do not partition the harness set, so their sum across rows may exceed it and neither is a share of anything. Absent (`null`) is a walk that did not run, and is never two zeros — zero is an observation that a person wrote none of the harness, and `null` is local Git refusing. A published fact either way, never a level |

## Key features

- Deterministic decision chain: raw observations → normalised evidence → evidence resolution → axis satisfaction → level satisfaction → highest proven level.
- Three evidence sources behind one port: a recorded fixture bundle, a live local repository (filesystem + Git), and the GitHub forge that hosts it.
- Two renderers: a human explanation and a versioned JSON contract.
- **Offline is a floor, no longer a guarantee.** A bundle, and a repository with no GitHub origin, are assessed with no network at all: everything the local sources answer, they answer offline. A repository hosted on GitHub is assessed through its forge as well, because three of the four axes are unobservable or artefact-prone on a squash-merged history, and the merge graph is not the delivery record there. Without credentials the forge collector **fails rather than falling silent** — `FAILED` in provenance, naming what refused, and the three axes it owns go `UNKNOWN`. Silence in this codebase means no observation *and* no failure, which is what a collector does for a subject that is not its own; a refusal is a different thing and the report says which. What was promised before this, and is no longer true, is that *execution never touches the network*.
- **A level can now name a person, beside the repository's own.** On a GitHub subject the report carries a contributor roster: one row per account active in the window, each with its own sustained and demonstrated levels where its own sample supports them. The repository line is unchanged and covers every delivery in the window, whoever made it — stated in prose, because without that sentence a reader meets two answers and no rule for choosing between them.

## The conservative rule

> A level is earned by evidence, never inferred from missing information.

The report must keep a **practice gap** (`NOT_MET`) and an **evidence gap** (`UNPROVEN`) visibly distinct. Collapsing them is the product's central failure mode.

* `NOT_MET` means observable evidence proves the practice does not meet the requirement. AIDD may recommend improving the practice.
* `UNPROVEN` means the requirement could not be established because evidence is `UNKNOWN`, `CLAIMED` or `CONFLICTING`. AIDD must explain what evidence is missing or conflicting, never assume the practice itself is deficient.

> **AIDD must never recommend changing a practice merely because it failed to prove that practice.**

A thin row on the contributor roster is an evidence gap, on the same footing as an unproven axis: a person's sample is a fraction of the repository's and clears the sample floors less often, so a level below the repository's line is the ordinary outcome on a shared repository and not a verdict on anyone. AIDD recommends nothing from a row, and never derives anything from harness authorship either — reading either as a performance problem is a human act on a human's own team, and the tool must not do it for them.

