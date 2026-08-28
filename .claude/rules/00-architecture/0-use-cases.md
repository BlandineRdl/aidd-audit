---
paths:
  - "src/**/*.usecase.ts"
---

# Use Cases

One application behavior, exposed through a primary port.

## A use case may

- Orchestrate domain behavior.
- Apply the business rules it owns.
- Compose domain results.
- Return an application result.

## A use case must not

- Parse files or external formats.
- Touch filesystem, Git, network, vendor SDKs.
- Hold infrastructure logic.
- Validate a whole configuration or model.

## Structure

- The exported function reads as business flow.
- Never as an implementation algorithm.
- Keep it small enough to scan.
- Never inline parsing, comparison, or validation mechanics.
- Extract only meaningful domain operations.

## Domain inputs

- Assume invariants enforced at construction.
- Never defend against malformed domain models.
- Validate in the adapter, parser, or loader.
- Still reject application input your behavior owns.

## Boundaries

- Depend inward on domain concepts.
- Depend outward through ports only.
- Never import a concrete adapter.
- Place a rule by its owning concept.
- Never by where the data sits.
