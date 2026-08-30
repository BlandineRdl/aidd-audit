---
status: done
---

# Instruction: Publish and narrate diagnostics

## Architecture projection

> Tree of the final files. ✏️ modify

```txt
src/
├── assessment/
│   └── contracts/assessment-report.contract.ts ✏️ publish per-axis diagnostics in schema v1
└── cli/
    └── renderers/
        ├── json.renderer.ts            ✏️ project diagnostics through the JSON allowlist
        └── human.renderer.ts            ✏️ render a French evidence-gap explanation
plugins/aidd-evaluation/
└── skills/aidd-evaluation/SKILL.md     ✏️ narrate published diagnostics without inference
README.md                                ✏️ document the informative evidence-gap output
```

## Tasks to do

### `1)` Add diagnostics to the public report

> Expose the diagnostic with the axis requirement that needs it, while retaining `schemaVersion: 1`.

1. Extend only the unproven requirement shape with an optional diagnostic.
2. Map collector diagnostics by axis during report composition.
3. Add JSON projection so no unallowlisted field leaks.

### `2)` Render and explain the reason

> Replace the generic "demandé à" sentence when a structured diagnostic is present.

1. Render active-day shortfall in French, with observed and required counts.
2. Retain the generic collector list for unknown axes without a diagnostic.
3. Instruct the plugin skill to treat diagnostics as report facts, never as a practice recommendation.
4. Update the README example and explanation.

### `3)` Prove the public behavior

> Pin the JSON and prose surfaces independently.

1. Assert the structured JSON diagnostic for the shortfall.
2. Assert the French prose names three observed days and five required days.
3. Assert no diagnostic appears when parallelism is observed or when forge failure owns the absence.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `--json` includes the typed active-day diagnostic while retaining `schemaVersion: 1`. |
| 2 | The human renderer says the sample is insufficient and names both counts; it never calls it a practice gap. |
| 2 | An ordinary `UNKNOWN` axis without a diagnostic retains the generic collector explanation. |
| 3 | Tests cover the JSON contract, the human output, and the forge collector threshold on both sides. |
