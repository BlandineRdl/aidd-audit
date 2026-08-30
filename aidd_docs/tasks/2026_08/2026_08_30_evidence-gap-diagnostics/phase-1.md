---
status: done
---

# Instruction: Preserve collector diagnostics

## Architecture projection

> Tree of the final files. ✏️ modify

```txt
src/
├── evidence/
│   ├── adapters/
│   │   ├── forge-repository.adapter.ts              ✏️ emit the active-day shortfall per axis
│   │   └── forge-repository/pull-request-history.ts ✏️ retain the observed and required sample sizes
│   ├── models/
│   │   ├── collector-provenance.model.ts            ✏️ carry completed per-axis diagnostics
│   │   └── observation.model.ts                     ✏️ keep collection output typed with diagnostics
│   ├── ports/evidence-collector.port.ts             ✏️ expose diagnostics from a collector run
│   └── usecases/collect-evidence.usecase.ts         ✏️ preserve diagnostics alongside provenance
└── assessment/
    └── composition/compose-assessment-report.ts     ✏️ receive diagnostic facts without deciding maturity
```

## Tasks to do

### `1)` Represent an explicit non-observation reason

> Define a discriminated diagnostic for insufficient active days, including collector, axis, observed count and minimum count.

1. Add the diagnostic model at the evidence boundary.
2. Make completed collector results carry zero or more diagnostics separately from observations.
3. Preserve it through evidence collection and assessment composition.

### `2)` Emit the forge parallelism shortfall

> Return a diagnostic whenever merged pull requests cover fewer than five distinct active days, while continuing to emit no parallelism observation.

1. Return the active-day count from forge metric derivation.
2. Emit the diagnostic only for the affected axis and only when the value is withheld for that threshold.
3. Keep failed forge runs separate: failure provenance remains the source of their reason.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | A completed collector can report diagnostics without fabricating an observation or changing evidence resolution. |
| 2 | Fewer than five active PR days yields an `INSUFFICIENT_ACTIVE_DAYS` diagnostic with the actual count and threshold; five or more yields none. |
| 2 | A failed forge run reports its existing failure reason and no sample diagnostic. |
