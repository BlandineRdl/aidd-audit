# Codebase Map

The macro layout: the top-level areas and what each holds. A map to navigate, not the full tree.

**Status: `levels/`, `profiles/`, `aidd_docs/`, `aidd.yml`, `src/` and `tests/` exist, including both `src/cli/renderers/`; `src/assessment/usecases` and `src/cli/assess.command.ts` are still planned** — the target layout is frozen in `aidd_docs/INSTALL.md` under **Folder structure**.

```mermaid
flowchart TD
  ROOT["laivel-up"] --> MODEL["aidd.yml · levels/ — maturity model"]
  ROOT --> FIX["profiles/ — acceptance fixtures"]
  ROOT --> DOCS["aidd_docs/ — install guide + memory"]
  ROOT --> SRC["src/"]
  ROOT --> TESTS["tests/"]

  SRC --> MAT["maturity/"]
  SRC --> EV["evidence/"]
  SRC --> AS["assessment/"]
  SRC --> CLI["cli/"]

```

## Areas

- `aidd.yml`: the canonical maturity model — the only form the runtime reads. Overridable with `--model`.
- `levels/aidd.md`: human documentation of the model — the seven levels, four axes, and 7×4 grid. Never loaded at runtime.
- `profiles/`: acceptance fixtures — `perceval` → Red, `bohort` → Blue, `leodagan` → Green, `arthur` → Copper. Their deliberate holes are part of the specification; see `testing.md`.
- `aidd_docs/`: `INSTALL.md` holds the frozen technical vision and execution plan; `memory/` is this bank.
- `scripts/`: gate tooling, not product code. `prove-boundary-rules.mjs` proves every dependency-cruiser rule still bites; see `coding-assertions.md`.
- `src/maturity/`: `engine/` decides, and keeps the guards that refuse an invalid hand-built model; `loading/` turns a YAML file into a model the engine may trust — shape, then invariants; `models/` holds the types and the rules shared by both.
- `src/evidence/`: `resolution/resolve-evidence.ts`, its models, `ports/evidence-collector.port.ts` and `usecases/collect-evidence.usecase.ts` exist; the fixture adapter and the live-repository adapter are still **(planned)**. The use case runs collectors and resolves what they observed; it owns no axis semantics and no coverage arithmetic.
- `src/assessment/`: `contracts/assessment-report.contract.ts` exists; the orchestration between maturity and evidence is still **(planned)**. Owns no maturity or evidence rules.
- `src/cli/`: `renderers/json.renderer.ts` and `renderers/human.renderer.ts` exist, with `renderers/unrenderable-report.error.ts` guarding the JSON boundary. The `assess` command is still **(planned)**.

## Entry points

- `src/cli/assess.command.ts` **(planned)** — the only executable entry point in the MVP.
- A Claude plugin adapter is post-MVP and must remain a thin driving adapter over the same core.

## Conventions

**folder = business context · name = concept · suffix (when present) = architectural role and searchable metadata**

Examples:

`engine/maturity-engine.ts` · `resolution/resolve-evidence.ts` · `assess-maturity.usecase.ts` · `load-maturity-model.ts` · `evidence-collector.port.ts` · `assessment-report.contract.ts`

A suffix names the role a file actually plays, never the folder it landed in. `usecases/` is for application behavior reached through a primary port — something that loads, collects, or sequences. Pure domain decisions live under their own concept: `engine/maturity-engine.ts`.
