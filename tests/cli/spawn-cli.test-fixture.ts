import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const BUNDLE = join(REPO_ROOT, 'dist', 'cli.js')

export interface CliRun {
  readonly status: number
  readonly stdout: string
  readonly stderr: string
}

export function runCli(...args: readonly string[]): CliRun {
  const result = spawnSync(process.execPath, [BUNDLE, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
  if (result.error !== undefined) throw result.error
  // A signalled process reports status null; the contract has no such outcome.
  if (result.status === null) {
    throw new Error(`aidd-audit was killed by ${result.signal ?? 'an unknown signal'}.`)
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}
