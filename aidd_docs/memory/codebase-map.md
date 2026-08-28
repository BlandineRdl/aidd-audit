# Codebase Map

The macro layout: the top-level areas and what each holds. A map to navigate, not the full tree.

**Status: `levels/`, `profiles/`, `aidd_docs/`, `aidd.yml`, `src/` and `tests/` exist; `src/assessment/usecases` and `src/cli/` are still planned** — the target layout is frozen in `aidd_docs/INSTALL.md` under **Folder structure**.

```mermaid
flowchart TD
  ROOT["laivel-up"] --> MODEL["aidd.yml · levels/ — maturity model"]
  ROOT --> FIX["profiles/ — acceptance fixtures"]
  ROOT --> DOCS["aidd_docs/ — install guide + memory"]
  ROOT --> SRC["src/ — planned"]
  ROOT --> TESTS["tests/ — planned"]

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
- `src/maturity/`: `engine/` holds the deterministic decision function and, temporarily, the guards that refuse an invalid model; plus the models. There is no `validation/` layer and no loader yet.
- `src/evidence/`: `resolution/resolve-evidence.ts`, its models, and `ports/evidence-collector.port.ts` exist; collection, the fixture adapter, and the live-repository adapter are still **(planned)**.
- `src/assessment/`: `contracts/assessment-report.contract.ts` exists; the orchestration between maturity and evidence is still **(planned)**. Owns no maturity or evidence rules.
- `src/cli/` **(planned)**: `assess` command and `json` / `human` renderers.

## Entry points

- `src/cli/assess.command.ts` **(planned)** — the only executable entry point in the MVP.
- A Claude plugin adapter is post-MVP and must remain a thin driving adapter over the same core.

## Conventions

**folder = business context · name = concept · suffix (when present) = architectural role and searchable metadata**

Examples:

`engine/maturity-engine.ts` · `resolution/resolve-evidence.ts` · `assess-maturity.usecase.ts` · `yaml-maturity-model.adapter.ts` · `evidence-collector.port.ts` · `assessment-report.contract.ts`

A suffix names the role a file actually plays, never the folder it landed in. `usecases/` is for application behavior reached through a primary port — something that loads, collects, or sequences. Pure domain decisions live under their own concept: `engine/maturity-engine.ts`.
