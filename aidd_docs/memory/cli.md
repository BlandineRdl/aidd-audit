# CLI

The command-line tool: its commands, inputs, and distribution.

**Status: manifest and toolchain exist (`aidd-audit`, ESM, Node >= 24, pnpm). No `src/` yet.**

## Commands

- `aidd-audit assess <path>` — assess a repository or a fixture bundle and report its highest proven maturity level. The single command of the MVP.

## Interface

- `--json` renders the frozen `assessment-report.contract` instead of the human explanation. It is the contract adapters and tests bind to.
- `--model path/to/custom.yml` overrides the built-in `aidd.yml`.
- Two renderers, no business logic in either: `json.renderer` (the contract) and `human.renderer` (the explanation).
- The human output must expose the blocking axis and its evidence status, so that "not mature enough" and "we don't know yet" never read as the same conclusion.
- Execution requires no network. Ever.

## Distribution

- **Not published.** `package.json` is `private: true`. The tool is built and run locally: `pnpm build`, then the `aidd-audit` bin from `dist/cli.js`.
- The package name `aidd-audit` exists because `aidd` is already taken on npm by an unrelated package. Any doc still saying `npx aidd assess .` is stale on both counts.
- tsup produces one bundled entrypoint, so publishing later needs no restructuring — only dropping `private` and adding `files`.

## Boundary

`cli/` is a driving adapter: it parses input, invokes `assess-maturity.usecase`, and renders the public contract. Nothing else. A Claude plugin will be a second driving adapter post-MVP, over the same core.
