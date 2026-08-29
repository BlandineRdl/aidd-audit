# Architecture

The macro technical shape: contexts, dependencies, and architectural boundaries.

What exists and what is still planned is in `codebase-map.md`. `aidd_docs/INSTALL.md` holds the implementation plan; this file defines the architecture the code must preserve.

## Stack

* TypeScript `strict`, Node.js LTS, ESM. **Held at 5.x deliberately.** 7.0 is the native-port compiler and a full major; nothing in this codebase needs it, and taking it would be its own change measured against `pnpm check`, never a line in a dependency bump. `pnpm outdated` naming it is expected, not a finding.
* No framework or DI container — explicit composition in `cli/`.
* pnpm, pinned through `packageManager`.
* tsup/esbuild bundles one entrypoint, `dist/cli.js`.
* dependency-cruiser mechanically enforces context boundaries.
* YAML is the runtime format of the maturity model. Its parser belongs to `maturity/loading/`.
* No database, ORM or auth of its own. The assessed repository is the input; AIDD owns no persistent state.
* **Network at runtime, through one collector only.** `forge-repository` spawns `gh` and reads the subject's merged pull requests; nothing else in the tool opens a socket. It is built only when the subject declares a GitHub origin, and its failure is an evidence gap rather than a broken run, so every other subject is still assessed with no network at all.

## Shape

A modular monolith with bounded contexts and hexagonal boundaries:

```mermaid id="wjrf9s"
flowchart LR
  CLI["cli — driving adapter"] --> ASSESS["assessment — orchestration"]

  ASSESS --> EV["evidence — collect + resolve"]
  ASSESS --> MAT["maturity — decision engine"]

  EV --> EPORT["collector ports"]
  MAT --> MAD["maturity loading<br/>load-maturity-model.ts"]

  EAD["evidence adapters<br/>fixtures · live repository"] -.->|implement| EPORT
```

No `maturity-model.port.ts` exists, and the loader is therefore **not** an adapter: nothing asks `maturity` for a model through an abstraction yet, so there is no port to implement. It lives in `loading/` and is named for what it does. When a use case needs "give me a maturity model", the port appears with that consumer and this file becomes its YAML implementation. A port with one implementation and no consumer would be a wall with no door.

## Contexts

### `maturity`

Owns maturity calculation: requirements, axes, levels and thresholds. `loading/` turns a YAML file into a model the engine may trust; `assessment` is barred from importing it, as it is from any concrete infrastructure.

`checkMaturity` lives in `engine/`, not in `usecases/`. It takes domain values and returns a domain value; it loads nothing, collects nothing, and sequences no application workflow. Filing it as a use case only forced use-case rules onto a pure decision function — it is the deterministic decision engine the brief names, and the folder says so.

It knows nothing about evidence collection, assessment orchestration, or CLI concerns.

### `evidence`

Owns observation collection and evidence resolution, including collector ports and their adapters.

`resolveEvidence` lives in `resolution/`, not in `usecases/`, for the same reason `checkMaturity` lives in `engine/`: it takes domain values and returns a domain value, loading and collecting nothing.

It knows nothing about maturity calculation, assessment orchestration, or CLI concerns.

### `assessment`

Composes `evidence` and `maturity` to produce an assessment.

It owns orchestration, **not business rules**. Resolution rules remain in `evidence`; maturity rules remain in `maturity`.

Coverage is its own. `axesRequested`, `axesObserved` and `axesConfirmed` describe the report, not the collection: `assessment` derives all three from the axes it requested and the evidence it got back. `evidence` owns collector execution, provenance and resolution, and stops there — it never counts on behalf of a report it does not build.

`composeAssessmentReport` lives in `composition/`, not `usecases/`, for the same reason `checkMaturity` and `resolveEvidence` live outside theirs: it takes domain values — a model, evidence, provenance — and returns one, loading and sequencing nothing. It is also where `evidence/models/collector-provenance.model.ts`'s `CollectorProvenance` is projected to the contract's `ProvenanceEntry`; `assessment` owns that mapping because `evidence` was kept from importing `assessment/contracts` on purpose. `composition/axis-vocabulary.ts` is the peer-to-peer translation in the other direction: it projects the model's `scales` into `evidence`'s `AxisVocabulary`, so a collector never has to know the maturity domain's own types.

