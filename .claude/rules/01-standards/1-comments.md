---
paths:
  - "src/**/*.ts"
  - "tests/**/*.ts"
  - "scripts/**/*.mjs"
---

# Comments

Comments are exceptional. Code that needs one usually needs a better name.

## No docblocks

Comments are `//`. Never `/** */`.

In TypeScript the docblock has lost its job — the signature already states the parameters, the return and the shape — so what survives is a form that invites restating the name. `/** Builds dist/cli.js once */` above `buildCliBundle` is the whole failure mode.

It is also where narration hides once line comments are governed. Removing the form removes the hiding place.

File-header prose is not an exception. What a module is for belongs in `aidd_docs/`, which this project already keeps as its home; a header that repeats it is duplication, and one that does not is a design note in the wrong place. One line, or nothing.

## A block declares its purpose

Two or more consecutive `//` lines must open with one tag, on the first line:

- `INVARIANT:` — a property that must remain true.
- `SAFETY:` — prevents an incorrect or unsafe outcome.
- `COMPAT:` — a constraint imposed from outside: a public contract, a consumer, an external tool's behaviour.
- `LIMITATION:` — something this code does not hold, and where the fix belongs.

```ts
// INVARIANT: UNKNOWN must never be converted into a practice gap.

// SAFETY: do not publish a partial capability set when a rankable member
// is undecidable — the missing member would read as a gap nobody observed.

// COMPAT: `git ls-files` lists only what sits under its working directory,
// while the history walk covers the whole tree.

// LIMITATION: BlockingRequirement carries no requirement identity, so an
// ambiguous blocker names no threshold. Fix belongs in the contract.
```

A single `//` line needs no tag. Use one where the code is genuinely non-obvious, never to narrate it.

## What a tag may not carry

- Never the history of how the code arrived: what was tried, what a review said, what an earlier version did. That belongs in the commit body and in `aidd_docs/`.
- Never a restatement of a name, a type, or the control flow beneath it.
- Never information already stated by the code, by another comment, or by project documentation.

`LIMITATION:` is where history tries to hide, because "why this is imperfect" and "how it got this way" read alike. It names what is not held and where the fix goes. Nothing else.

## The tag is a claim

`INVARIANT:` in front of three paragraphs of narration satisfies the check and defeats it. The tag is falsifiable on purpose: it invites *name the property*. A mislabelled block is a stronger review target than an untagged one.

## Enforcement

`pnpm comments` — `scripts/check-comment-tags.mjs`, run by `pnpm check`. It judges **only the files the current branch changed**, so the rule bites on new code without demanding one migration of the whole tree.

It checks two things and reads nothing: no `/**`, and a run of two or more `//` lines opens with a tag. Everything else this rule asks for is a review finding.
