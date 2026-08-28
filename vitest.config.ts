import { defineConfig } from 'vitest/config'

// Unit suites sit next to the code they exercise, under src/. tests/ keeps only
// what has no such neighbour: the conformance of aidd.yml itself, and the
// acceptance suite over the profiles.
//
// profiles/ holds acceptance fixtures: source files belonging to fictional
// developers, including their own *.test.ts. They are input data, never this
// project's suite. Naming the two roots explicitly is what keeps them out.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'profiles/**'],
  },
})
