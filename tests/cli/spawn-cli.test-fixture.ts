import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const BUNDLE = join(REPO_ROOT, 'dist', 'cli.js')

// SAFETY: This repository has a GitHub origin, so the composition root builds a forge collector for
// it and the binary would reach the network from inside the gate. A `gh` that refuses is put ahead
// of any real one on the child's PATH: the suite stays offline, deterministic and green on a machine
// with no credentials, while still exercising the path a refusing forge takes — FAILED provenance
// and exit 0. That the forge can *answer* is proven where its payloads can be fixed, in
// `pull-request-history.test.ts`.
let refusingGh: string | undefined
const runs = new Map<string, CliRun>()

function directoryHoldingARefusingGh(): string {
  if (refusingGh !== undefined) return refusingGh

  const directory = mkdtempSync(join(tmpdir(), 'aidd-cli-no-forge-'))
  const script = join(directory, 'gh')
  writeFileSync(script, '#!/bin/sh\necho "gh: no credentials in this run" >&2\nexit 1\n')
  chmodSync(script, 0o755)

  refusingGh = directory
  return directory
}

export interface CliRun {
  readonly status: number
  readonly stdout: string
  readonly stderr: string
}

function spawnCli(args: readonly string[]): CliRun {
  const result = spawnSync(process.execPath, [BUNDLE, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${directoryHoldingARefusingGh()}:${process.env.PATH ?? ''}`,
    },
  })
  if (result.error !== undefined) throw result.error
  // A signalled process reports status null; the contract has no such outcome.
  if (result.status === null) {
    throw new Error(`aidd-audit was killed by ${result.signal ?? 'an unknown signal'}.`)
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

export function runCli(...args: readonly string[]): CliRun {
  const key = JSON.stringify(args)
  const cached = runs.get(key)
  if (cached !== undefined) return cached

  const completed = spawnCli(args)
  runs.set(key, completed)
  return completed
}

export function runCliFresh(...args: readonly string[]): CliRun {
  return spawnCli(args)
}
