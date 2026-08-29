import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Walks up rather than counting `..` segments: `src/cli/` in the suite and
 *  `dist/` in the bundle sit at different depths. */
export function canonicalModelPath(): string {
  const start = dirname(fileURLToPath(import.meta.url))
  let dir = resolve(start)

  for (;;) {
    const candidate = join(dir, 'aidd.yml')
    if (existsSync(candidate)) {
      return candidate
    }

    // package.json is the package root: an aidd.yml above it belongs to
    // whatever project happens to contain this install.
    if (existsSync(join(dir, 'package.json'))) {
      throw new Error(`Could not locate 'aidd.yml' above '${start}'.`)
    }

    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error(`Could not locate 'aidd.yml' above '${start}'.`)
    }
    dir = parent
  }
}
