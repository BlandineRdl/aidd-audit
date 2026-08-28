# AI Operating Guidelines

How this project drives AI coding assistants. Specific to this repo; the general playbook lives with the framework.

## House rules

- `pnpm check` is the gate. A change is not done until it exits zero: typecheck, tests, then the boundary rules and the proof those rules still bite.
- Never commit or push unless the session asked for it. A green gate is not a validation; see `memory/vcs.md`.
- A suite sits beside the code it exercises. `tests/` is for what exercises no single file.
- Context boundaries are mechanical, not editorial: `maturity` and `evidence` are peers and never import each other. If `pnpm architecture` passes only because a rule stopped matching, the wall is gone.
- Read the code or the model before asserting behavior. This product refuses to claim what it cannot observe; the same standard applies to what is said about it.

## Validation depth

- Any change to `src/`: `pnpm check`.
- Before a push: `pnpm check`, then `pnpm build`.
- A new boundary rule, or one widened to a new folder: add its sentinel in `scripts/prove-boundary-rules.mjs`, or it is unproven there.
- A new guard: neuter it, watch its test go red, restore. A guard whose test was never seen to fail is not covered.

## When the AI drifts

- The memory bank under `aidd_docs/memory/` is the shared state. When an answer contradicts it, one of the two is wrong — settle that before writing code.
- Restate the objective as one observable outcome, then `/clear`.
