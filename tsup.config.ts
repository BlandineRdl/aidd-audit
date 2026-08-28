import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { cli: 'src/cli/assess.command.ts' },
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
})
