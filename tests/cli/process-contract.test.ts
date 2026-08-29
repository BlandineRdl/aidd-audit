import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { AssessmentReport } from '../../src/assessment/contracts/assessment-report.contract.js'
import { runCli } from './spawn-cli.test-fixture.js'

// INVARIANT: the exit code classifies responsibility, not error sub-type — `0` ran, `2` the
// caller's fault, `1` ours. Observed by running the process, because what `runAssess` returns is
// `assess.command.test.ts`'s subject, not this one's.

let tempDir: string | undefined

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
    const run = runCli('assess', '.')

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
    const report = JSON.parse(runCli('assess', '.', '--json').stdout)

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
    const unproven = runCli('assess', '.')
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

// INVARIANT: The two wired collectors keeping subjects apart is a fact about the composition root,
// and only visible with both of them running. `self-assessment.test.ts` owns the assessment itself;
// the exit codes and the streams are this suite's.
describe('8. the wired collectors reach the pipeline through the binary', () => {
  function reportFor(...args: readonly string[]): AssessmentReport {
    const run = runCli(...args, '--json')
    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
    return JSON.parse(run.stdout) as AssessmentReport
  }

  function observedFor(report: AssessmentReport, level: string, axis: string): unknown {
    const found = report.levels.find((candidate) => candidate.id === level)
    const requirement = found?.axes.find((candidate) => candidate.axis === axis)?.requirements.at(0)
    return requirement?.observed
  }

  it('runs the collectors the composition root wired, on the repository itself', () => {
    // INVARIANT: provenance is the proof the wiring is real rather than a shape the report
    // would have had anyway — `main.ts` built a collector set, the use case ran it, and the
    // entries survived composition into the published contract. `axes` is what each collector
    // was asked to attempt, never what it answered.
    // INVARIANT: one axis, one source. Asserted as a shape rather than a fixed list, because the
    // set depends on whether this checkout's `origin` names a GitHub repository, and `vcs.md` says
    // no part of the gate may depend on the remote — the suite must pass from a clone with none.
    const provenance = reportFor('assess', '.').provenance
    const collectors = provenance.map((entry) => entry.collector)

    expect(collectors).toContain('live-repository')
    expect(collectors).toContain('fixture-bundle')

    // INVARIANT: every axis of the loaded model is asked of someone. `axes` is what a collector was
    // asked to attempt, never what it answered, so an axis may legitimately appear twice — the
    // bundle collector declares all four on every subject and stays silent on a repository.
    const asked = provenance.flatMap((entry) => entry.axes)
    expect([...new Set(asked)].sort()).toEqual(['harness', 'intervention', 'parallelism', 'size'])

    // INVARIANT: what must never happen is two collectors *answering* one axis differently, which
    // resolves to CONFLICTING and costs the axis entirely. Asserted at the published surface, where
    // it would show, rather than on the wiring that is supposed to prevent it.
    const report = reportFor('assess', '.')
    const statuses = report.levels.flatMap((level) =>
      level.axes.flatMap((axis) => axis.requirements.map((requirement) => requirement.evidence)),
    )
    expect(statuses).not.toContain('CONFLICTING')

    // INVARIANT: the forge is the one collector whose presence turns on the remote. Where it is
    // built it owns the three axes a pull request records, and the live collector keeps the harness
    // alone — which is the wiring that keeps the assertion above true.
    if (collectors.includes('forge-repository')) {
      expect(provenance.find((entry) => entry.collector === 'live-repository')?.axes).toEqual([
        'harness',
      ])
      expect(provenance.find((entry) => entry.collector === 'forge-repository')?.axes).toEqual([
        'size',
        'intervention',
        'parallelism',
      ])
    }
  })

  it('publishes a report and exits 0 when the forge refuses', () => {
    // INVARIANT: a source that could not answer is an evidence gap, never the tool breaking. The
    // spawn fixture puts a refusing `gh` ahead of any real one, so this is the ordinary path on a
    // machine with no credentials.
    const run = runCli('assess', '.', '--json')

    expect(run.status).toBe(0)
    const forge = (JSON.parse(run.stdout) as AssessmentReport).provenance.find(
      (entry) => entry.collector === 'forge-repository',
    )

    // INVARIANT: a checkout with no GitHub origin builds no forge at all, which is the other half
    // of the same rule — a source that is not there is not a failure either.
    if (forge === undefined) return

    expect(forge.status).toBe('FAILED')
    expect('reason' in forge ? forge.reason : '').toContain('gh')
  })

  it('carries something it observed on disk into the rendered report', () => {
    // INVARIANT: an observation survived collection, resolution and composition. Never that it
    // amounts to a level — coupled to this repository having a harness at all, which it does.
    const report = reportFor('assess', '.')

    expect(report.coverage.axesRequested).toBe(4)
    expect(report.coverage.axesObserved).toBeGreaterThan(0)
  })

  it('answers for the bundle out of the bundle, never out of the checkout holding it', () => {
    // SAFETY: `profiles/` is tracked inside this repository, so without the live collector's
    // repository-root gate that collector would resolve to this checkout and publish AIDD's own
    // harness as the bundle's evidence. The two harness sets are what tell the sources apart: this
    // project has instruction files and rules, that subject has neither.
    const bundle = reportFor('assess', 'profiles/perceval')
    const checkout = reportFor('assess', '.')

    expect(observedFor(bundle, 'red', 'harness')).toEqual(['prompts'])
    expect(observedFor(checkout, 'red', 'harness')).not.toEqual(['prompts'])
  })

  it('reports no proven level for a repository, and says so in the human rendering', () => {
    // LIMITATION: `intervention` is unobservable on any local history and every level declares
    // it, so `proven: null` is this command's normal output. Asserted as the ceiling it is, not
    // as a level — a forge collector lifting it is what should turn this red.
    expect(reportFor('assess', '.').proven).toBeNull()

    const human = runCli('assess', '.')
    expect(human.status).toBe(0)
    expect(human.stdout).toContain('could not be established')
  })
})
