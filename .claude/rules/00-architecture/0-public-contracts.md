---
paths:
  - "src/**/*.contract.ts"
  - "src/**/*.port.ts"
---

# Public Contracts

Stable boundaries consumed outside their implementation context.

- Keep contracts independent from internal types.
- Version a breaking shape explicitly.
- Make important invalid states unrepresentable.
- Never expose fields that can contradict.
- Preserve domain distinctions consumers need.
- Never make consumers rebuild domain rules.
- State the obligations an implementer must honour.
- A duty the type cannot carry still belongs in writing.
- Keep contract types readonly.
- A public shape change is breaking.
- Prove otherwise before assuming compatibility.
