---
objective: "Publish collector-provided reasons for unproven axes so the AIDD report explains insufficient evidence without changing maturity decisions or schemaVersion 1."
status: reviewed
---

# Plan: Evidence-gap diagnostics

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Carry a forge sample shortfall from collection to JSON and French prose. |
| **Source** | Conversation: the current repository reports `En parallèle` as `UNKNOWN` after only three active PR days, while the reader sees only the collector name. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Preserve collector diagnostics | [phase-1.md](./phase-1.md) |
| 2 | Publish and narrate diagnostics | [phase-2.md](./phase-2.md) |

## Decisions

| Decision | Why |
| --- | --- |
| Keep `schemaVersion: 1` and add the diagnostic to the existing report contract. | This is an MVP with no released contract consumer; the user explicitly chose no version bump. |
| Model diagnostics as collector facts per axis, not renderer deductions. | The renderer must not infer why a completed collector emitted no observation. |
