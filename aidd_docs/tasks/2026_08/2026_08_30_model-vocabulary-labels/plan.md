---
objective: "Render human-readable descriptions for maturity scale values from the loaded model while preserving raw values and JSON determinism."
status: reviewed
---

# Plan: Model vocabulary labels

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Let `key-steps`, `behavior` and every other scale term carry a model-owned French explanation into the report. |
| **Source** | Conversation: terminal output is correct but opaque; the user requires the same separation used for evidence-gap diagnostics. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Model and report vocabulary | [phase-1.md](./phase-1.md) |
| 2 | Human rendering and documentation | [phase-2.md](./phase-2.md) |

## Decisions

| Decision | Why |
| --- | --- |
| Store descriptions with each model scale. | A custom `--model` owns its own language; the CLI must not hardcode AIDD terminology. |
| Carry vocabulary through the assessment report. | Renderers consume the report and must not reload or interpret the model. |
| Preserve raw scale values in JSON and prose. | Values remain machine-stable and recognizable; descriptions make them legible rather than replacing them. |
