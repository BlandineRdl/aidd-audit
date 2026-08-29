---
name: audit
description: Codebase audit report — dependencies pillar (re-run after remediation)
argument-hint: N/A
---

# Codebase Audit: dependencies — aidd-audit

`pnpm audit` reports nothing. Getting there cost 165 devDependencies, and that trade deserves to be written down rather than celebrated.

- **Date**: 2026_08_29 (re-run)
- **Scope**: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- **Health**: good
- **Findings**: 0 critical, 0 warning, 1 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| 🟢 | dependencies | `package.json:33` | The dev surface went from 224 transitive packages to 389 — a 74% increase — and every one of the 165 arrived with Stryker, which serves one command run by hand. One of them shipped an advisory: `qs` below 6.15.2, moderate, under `@stryker-mutator/core > typed-rest-client`, a client only Stryker's dashboard reporter uses and this project never does. It is overridden and the audit is clean, but the shape of the exchange stands: a low, unreachable, dev-only advisory was traded for a much larger surface that had a moderate one in it on arrival. That is still the right trade for a project whose own memory names mutation testing as the only technique that has caught its defects — it is not a free one, and a second override is the signal to re-open the question. | Nothing to change. Re-read this row if a third Stryker-borne advisory appears: at that point the cost of the tool is being paid in lockfile maintenance rather than in test quality, and running it from a scratch install on demand becomes the better shape. | S |

## Top actions

1. Nothing outstanding. The single row above is a decision to keep visible, not work to schedule — it exists so the next person to run `pnpm audit` knows why the dev tree is three times the size of the one this project's architecture describes.

## Coverage

Scanners re-run and their output read: `pnpm audit --json`, `pnpm outdated`, `pnpm licenses list --prod`.

- **Advisories — closed. `No known vulnerabilities found`.** Two overrides in `pnpm-workspace.yaml`, each with the reason beside it: `esbuild >=0.28.1` for GHSA-g7r4-m6w7-qqqr (arbitrary file read via the dev server on Windows; four transitive paths through `tsup` and `vitest`, no dev server ever started here) and `qs >=6.15.2` for GHSA-q8mj-m7cp-5q26. `pnpm update esbuild -r` alone did **not** move it — tsup and vite both pin ranges stopping short of the fix — so the override is what actually raised the floor.
- **Outdated — one entry left, deliberately.** `lefthook` took its patch (2.1.10 → 2.1.12). `typescript 5.9.3` against 7.0.2 stays, and the decision is now recorded in `architecture.md`'s Stack section: 7.0 is the native-port compiler and a full major, nothing here needs it, and taking it is its own change measured against `pnpm check`. `pnpm outdated` naming it is expected, not a finding.
- **Licenses — one production dependency, `yaml`, ISC.** No GPL, no AGPL, no unknown license in the production tree. Note that `package.json` now declares the package itself MIT and a `LICENSE` file states MIT; those two agree. **Both changed during this session and neither change is mine** — see the run's `report.md`.
- **Supply chain — clean.** Lockfile present and committed; `packageManager` pins `pnpm@11.24.0`; no `git:`, `github:`, `file:` or URL dependency; every entry resolves from the registry with an integrity hash. `pnpm-workspace.yaml` keeps `allowBuilds` explicit, so no package runs an install script without being named.
- **No unused declared dependency.** All eleven are reached: `yaml` by the loader, `@types/node` by `tsconfig`, Biome by `format`, dependency-cruiser by `architecture`, lefthook by `prepare`, tsup by `build`, typescript by `typecheck`, vitest by `test`, `@vitest/coverage-v8` by the on-demand coverage run, and the two Stryker packages by `mutation`.
- **The production surface did not move.** One production dependency, before and after. Everything above is dev.

- **Scanned**: dependencies
- **Skipped**: none