`assess-maturity.usecase.ts` is the sequencer: it takes an already-loaded `MaturityModel`, a subject path, a collector set and an `AbortSignal`, and calls `axisVocabularyOf`, then `collectEvidence`, then `composeAssessmentReport` — nothing else. It does **not** load the model itself. `assessment-composes-never-adapts` forbids `assessment/` from importing `*/loading/`, and `scripts/prove-boundary-rules.mjs` proves that exact rule from `src/assessment/usecases/` with a dedicated sentinel — a sequencer that called `loadMaturityModel` would breach a wall the gate actively tests, not just a convention. Resolving `--model` or the packaged default is argument parsing, and belongs to the driving adapter that owns argv: `cli/`. This corrects the earlier prediction, right above, that `assess-maturity.usecase` "will load the model": it never does.

`composition/` and `usecases/` both sit inside the same dependency-cruiser domain rules as `models/`, `contracts/`, `engine/` and `resolution/` — those match by folder name, so a rule widened to reach either folder needed its own sentinel per rule, per folder; see `coding-assertions.md`.

If orchestration starts deciding domain semantics because it has access to both contexts, the boundary has failed.

### `cli`

Driving adapter and composition root.

It parses input, wires concrete adapters, invokes `assess-maturity.usecase`, and renders the public contract.

It contains no business logic.

## Dependency rules

```text id="6e4trr"
cli
 ↓
assessment
 ↙       ↘
evidence  maturity
```

* `maturity` and `evidence` are peers and never import each other.
* Neither imports `assessment` or `cli`.
* `assessment` depends on their public APIs, never their concrete adapters.
* Domain and use-case files never depend on filesystem, Git processes, YAML parsers, or vendor SDKs.
* Concrete infrastructure stays behind ports.
* dependency-cruiser enforces these rules mechanically.

## Public boundary

`assessment-report.contract.ts` is the versioned public contract and includes `schemaVersion`.

It remains distinct from internal assessment models.

Driving adapters consume this contract; they do not reshape domain semantics themselves.

## Runtime boundaries

The maturity model is loaded through `maturity/loading/load-maturity-model.ts` (`loadMaturityModel` / `parseMaturityModel`), the only place in `maturity` that may import `yaml` or `node:fs`. It parses YAML, checks shape and vocabulary, verifies every level covers every declared axis, and guarantees cumulativity before returning a `MaturityModel` the engine may trust without re-checking. A rejection throws `InvalidMaturityModelError`, naming what is wrong.

Evidence is collected through collector ports. Fixture and live-repository collectors implement the same boundary and produce normalised observations.

The live-repository adapter may access the real filesystem and local Git. The fixture-bundle adapter may access the real filesystem, and reads a directory holding a `profile.json`. The forge-repository adapter may spawn `gh` and reach the network; it is the only one that may, and it is constructed only for a subject whose origin declares a GitHub repository.

The two share one `harness` scan, one `size` table and one `autonomy.ts`, because the port promises they are interchangeable and a rule the two computed differently would break that promise. `autonomy.ts` holds the zero-touch share and the single `intervention` value either may reach: the live collector grants it from authorship, the bundle from its record, and the two must agree on the bar and on what clearing it is called. The scan reads a tree through `adapters/harness/harness-tree.ts`, which each adapter supplies — `git ls-files` on one side, a directory walk on the other. That seam is **not** a port: it crosses no context boundary, it abstracts nothing the domain knows about, and both its implementations are adapters. It lives beside them and is named for what it is.

Inside `adapters/harness/`, the split is by question answered, not by size. `harness-scan.ts` decides the four capabilities and delegates every one of them; recognising a coding agent, reading a shell loop's continuation, and matching a context file are three unrelated problems that happened to share a file. The layering is one-way — `shell-loop` over `agent-invocation` over `shell-tokens` — so someone correcting how `CLAUDE.md` is found never opens the tokeniser, and someone working on retry loops cannot reach the context-engineering table. There is deliberately no `shell/` subtree: one file per question is the whole of it, and a lexer, a parser and a variable analysis filed separately would be a framework nobody asked for.

## Maturity model transcription

`aidd.yml` transcribes the 7x4 grid of `levels/aidd.md`. Three readings were forced, and none is derivable from the grid alone:

* **`L-XL` is a minimum of `L`.** Size therefore stops discriminating above Green: Copper, Silver and Gold all require `L`. What separates Green from Copper is parallelism, not size.
* **Harness is set containment, and the sets cumulate explicitly.** Blue requires `prompts` *and* `context-engineering`, Green adds `behavior`, Silver adds `loops`. The grid's cells name only what each level adds; the model spells out the full set so the engine never infers satisfaction from rank alone.
* **The scales live in the model file, not the engine.** `--model` may change scale values and thresholds within the canonical AIDD model schema. It is not a generic rules engine.

Three more were forced by the code rather than by the grid, and went unrecorded until 2026-08-29. Each changes the level of every subject:

