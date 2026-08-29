import { defineConfig } from 'vitest/config'

// INVARIANT: the mutation sweep's view of the suite, and only its view. It drops two things the
// ordinary run needs and a sweep must not have: `tests/`, whose suites spawn the built binary, and
// the `globalSetup` that builds it — a mutant is a change to a source file, and rebuilding `dist/`
// once per mutant would measure tsup rather than the tests. What is left is every co-located suite,
// which is where the decision logic a mutation sweep exists to interrogate is actually proven.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'profiles/**'],
  },
})
