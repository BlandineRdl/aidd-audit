import { defineConfig } from 'vitest/config'

// profiles/ holds acceptance fixtures: source files belonging to fictional
// developers, including their own *.test.ts. They are input data, never this
// project's suite. Restricting include to tests/ is what keeps them out.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'profiles/**'],
  },
})
