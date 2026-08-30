---
paths:
  - "src/**/*.ts"
---

# Architecture Decisions

`aidd_docs/memory/architecture.md` records why each boundary sits where it does. Read it before
changing one.

## Read it before

- Adding a context, a folder under a context, or a port.
- Moving a file across folders.
- Making one context reach another.
- Introducing an import of `node:fs`, a process spawn, or a vendor SDK.

## What you get wrong without it

- Which folder names the three `domain-has-no-*` rules match. A new folder of pure functions is
  outside all of them until it is added by hand, and the gate stays green while the wall is gone.
- Why a seam that looks like a port is not one, and why re-declaring a small interface beats
  importing another context's.
- Which walls the moved file just walked out from under. Path-matched rules stop applying in
  silence.

Run `pnpm architecture` after any of it. A rule with no sentinel is a rule nobody has checked.
