# Project Brief

What this project is, the problem it solves, and its domain language. The non-derivable "why", not the "how".

## What it is

- An evidence-based AIDD maturity assessment: it inspects a repository, its harness configuration and its Git activity, then reports the highest maturity level that repository can *prove*.
- For developers working with AI coding agents. Tech leads and organisations are a later audience the core must not preclude.

## Why it exists

- Self-declared AI maturity is unreliable. The governing principle is **don't ask what you can observe, and don't pretend to know what you can't prove**.
- The differentiator: the level is **calculated deterministically and explained, never inferred by a language model**. An LLM may narrate the result, never decide it.
- The architectural invariant everything else serves: given the same maturity model and the same observable evidence, the result is always the same — offline, without an LLM, with enough provenance to explain exactly why.

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
| `prompts` | Demonstrated prompt-driven AI usage. Not tied to the presence of a prompt-history or transcript file |
| `context-engineering` | What the AI knows: project memory, architecture, conventions |
| `behavior` | How the AI acts: rules, agents, hooks, guardrails |
| `loops` | A script re-runs the AI until a project command passes |

## Key features

- Deterministic decision chain: raw observations → normalised evidence → evidence resolution → axis satisfaction → level satisfaction → highest proven level.
- Two evidence sources behind one port: fixture bundles and a live local repository (filesystem + Git).
- Two renderers: a human explanation and a versioned JSON contract.
- Runs fully offline. Installation may need the network; execution never does.

## The conservative rule

> A level is earned by evidence, never inferred from missing information.

The report must keep a **practice gap** (`NOT_MET`) and an **evidence gap** (`UNPROVEN`) visibly distinct. Collapsing them is the product's central failure mode.

* `NOT_MET` means observable evidence proves the practice does not meet the requirement. AIDD may recommend improving the practice.
* `UNPROVEN` means the requirement could not be established because evidence is `UNKNOWN`, `CLAIMED` or `CONFLICTING`. AIDD must explain what evidence is missing or conflicting, never assume the practice itself is deficient.

> **AIDD must never recommend changing a practice merely because it failed to prove that practice.**

