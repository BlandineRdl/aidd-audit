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

export function runCli(...args: readonly string[]): CliRun {
  return runCliWith({}, ...args)
}

export function runCliFresh(...args: readonly string[]): CliRun {
  return runCliWith({}, ...args)
}

export function runCliWithHome(args: readonly string[], home: string): CliRun {
  return runCliWith({ HOME: home }, ...args)
}

// SAFETY: NO_COLOR and FORCE_COLOR are dropped from the inherited environment before `overrides`
// are applied. A developer who exports either in their shell would otherwise change what the gate
// asserts, and a suite that spawns a binary must not depend on who is running it.
export function runCliWith(
  overrides: Readonly<Record<string, string>>,
  ...args: readonly string[]
): CliRun {
  const { NO_COLOR: _off, FORCE_COLOR: _on, ...inherited } = process.env
  const result = spawnSync(process.execPath, [BUNDLE, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...inherited,
      PATH: `${directoryHoldingARefusingGh()}:${process.env.PATH ?? ''}`,
      ...overrides,
    },
  })
  if (result.error !== undefined) throw result.error
  // A signalled process reports status null; the contract has no such outcome.
  if (result.status === null) {
    throw new Error(`aidd-audit was killed by ${result.signal ?? 'an unknown signal'}.`)
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}
