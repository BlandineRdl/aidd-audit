# Testing

The standards live in `.claude/rules/tests.md`. What follows is specific to the
product.

- A connector is tested against a recording of the real source, never a
  hand-written mock.
- Coverage is a signal, not a target. A pull request that raises it while
  removing an assertion is a regression.
- The pipeline is tested for replayability: the same batch twice does not
  produce two records.
