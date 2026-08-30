import { defineConfig } from 'vitest/config'

// INVARIANT: unit suites sit next to the code they exercise, under src/. tests/ keeps only
// what has no such neighbour: the conformance of aidd.yml itself, the suites
// that spawn the shipped binary, and the acceptance suite over the profiles.
//
// profiles/ holds acceptance fixtures: source files belonging to fictional
// developers, including their own *.test.ts. They are input data, never this
// project's suite. Naming the two roots explicitly is what keeps them out.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'profiles/**'],
    // dist/ is shared and rebuilt with clean: true, so no suite may build it.
    globalSetup: ['tests/build-cli-bundle.test-setup.ts'],
    // SAFETY: Several suites synchronously spawn the CLI and create temporary Git repositories.
    // Running them together causes resource contention, which turns correct tests into timeouts.
    fileParallelism: false,
  },
})
