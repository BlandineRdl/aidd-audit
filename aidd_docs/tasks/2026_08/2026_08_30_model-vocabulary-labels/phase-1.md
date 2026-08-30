---
status: done
---

# Instruction: Model and report vocabulary

## Architecture projection

> Tree of the final files. ✏️ modify

```txt
aidd.yml                                             ✏️ define French descriptions for every ordinal value and set member
src/maturity/models/maturity.model.ts                ✏️ model scale descriptions
src/maturity/loading/                                ✏️ parse and validate descriptions against scale vocabulary
src/assessment/contracts/assessment-report.contract.ts ✏️ publish axis vocabulary
src/assessment/composition/compose-assessment-report.ts ✏️ project model vocabulary into the report
```

## Tasks to do

### `1)` Define and validate model-owned descriptions

> Every ordinal value and harness member used by a model has a human description.

1. Extend the YAML shape and immutable maturity model.
2. Reject missing, unknown or non-string description entries.
3. Add the canonical AIDD descriptions.

### `2)` Publish descriptions without changing decisions

> The assessment report carries a per-axis vocabulary derived from the loaded model.

1. Add report contract types and JSON allowlist projection.
2. Compose descriptions by axis without changing evidence, thresholds or outcomes.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | A model with a missing or off-scale description is rejected; the canonical model loads. |
| 2 | JSON preserves raw values and includes only the matching model descriptions. |
| 2 | Maturity evaluation returns the same level and requirement outcomes as before. |
