# Review: Evidence-gap diagnostics

- **Verdict**: approve
- **Diff**: `ae47425867f99f1359070de34395a94c5277f11b...worktree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_30
- **Findings**: 0 critical, 0 warning, 1 minor

## Phases

### Phase 1 — Preserve collector diagnostics

- [x] A completed collector can report diagnostics without fabricating an observation or changing evidence resolution. — src/evidence/ports/evidence-collector.port.ts:17
- [x] Fewer than five active PR days yields an `INSUFFICIENT_ACTIVE_DAYS` diagnostic with the actual count and threshold; five or more yields none. — src/evidence/adapters/forge-repository.adapter.ts:127
- [x] A failed forge run retains its failure provenance and carries no sample diagnostic. — src/evidence/usecases/collect-evidence.usecase.test.ts:207

### Phase 2 — Publish and narrate diagnostics

- [x] `--json` includes the typed active-day diagnostic while retaining `schemaVersion: 1`. — src/assessment/contracts/assessment-report.contract.ts:14
- [x] The human renderer calls the active-day shortfall an evidence gap, names both counts, and never calls it a practice gap. — src/cli/renderers/human.renderer.ts:314
- [x] An ordinary `UNKNOWN` axis without a diagnostic retains the generic collector explanation. — src/cli/renderers/human.renderer.ts:299
- [x] Tests cover the JSON contract, human output, and forge threshold on both sides, including failure-owned absence. — src/cli/renderers/json.renderer.test.ts:88, src/cli/renderers/human.renderer.test.ts:175, src/evidence/adapters/forge-repository.adapter.test.ts:122, src/evidence/usecases/collect-evidence.usecase.test.ts:207

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | rot | 2 | src/cli/renderers/human.renderer.ts:323 | The fallback comment still says that only a per-axis reason on `ProvenanceEntry` could explain an unobserved axis, but this change now carries that reason as `RequirementReport.diagnostic`. | Reword the comment to describe the no-diagnostic fallback, or remove it. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (7/7) |
| Files checked | src/evidence/models/collector-diagnostic.model.ts, src/evidence/ports/evidence-collector.port.ts, src/evidence/usecases/collect-evidence.usecase.ts, src/evidence/adapters/forge-repository.adapter.ts, src/evidence/adapters/forge-repository/pull-request-history.ts, src/assessment/composition/compose-assessment-report.ts, src/assessment/contracts/assessment-report.contract.ts, src/assessment/usecases/assess-maturity.usecase.ts, src/cli/renderers/json.renderer.ts, src/cli/renderers/human.renderer.ts, plugins/aidd-evaluation/skills/aidd-evaluation/SKILL.md, README.md, relevant tests |
| Unchecked | none |
| Unplanned | Existing dirty-worktree changes outside the plan's projected files (plugin packaging, CLI styling, README/memory changes) were excluded from this feature review. `pnpm typecheck` and `pnpm format:check` passed; targeted Vitest runs did not complete before timeout. |
