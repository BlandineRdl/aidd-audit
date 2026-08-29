import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export default function buildCliBundle(): void {
  // SAFETY: no suite may build the bundle itself. `tsup` cleans the folder, so a per-suite build
  // would empty it under a sibling running in parallel.
  const repoRoot = fileURLToPath(new URL('..', import.meta.url))
  execFileSync('pnpm', ['run', 'build'], { cwd: repoRoot, stdio: 'pipe' })
}
