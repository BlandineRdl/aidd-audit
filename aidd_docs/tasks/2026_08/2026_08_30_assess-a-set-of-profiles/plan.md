---
objective: "Naming a directory of recorded profile bundles assesses every bundle it holds and publishes one report per profile, while every subject the tool already claims keeps its exact output."
status: implemented
---

# Plan: Assess a set of profiles

## Overview

| Field      | Value                                                                                  |
| ---------- | -------------------------------------------------------------------------------------- |
| **Goal**   | One operand may name a set of profiles; the run publishes N reports instead of one empty verdict |
| **Source** | [`spec.md`](./spec.md)                                                                  |

## Phases

| #   | Phase                     | File                         |
| --- | ------------------------- | ---------------------------- |
| 1   | The subject becomes a list | [`phase-1.md`](./phase-1.md) |
| 2   | Acceptance and memory      | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| The set reading is last, after bundle and work-tree root | `assess .` on this repository must stay one subject even though `profiles/` sits inside it, and `assess profiles/arthur` must stay one subject even though it is a directory. Ordering the rules — file, bundle, work-tree root, set — is what makes both hold without either check learning about the other. |
| `--json` for a set is an array of the existing per-subject documents, not an envelope | The per-subject contract is frozen and several worktrees bind to it. An envelope would be a second versioned public shape with no consumer, which this project already refused for error output. An array's every element stays exactly the document a single subject publishes, so no consumer of the existing route sees a change. |
| A directory that is neither a subject nor a set is a caller fault, exit `2` | It publishes a well-formed report with no axis observed today, indistinguishable from a real verdict that nothing could be proven — the false verdict this work exists to remove. The exit taxonomy already classifies a subject path naming nothing as the caller's, and this is the same fault one step deeper. A *file* keeps its current behaviour: `cli.md` records accepting one as deliberate. |
| Every report is rendered before any byte is written | The stream contract says a non-zero exit leaves stdout empty rather than truncated. With N reports, a refusal on the fourth must not follow three published documents. |
| The set is the bundles sitting directly inside the named directory | A recursive walk would make the subject of a run depend on depth nobody declared, and would swallow a bundle filed as an example inside another. Naming the parent is how a deeper bundle is reached. |