* **The bucket bounds of the size axis are invented.** `levels/aidd.md` defines size qualitatively — `S` petite ou triviale, `M` complexité moyenne, `L` multi-étapes, `XL` multi-modules — and `size-buckets.ts` decides with `<100 / <400 / <1000` lines and `<5 / <10 / <25` files. Those six numbers appear nowhere in the model. Reading `XL` as multi-modules was tried and abandoned: what counts as a module is an architectural judgement, its depth in the tree differs between a monorepo and a single application, and no repository declares it machine-readably. On a subject where everything lives under `src/`, counting top-level directories says nothing, and counting one level down made four deliveries in five multi-module. The bounds stay because nothing better-founded is observable, not because the model licenses them. The measurement is in `aidd_docs/tasks/2026_08/2026_08_29_dual-reading-and-forge-collector/size-transcription.md`.
* **The aggregate is a median.** The model says only *"la taille habituelle des features livrées, pas la plus grosse jamais faite"*, which excludes a maximum and names nothing else. A median is one central measure among several, and on a bimodal distribution it lands in the valley between the two modes and describes neither.
* **The window is 180 days.** The model states no period at all. `habituelle` and `un pic isolé ne compte pas` constrain the aggregate, never the span it is taken over.

The grid's "Ce qu'on observe" column is deliberately not encoded: it illustrates, it does not decide.

## Levels are cumulative, and that is checked

A higher rank never asks less than the rank below it, on any axis. `checkMaturity` reports the highest level whose outcome is `MET` and does not re-check the levels beneath it, so a model that dipped would name a level whose predecessors are `NOT_MET` and "highest proven level" would stop meaning what it says.

The AIDD domain is cumulative, so a custom `--model` that is not is not an AIDD model.

`load-maturity-model.ts` enforces it: a level asking less than the rank below it on any axis is rejected before the engine ever sees the model.

## Frozen before the split

Nothing below may be redefined inside a context. Each was frozen because more than one worktree binds to it, and a divergence would only surface at composition time.

* `assessment/contracts/assessment-report.contract.ts` — the versioned public shape. Self-contained on purpose. Its numbers must be finite, and the type cannot say so: `number` admits `NaN`, and branding it would force every producer to change a shape frozen before the split. JSON renders a non-finite number as `null`, which this contract reads as absence, so the invariant is enforced where that ambiguity is created — `cli/renderers/json.renderer.ts` refuses the report rather than publishing a fabricated evidence gap. A producer-side check would be additional, never a replacement: the renderer is the last boundary before publication.
* `evidence/ports/evidence-collector.port.ts` — one interface, three adapters: the fixture bundle, the live repository and the forge. They must stay interchangeable, which is why the window, the sample floors, the size table, the intervention scale and the demonstrated share all live in `adapters/` rather than in any one of them. A collector **must honour `context.signal`**: exceeding its budget is reported as `TIMED_OUT`, never as a silent hang. The type cannot express that duty and `CollectorRun` only records the outcome, so it is written here.
* `evidence/models/observation.model.ts` — a collector emits observations and never resolves a status. `OBSERVED` can prove a requirement, `DECLARED` cannot; that distinction is what separates a fact from a claim. **Reopened on 2026-08-30**, deliberately: an observation now carries the `reading` it answers, `SUSTAINED` or `DEMONSTRATED`, and the `Demonstration` a demonstrated one is weighed by. The alternative was to emit two values for one axis, which `resolveEvidence` would resolve to `CONFLICTING` and lose both — so the model had to change, or the second reading could not exist at all.
* `evidence/models/axis.model.ts` — the vocabulary a collector may speak, handed down by `assessment` from the loaded model. A collector that invents a value off its scale is rejected rather than ranked, at the boundary that maps observations into maturity input — not by resolution, which only decides agreement, and not by the model loader, which answers whether the model itself is valid. A collector that invents a whole *axis* off that vocabulary gets no such error: `resolveEvidence` maps strictly over the requested axes, so an observation naming an undeclared one is silently dropped before `UndeclaredAxisError` could ever see it — the guard exists for a hand-built `Evidence` array, not for anything a real collector can produce.
* `maturity/engine/` and its tests — the decision semantics, split by concept: `maturity-engine.ts` walks levels and picks the proven one, `requirement-outcome.ts` holds the conservative rule, `scale-comparison.ts` compares a value to a threshold. The tests decide when prose disagrees.

## Gotchas

* `levels/aidd.md` documents the maturity model but is never loaded at runtime. Runtime reads `aidd.yml`.
* `profiles/` contains acceptance fixture payloads, not AIDD's own configuration.
* Content inside fixture `repo-context/` must never be interpreted as configuration or evidence about the AIDD repository itself.
