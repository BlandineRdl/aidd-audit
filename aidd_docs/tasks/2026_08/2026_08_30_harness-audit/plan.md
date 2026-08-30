---
objective: "`aidd-audit harness <path>` publishes the measured cost and shape of a Claude harness, in two tiers and two scopes, with named, explicitly chosen findings."
status: pending
---

# Plan: harness audit

## Overview

| Field      | Value                                                          |
| ---------- | -------------------------------------------------------------- |
| **Goal**   | A second command that measures what a harness costs, and grades none of it |
| **Source** | [`spec.md`](./spec.md)                                          |

## Phases

| #   | Phase                        | File                         |
| --- | ---------------------------- | ---------------------------- |
| 1   | walls-before-code            | [`phase-1.md`](./phase-1.md) |
| 2   | measurement-domain           | [`phase-2.md`](./phase-2.md) |
| 3   | claude-loading-convention    | [`phase-3.md`](./phase-3.md) |
| 4   | command-and-renderings       | [`phase-4.md`](./phase-4.md) |
| 5   | published-behaviour          | [`phase-5.md`](./phase-5.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://code.claude.com/docs/en/context-window.md | What Claude reads at session start, and in what order. Settled the two tiers: a rule carrying `paths:` loads on demand, a rule without it loads at session start. Settled `@` imports as recursive to a depth of 4, resolved relative to the importing file, and ignored inside backticks. Settled that skills, agents and commands contribute their frontmatter description at start and their body only on invocation. Settled that `settings.json` never enters context. |
| `gpt-tokenizer@4.0.0` on npm, and a bundling probe run against esbuild at the project's own target | MIT, zero dependencies, pure JavaScript, ESM, no network on the counting path. `import { countTokens } from 'gpt-tokenizer/encoding/o200k_base'`. Adds ~2.76 MB to `dist/cli.js` and ~100 ms to startup; a lazy import does not avoid either, because esbuild inlines a dynamic import into the same single file. The WASM alternatives bundle and then fail at run time with `Dynamic require of "path" is not supported`. |
| `@anthropic-ai/tokenizer` README | Disqualified by its own words: no longer accurate as of the Claude 3 models. Last published 2023, CJS only, and it pulls the WASM package. Measured 6.4% away from both open encodings on this repository's own files — a different wrong answer, not a better one. |

## Decisions

| Decision | Why |
| -------- | --- |
| A new `src/harness/` context, not a fifth axis and not a new field on the assessment report | The existing harness axis answers presence and feeds a level. This answers cost and feeds nobody's verdict. Putting a measurement into a document whose every other number decides a level would make it read as one. |
| The walls are widened and proven before the first line of the context is written | Three of the nine dependency-cruiser rules name contexts literally, so a new context is born outside them: nothing would stop `src/harness/` importing `cli`, and nothing would stop `assessment` importing it. A rule that matches nothing reports success, so each widening needs its own sentinel in its own folder. |
| The context declares its own tree seam rather than importing `evidence/adapters/harness/harness-tree.ts` | Reusing it makes a new context depend on another's concrete infrastructure, and forbidding that later would cost another rule and another sentinel. Re-declaring a thirteen-line interface is cheaper than the wall it would otherwise need. |
| `o200k_base`, eagerly imported, its name printed beside every figure | The two candidate encodings differ by up to a third on the same bytes, and the cheaper one overcounts this repository's French files by eight to ten percent while looking correct on the English ones. A bias that moves per file destroys exactly the file-to-file comparison the length metric exists for. |
| Duplication is exact repetition of eight-word sequences, not of whole lines | Measured on this repository: whole lines find one shared line in five hundred and eighty-two and the metric ships looking broken. The same measurement over word sequences finds two shared runs between the testing rule and the testing memory, and seven between the comment rule and the coding-assertions memory — the pairs a reader would name. |
| The context is named for the thing it measures, and shares that word with an existing folder on purpose | `src/evidence/adapters/harness/` already exists and answers which harness capabilities are *present*, feeding a maturity axis. `src/harness/` answers what the harness *costs*, and feeds no verdict. They sit at different depths, no dependency-cruiser pattern confuses them, and the command the user types is `harness`. The collision is a reading hazard rather than a mechanical one, so it is closed in writing: whoever documents the new context states both, side by side, and says which question each answers. A third word invented to avoid the overlap would name the concept worse to solve a problem a sentence solves. |
| The subject reading stops at the subject root; the ancestor walk belongs to the machine reading | Claude walks up the directory tree loading a context file at every level, with no documented ceiling. Following that walk under the subject heading would make the published figure depend on where the repository happens to sit on disk, which contradicts the reproducibility the same report claims. |
