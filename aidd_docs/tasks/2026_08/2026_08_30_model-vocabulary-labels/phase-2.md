---
status: done
---

# Instruction: Human rendering and documentation

## Architecture projection

> Tree of the final files. ✏️ modify

```txt
src/cli/renderers/human.renderer.ts       ✏️ append model descriptions to observed and required scale terms
plugins/aidd-evaluation/skills/aidd-evaluation/SKILL.md ✏️ consume report vocabulary rather than a hardcoded glossary
README.md                                  ✏️ show the explanatory terminal output
aidd_docs/memory/cli.md                    ✏️ record the model-to-report-to-renderer boundary
```

## Tasks to do

### `1)` Make CLI prose legible

> Render each known scale value with its model description while retaining the raw token.

1. Use only the report vocabulary in the renderer.
2. Render set members clearly and leave numeric values untouched.
3. Preserve the existing evidence-gap and practice-gap distinction.

### `2)` Align consumers and docs

> Remove the skill’s duplicated glossary and document the richer output.

1. Instruct the skill to explain terms from the published report vocabulary.
2. Update README examples and memory.
3. Pin terminal and JSON output through tests.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `key-steps` and `behavior` appear with their model descriptions in prose. |
| 1 | Numeric thresholds remain numeric and an unknown term cannot be invented by the renderer. |
| 2 | The skill has no hardcoded AIDD term glossary. |
| 2 | JSON and human-renderer tests prove vocabulary comes from a loaded custom model. |
