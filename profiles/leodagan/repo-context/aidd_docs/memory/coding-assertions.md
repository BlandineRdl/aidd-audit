# Coding assertions

What the machine checks, as opposed to the standards `.claude/rules/` describes
and a human reviews.

`.claude/hooks/check-assertions.js` runs on every edit and exits 2 on two cases:

- an error assigned to `_` in a Go file
- a database query without a context

The rest of the rules are not executable today. That is deliberate: a hook that
reports false positives ends up disabled, and the two real ones go with it.
