# Review: Model vocabulary labels

- **Verdict**: approve
- **Diff**: `ae47425867f99f1359070de34395a94c5277f11b...worktree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_30
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Model and report vocabulary

- [x] Every ordinal value and set member requires an exact model-owned non-empty description; missing, unknown and non-string entries are rejected. — src/maturity/loading/model-shape.ts:118
- [x] The canonical AIDD model supplies French descriptions for every ordinal value and harness member. — aidd.yml:28
- [x] The report projects per-axis vocabulary and the JSON allowlist preserves raw values with matching descriptions. — src/assessment/composition/compose-assessment-report.ts:75; src/cli/renderers/json.renderer.ts:52
- [x] Maturity decision inputs and engine calls remain unchanged by vocabulary projection. — src/assessment/composition/compose-assessment-report.ts:51

### Phase 2 — Human rendering and documentation

- [x] The prose renderer consumes only `report.vocabulary`, explains ordinal and set terms, leaves numeric values untouched, and leaves unknown report terms raw. — src/cli/renderers/human.renderer.ts:356
- [x] The skill uses published `vocabulary` and contains no second AIDD term glossary. — plugins/aidd-evaluation/skills/aidd-evaluation/SKILL.md:92
- [x] The README terminal example shows raw tokens alongside model descriptions. — README.md:97
- [x] A spawned CLI test loads a temporary custom YAML through `--model` and asserts its vocabulary in both JSON and prose. — tests/cli/process-contract.test.ts:68

## Findings

None.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (8/8) |
| Files checked | aidd.yml, src/maturity/models/maturity.model.ts, src/maturity/loading/model-shape.ts, src/maturity/loading/maturity-model-shape.test.ts, src/assessment/contracts/assessment-report.contract.ts, src/assessment/composition/compose-assessment-report.ts, src/assessment/composition/compose-assessment-report.test.ts, src/cli/commands/assess.command.test.ts, src/cli/renderers/human.renderer.ts, src/cli/renderers/human.renderer.test.ts, src/cli/renderers/json.renderer.ts, src/cli/renderers/json.renderer.test.ts, tests/cli/process-contract.test.ts, plugins/aidd-evaluation/skills/aidd-evaluation/SKILL.md, README.md, aidd_docs/memory/cli.md |
| Unchecked | none |
| Unplanned | Existing dirty-worktree changes outside this plan (plugin packaging, forge diagnostics, colour/rendering restructuring and unrelated documentation) were excluded. Targeted spawned CLI test passed. |
