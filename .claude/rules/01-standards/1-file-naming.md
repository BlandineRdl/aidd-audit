---
paths:
  - "src/**/*.ts"
---

# File Naming

A file's folder says which context owns it, its suffix says what role it plays.

## Placement

- Folder names the business context.
- Suffix names the architectural role.
- Name a suffix after the role played.
- Never after the folder it sits in.
- A pure decision belongs outside `usecases/`.

## Suffixes

- `.usecase.ts` reached through a primary port.
- `.port.ts` an outbound boundary interface.
- `.adapter.ts` a concrete port implementation.
- `.contract.ts` a versioned public shape.
- `.model.ts` a domain type or value.
- `.error.ts` one exported error class.
- `.fixture.ts` shared test data, never a suite.

## Names

- kebab-case, lowercase, no abbreviations.
- One exported concept per file.
- Filename states the exported concept.