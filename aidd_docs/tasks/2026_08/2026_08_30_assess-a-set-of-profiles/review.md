# Review: Assess a set of profiles

- **Verdict**: approve
- **Diff**: `HEAD...working tree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_30
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — The subject becomes a list

- [x] `1` The bundle marker and predicate have one production home; the adapter imports it without changing its collection behaviour — `src/evidence/adapters/fixture-bundle/bundle-manifest.ts:5-12`; `src/evidence/adapters/fixture-bundle.adapter.ts:4,21`.
- [x] `2` Resolution follows file, bundle, work-tree root, set, refusal; it returns direct child bundles in stable name order, preserves a work-tree root, and reports an unusable directory as a caller fault — `src/cli/subjects/resolve-subjects.ts:25-47`; `src/cli/subjects/resolve-subjects.test.ts:42-165`.
- [x] `3` Many-report JSON projects each report with the frozen single-report projection, while prose joins complete single-report renderings with an unambiguous separator — `src/cli/renderers/json.renderer.ts:14-30`; `src/cli/renderers/human.renderer.ts:15-37`; `src/cli/renderers/json.renderer.test.ts:450-478`; `src/cli/renderers/human.renderer.test.ts:654-683`.
- [x] `4` The command resolves before model loading, assesses every resolved member with its own repository-root answer, renders all reports before one stdout write, preserves lone-subject output, and keeps a one-member set as a set — `src/cli/commands/assess.command.ts:87-142`; `src/cli/commands/assess.command.test.ts:98-240`.

### Phase 2 — Acceptance and memory

- [x] `1` The reference-profile set is asserted to be name-ordered and document-for-document equal to individual assessments — `tests/cli/reference-profiles.test.ts:91-108`.
- [x] `2` The built-binary process contract pins exit `2`, empty stdout, and the caller path for an unassessable directory — `tests/cli/process-contract.test.ts:87-103`.
- [x] `3` CLI memory records the rule order, set shapes, non-goals, output atomicity, and exit taxonomy; the codebase map locates the resolver and shared marker predicate — `aidd_docs/memory/cli.md:7-13,62,71,78-83`; `aidd_docs/memory/codebase-map.md:32-34`.

## Findings

None.

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (7/7) |
| Files checked | `src/cli/commands/assess.command.ts`, `src/cli/subjects/resolve-subjects.ts`, `src/cli/renderers/json.renderer.ts`, `src/cli/renderers/human.renderer.ts`, `src/evidence/adapters/fixture-bundle/bundle-manifest.ts`, `src/evidence/adapters/fixture-bundle.adapter.ts`, changed tests, `aidd_docs/memory/cli.md`, `aidd_docs/memory/codebase-map.md` |
| Unchecked     | none |
| Unplanned     | none |
