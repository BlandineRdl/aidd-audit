import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AssessmentReport } from '../../src/assessment/contracts/assessment-report.contract.js'

/**
 * The exit-code and stream contract, observed the way a caller observes it: by
 * running the process.
 *
 * `src/cli/commands/assess.command.test.ts` drives `runAssess` in memory and
 * proves what it *returns*. Nothing proved that `main.ts` turns that into a
 * real `process.exitCode`, or that the bundled `dist/cli.js` behaves like the
 * source it was built from. That gap is this suite's whole subject.
 *
 * The codes classify responsibility, not error sub-type: `0` ran, `2` the
 * caller's fault, `1` ours.
 */

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const BUNDLE = join(REPO_ROOT, 'dist', 'cli.js')

interface CliRun {
  readonly status: number
  readonly stdout: string
  readonly stderr: string
}

function runCli(...args: readonly string[]): CliRun {
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

let tempDir: string | undefined

beforeAll(() => {
  // Building here is what makes "the real binary" true: the bundle under test
  // is this working tree's, never a stale artefact from an earlier branch.
  execFileSync('pnpm', ['run', 'build'], { cwd: REPO_ROOT, stdio: 'pipe' })
}, 120_000)

afterAll(() => {
  if (tempDir !== undefined) rmSync(tempDir, { recursive: true, force: true })
})

function writeTempModel(name: string, lines: readonly string[]): string {
  tempDir ??= mkdtempSync(join(tmpdir(), 'aidd-audit-process-'))
  const path = join(tempDir, name)
  writeFileSync(path, `${lines.join('\n')}\n`)
  return path
}

describe('1. a successful assessment exits 0 and publishes on stdout', () => {
  it('writes the report to stdout and leaves stderr empty', () => {
    const run = runCli('assess', 'profiles/perceval')

    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
    expect(run.stdout).toContain('profiles/perceval')
  })

  it('ends stdout with exactly one newline', () => {
    const { stdout } = runCli('assess', 'profiles/perceval')

    expect(stdout.endsWith('\n')).toBe(true)
    expect(stdout.endsWith('\n\n')).toBe(false)
  })

  it('is still a success when no level could be proven', () => {
    const run = runCli('assess', 'profiles/perceval')

    expect(run.stdout).toContain('could not be established')
    expect(run.status).toBe(0)
  })
})

describe('2. --json publishes one parseable document', () => {
  it('exits 0 and prints JSON a caller can pipe straight into a parser', () => {
    const run = runCli('assess', 'profiles/perceval', '--json')

    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')

    const report = JSON.parse(run.stdout)
    expect(report.schemaVersion).toBe(1)
    expect(report.subject.path).toBe('profiles/perceval')
  })

  it('keeps proven as a present key holding null, not an omitted one', () => {
    const report = JSON.parse(runCli('assess', 'profiles/perceval', '--json').stdout)

    expect('proven' in report).toBe(true)
    expect(report.proven).toBeNull()
  })
})

describe("3. an unusable subject is the caller's fault, exit 2", () => {
  it('names a path that does not exist, and publishes nothing', () => {
    const run = runCli('assess', './this-path-does-not-exist')

    expect(run.status).toBe(2)
    expect(run.stdout).toBe('')
    expect(run.stderr).toContain('./this-path-does-not-exist')
  })

  it('rejects a path that is neither a file nor a directory', () => {
    // /dev/null is a character device: statSync succeeds, both predicates fail.
    const run = runCli('assess', '/dev/null')

    expect(run.status).toBe(2)
    expect(run.stdout).toBe('')
    expect(run.stderr).toContain('neither a file nor a directory')
  })
})

describe("4. an unusable model is the caller's fault, exit 2", () => {
  it('rejects a --model that is not there, and publishes nothing', () => {
    const run = runCli('assess', 'profiles/perceval', '--model', join(tmpdir(), 'absent.yml'))

    expect(run.status).toBe(2)
    expect(run.stdout).toBe('')
    expect(run.stderr).toContain('absent.yml')
  })

  it('rejects malformed YAML', () => {
    const path = writeTempModel('malformed.yml', ['schemaVersion: 1', 'id: [unclosed'])

    const run = runCli('assess', 'profiles/perceval', '--model', path)

    expect(run.status).toBe(2)
    expect(run.stdout).toBe('')
  })
})

describe('5. a malformed invocation is the caller’s fault, exit 2', () => {
  it('rejects an unknown flag, explaining on stderr', () => {
    const run = runCli('assess', 'profiles/perceval', '--nope')

    expect(run.status).toBe(2)
    expect(run.stdout).toBe('')
    expect(run.stderr).not.toBe('')
  })

  it('rejects --model given with no value', () => {
    const run = runCli('assess', 'profiles/perceval', '--model')

    expect(run.status).toBe(2)
    expect(run.stdout).toBe('')
  })
})

describe('6. the code classifies responsibility, not error sub-type', () => {
  it('classifies user-caused failures under the same caller-fault exit code', () => {
    const subject = runCli('assess', './this-path-does-not-exist').status
    const model = runCli('assess', 'profiles/perceval', '--model', 'absent.yml').status
    const usage = runCli('assess', 'profiles/perceval', '--nope').status

    expect([subject, model, usage]).toEqual([2, 2, 2])
  })

  it('separates a broken model from an assessment that proved nothing', () => {
    const unproven = runCli('assess', 'profiles/perceval')
    const brokenModel = runCli('assess', 'profiles/perceval', '--model', 'absent.yml')

    expect(unproven.status).toBe(0)
    expect(unproven.stdout).not.toBe('')
    expect(brokenModel.status).toBe(2)
    expect(brokenModel.stdout).toBe('')
  })

  it('writes nothing to stdout on any non-zero exit', () => {
    const failures = [
      runCli('assess', './this-path-does-not-exist'),
      runCli('assess', 'profiles/perceval', '--model', 'absent.yml'),
      runCli('assess', 'profiles/perceval', '--nope'),
    ]

    for (const run of failures) {
      expect(run.status).not.toBe(0)
      expect(run.stdout).toBe('')
      expect(run.stderr).not.toBe('')
    }
  })
})

describe('7. the assessment result never reaches the exit code', () => {
  const PROFILES = ['perceval', 'bohort', 'leodagan', 'arthur'] as const

  it('exits 0 for every reference profile, whatever level each one reaches', () => {
    const codes = PROFILES.map((profile) => runCli(`assess`, `profiles/${profile}`).status)

    expect(codes).toEqual([0, 0, 0, 0])
  })

  it('exits 0 under --json too, so neither renderer encodes the result', () => {
    const codes = PROFILES.map(
      (profile) => runCli('assess', `profiles/${profile}`, '--json').status,
    )

    expect(new Set(codes)).toEqual(new Set([0]))
  })
})

describe('8. the live repository collector reaches the pipeline through the binary', () => {
  function reportFor(...args: readonly string[]): AssessmentReport {
    const run = runCli(...args, '--json')
    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
    return JSON.parse(run.stdout) as AssessmentReport
  }

  it('runs the collector the composition root wired, on the repository itself', () => {
    // Provenance is the proof the wiring is real rather than a shape the report would
    // have had anyway: `main.ts` built a collector set, the use case ran it, and the
    // entry survived composition into the published contract. `axes` is what the
    // collector was asked to attempt, never what it answered.
    expect(reportFor('assess', '.').provenance).toEqual([
      {
        collector: 'live-repository',
        status: 'COMPLETED',
        axes: ['size', 'harness', 'intervention', 'parallelism'],
      },
    ])
  })

  it('carries something it observed on disk into the rendered report', () => {
    // Coupled to this repository having a harness at all, which it does — it is an AIDD
    // project with tracked instruction files. What is asserted is that an observation
    // survived collection, resolution and composition, never that it amounts to a level.
    const report = reportFor('assess', '.')

    expect(report.coverage.axesRequested).toBe(4)
    expect(report.coverage.axesObserved).toBeGreaterThan(0)
  })

  it('stays silent about a bundle, which is not its subject', () => {
    // `profiles/` is tracked inside this repository, so without the repository-root gate
    // the collector would resolve to this checkout and publish AIDD's own harness as the
    // bundle's evidence. Asked, ran, answered nothing: an evidence gap, not a wrong one.
    const report = reportFor('assess', 'profiles/perceval')

    expect(report.provenance.map((entry) => entry.status)).toEqual(['COMPLETED'])
    expect(report.coverage.axesObserved).toBe(0)
  })

  it('reports no proven level for a repository, and says so in the human rendering', () => {
    // `intervention` is unobservable on any local history, so `proven: null` is this
    // command's normal output. Asserted as the ceiling it is, not as a level.
    expect(reportFor('assess', '.').proven).toBeNull()

    const human = runCli('assess', '.')
    expect(human.status).toBe(0)
    expect(human.stdout).toContain('could not be established')
  })
})
