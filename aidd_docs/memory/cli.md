# CLI

The command-line tool: its commands, inputs, and distribution.

## Commands

- `aidd-audit assess <path>` — assess a repository or a fixture bundle and report its highest proven maturity level. The single command of the MVP.

**A live repository cannot be assigned a level in the MVP, and this is a ceiling, not a bug.** `intervention` counts corrective commits made after a change was opened; an opening event is a forge concept, and a forge API is out of MVP scope. No local history recovers it, merge-based included — a merge records that a branch landed, never what followed review. `size` needs the same change boundaries and so is observable only where merge commits preserve them, which excludes squash and rebase histories. Every level of `aidd.yml` declares all four axes, so one `UNKNOWN` axis is enough: `assess <a repository>` reports `proven: null`, and `assess <a bundle>` is what classifies. The renderer path for `proven: null` is therefore the live command's normal output, not its edge case. Lifted by a forge collector, post-MVP, behind the same port.

## Interface

- `--json` renders the frozen `assessment-report.contract` instead of the human explanation. It is the contract adapters and tests bind to.
- `--model path/to/custom.yml` overrides the built-in `aidd.yml`.
- Two renderers, no business logic in either: `json.renderer` (the contract) and `human.renderer` (the explanation).
- `json.renderer` projects the contract field by field rather than stringifying the report it is handed, so a field the contract does not declare never reaches the published output. Stable key order falls out of that allowlist for free; it is a consequence, not the reason, and no consumer should read meaning into JSON key order.
- `--json` **refuses** a report holding a non-finite number instead of publishing it. JSON renders `NaN` and `Infinity` as `null`, and `null` in this contract means absence — `observed: null` is "not observed", `proven: null` is "no level established". Publishing one would fabricate an evidence gap no collector reported. There is no faithful substitute, so the renderer throws `UnrenderableReportError` naming the field's path. Refusing is not business logic: it decides nothing about maturity, it declines to publish a document it cannot publish truthfully.
- The human output must expose the blocking axis and its evidence status, so that "not mature enough" and "we don't know yet" never read as the same conclusion.
- When `proven` is null the renderer says the subject could not be classified and names what is missing. It never prints White, and never renders the result as lower than a level: "no proven level" is above the scale's floor, not below it.

## Distribution

- **Not published.** `package.json` is `private: true`. The tool is built and run locally: `pnpm build`, then the `aidd-audit` bin from `dist/cli.js`.
- The package name `aidd-audit` exists because `aidd` is already taken on npm by an unrelated package.
- tsup produces one bundled entrypoint, so publishing later needs no restructuring — only dropping `private` and adding `files`.

## Boundary

`cli/` is a driving adapter: it parses input, invokes `assess-maturity.usecase`, and renders the public contract. Nothing else. A Claude plugin will be a second driving adapter post-MVP, over the same core.
