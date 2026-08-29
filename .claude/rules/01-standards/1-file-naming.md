---
paths:
  - "src/**/*.ts"
---

# File Naming

A file's folder says which context owns it. Its name expresses the concept; a suffix, when present, expresses an architectural role.

## Placement

- Folder names the business context.
- Suffix names the architectural role.
- Name a suffix after the role played.
- Never after the folder it sits in.
- A pure decision belongs outside `usecases/`.
- A subfolder names one responsibility and makes the layout say it.
- Holding a single concept is fine when that responsibility is nameable.
- Never a bucket named for what it collects: `utils`, `helpers`, `common`.
- A suite sits beside the code it exercises.
- Never a folder mirroring `src/`, never a folder named after a kind of test.
- A suite exercising no single file lives in `tests/`.

## Suffixes

- `.usecase.ts` reached through a primary port.
- `.port.ts` an outbound boundary interface.
- `.adapter.ts` a concrete port implementation.
- `.contract.ts` a versioned public shape.
- `.model.ts` a domain type or value.
- `.error.ts` one exported error class.
- `.renderer.ts` turns a report into one output surface's text, no business logic.
- `.test.ts` one suite.
- `.test-adapter.ts` a port implementation that never ships.
- `.test-fixture.ts` shared test data, never a suite.

## Names

- kebab-case, lowercase, no abbreviations.
- One exported concept per file.
- Filename states the exported concept.
- A suite carries its subject's full name.
- Never add a generic suffix to classify a pure domain operation.
- `test` opens the suffix of everything excluded from the production graph.
- Never give a shipping file one of those suffixes.
