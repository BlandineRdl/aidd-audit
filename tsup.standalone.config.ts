import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { cli: 'src/cli/main.ts' },
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  outDir: 'plugins/aidd-evaluation/bin',
  clean: true,
  noExternal: ['yaml'],
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);",
  },
})
