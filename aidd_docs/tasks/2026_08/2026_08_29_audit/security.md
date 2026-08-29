---
name: audit
description: Codebase audit report — security pillar (re-run after remediation)
argument-hint: N/A
---

# Codebase Audit: security — aidd-audit

Both findings of the first run are closed at their source: the `git` child no longer honours the subject repository's choice of program, and the inherited environment can no longer name one.

- **Date**: 2026_08_29 (re-run)
- **Scope**: `src/`, `scripts/`, `aidd.yml`, `package.json` — whole codebase
- **Health**: good
- **Findings**: 0 critical, 0 warning, 0 minor

## Findings

No rows survive. Both previous warnings were fixed and re-verified against the code, not against the commit message.

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| — | security | — | none | — | — |

## Top actions

None. The one thing worth watching rather than fixing: `HARDENED_CONFIGURATION` and `REDIRECTING_GIT_VARIABLES` are both closed lists, and a closed list is only as good as the day it was written. A new `git` invocation inherits the first for free; a newly-invented Git environment variable that names a program does not join the second on its own.

## Coverage

Re-verified, with the fix read rather than assumed:

- **Repository-supplied execution, closed.** `git-process.ts:56` prepends `-c core.fsmonitor=false -c core.hooksPath=/dev/null` to *every* invocation, at the one place `git` is spawned, so a new command cannot forget it. `git-history.ts:304` adds `--no-ext-diff --no-textconv` to the one invocation that produces a diff, which is where the external-diff and textconv drivers would have been read; neither has a config counterpart that a global `-c` could disarm. A repository received as a directory can no longer name a program this tool runs.
- **Environment redirection, closed.** `git-process.ts:26` now strips three families instead of one: location (`GIT_DIR` … plus `GIT_CEILING_DIRECTORIES` and `GIT_DISCOVERY_ACROSS_FILESYSTEM`, which were also missing), configuration (`GIT_CONFIG`, `GIT_CONFIG_COUNT`, `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_SYSTEM`), and command (`GIT_EXTERNAL_DIFF`, `GIT_SSH`, `GIT_SSH_COMMAND`, `GIT_ASKPASS`, `GIT_PAGER`, `GIT_EDITOR`, `GIT_SEQUENCE_EDITOR`). Author and committer identity are still deliberately left alone, and the comment now says which three families and why rather than "location-scoped".
- **The 575 tests that constrained this code still pass**, including the cancellation suites that install a `git` shim on `PATH` and a git alias — so the hardening flags did not change what any command answers.

Checked again and still clean: `execFile` throughout with no shell and no user-controlled argv; no secret literal anywhere in `src/`, `tests/`, `scripts/`, `aidd.yml` or `profiles/`; no `eval`, `Function` or JSON reviver; `yaml@2`'s default `maxAliasCount` bounding the `--model` path; no HTTP surface, authn/authz, CORS or TLS to gate.

- **Scanned**: security
- **Skipped**: none
