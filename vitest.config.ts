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
    // SAFETY: four tests/cli/ suites spawn dist/cli.js, several times per test, and vitest runs
    // files in parallel. Each spawn evaluates the token encoder's vocabulary because main.ts
    // imports the harness command statically — see the note there — which pushes a spawn-heavy
    // test past the 5000ms default under load and fails a passing test rather than a broken one.
    testTimeout: 15000,
  },
})
