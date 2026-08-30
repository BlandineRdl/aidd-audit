import { beforeAll, describe, expect, it } from 'vitest'
import type {
  AssessmentReport,
  AxisReport,
  LevelReport,
  RequirementReport,
} from '../../src/assessment/contracts/assessment-report.contract.js'
import { REPO_ROOT, runCli } from './spawn-cli.test-fixture.js'

// INVARIANT: AIDD assessing AIDD tests the capability and its invariants, never the state of this
// checkout or of the collector set. `process-contract.test.ts` owns the exit codes;
// `live-repository.adapter.test.ts` owns which subjects the collector answers for.

function reportFor(...args: readonly string[]): AssessmentReport {
  const run = runCli(...args, '--json')
  expect(run.status).toBe(0)
  // Stricter than `cli.md` promises, which reserves the right to warn on success.
  expect(run.stderr).toBe('')
  return JSON.parse(run.stdout) as AssessmentReport
}

let report: AssessmentReport
let prose: string

beforeAll(() => {
  report = reportFor('assess', '.')
  prose = runCli('assess', '.').stdout
})

const everyRequirement = (report: AssessmentReport): readonly RequirementReport[] =>
  report.levels.flatMap((level) => level.axes.flatMap((axis) => axis.requirements))

const everyAxis = (report: AssessmentReport): readonly AxisReport[] =>
  report.levels.flatMap((level) => level.axes)

describe('1. the shipped CLI assesses the repository it ships from', () => {
  it('runs to a published report', () => {
    const run = runCli('assess', '.')

    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
    expect(run.stdout).not.toBe('')
  })

  it('echoes the operand as the caller typed it', () => {
    expect(report.subject.path).toBe('.')
  })

  it('reports against the packaged model, no override needed', () => {
    expect(report.model.id).toBe('aidd')
    expect(report.schemaVersion).toBe(1)
  })
})

// INVARIANT: three of these four are guards, not observations — the contract's union makes
// NOT_MET-without-CONFIRMED unrepresentable and this checkout emits no practice gap. Kept because a
// producer abandoning the conservative rule would surface here first.
describe('2. the verdict follows from evidence, never from its absence', () => {
  it('never calls a practice deficient on evidence it did not confirm', () => {
    const inferred = everyRequirement(report).filter(
      (requirement) => requirement.outcome === 'NOT_MET' && requirement.evidence !== 'CONFIRMED',
    )

    expect(inferred).toEqual([])
  })

  it('leaves every unobserved axis UNKNOWN and unproven', () => {
    const unobserved = everyRequirement(report).filter(
      (requirement) => requirement.observed === null,
    )

    expect(unobserved.every((requirement) => requirement.evidence === 'UNKNOWN')).toBe(true)
    expect(unobserved.every((requirement) => requirement.outcome === 'UNPROVEN')).toBe(true)
  })

  it('files every unobserved axis as an evidence gap, never a practice one', () => {
    const unobservedAxes = new Set(
      everyAxis(report)
        .filter((axis) => axis.requirements.some((requirement) => requirement.observed === null))
        .map((axis) => axis.axis),
    )
    const practiceGaps = report.blocking
      .filter((blocker) => blocker.gap === 'PRACTICE')
      .map((blocker) => blocker.axis)

    expect(practiceGaps.filter((axis) => unobservedAxes.has(axis))).toEqual([])
  })

  it('accepts no proven level as a result rather than falling back to the floor', () => {
    if (report.proven === null) {
      expect(report.blocking.length).toBeGreaterThan(0)
    } else {
      expect(report.proven.outcome).toBe('MET')
    }
  })
})

describe('3. prose and JSON describe the same assessment', () => {
  it('states the proven verdict the contract carries', () => {
    if (report.proven === null) {
      expect(prose).toContain('could not be established')
      expect(prose).not.toContain('Proven level: White')
    } else {
      expect(prose).toContain(`Proven level: ${report.proven.label} (rank ${report.proven.rank})`)
    }
  })

  it('names the same next level, with the same axis outcomes', () => {
    const next: LevelReport | null = report.next
    if (next === null) {
      expect(prose).not.toContain('Next level:')
      return
    }
    expect(prose).toContain(`Next level: ${next.label} (rank ${next.rank})`)
    for (const axis of next.axes) {
      expect(prose).toContain(`${axis.label}: ${axis.outcome}`)
    }
  })

  it('shows in prose every value the contract says was observed', () => {
    for (const axis of report.next?.axes ?? []) {
      for (const requirement of axis.requirements) {
        if (requirement.observed === null) continue
        // An empty set joins to '', which `toContain` accepts from any string.
        const rendered = Array.isArray(requirement.observed)
          ? requirement.observed.join(', ') || 'an empty set'
          : String(requirement.observed)
        expect(prose).toContain(rendered)
      }
    }
  })

  it('names in prose every axis the contract lists as blocking', () => {
    for (const blocker of report.blocking) {
      const label = everyAxis(report).find((axis) => axis.axis === blocker.axis)?.label
      expect(label).toBeDefined()
      expect(prose).toContain(String(label))
    }
    expect(prose.includes('Blocking requirements:')).toBe(report.blocking.length > 0)
  })

  it('reports the same coverage counts it publishes', () => {
    if (report.proven !== null) return
    const { axesConfirmed, axesRequested, axesObserved } = report.coverage
    expect(prose).toContain(
      `${axesConfirmed} of ${axesRequested} axes confirmed (${axesObserved} observed)`,
    )
  })
})

describe('4. nothing about this repository is special-cased', () => {
  it('assesses the same repository identically however the path is spelled', () => {
    // A shortcut keyed on the path or the package name shows up here.
    const absolute = reportFor('assess', REPO_ROOT)

    expect(absolute.subject.path).toBe(REPO_ROOT)
    expect({ ...absolute, subject: report.subject }).toEqual(report)
  })

  it('produces byte-identical output on a second run of the same subject', () => {
    expect(runCli('assess', '.').stdout).toBe(runCli('assess', '.').stdout)
    expect(runCli('assess', '.', '--json').stdout).toBe(runCli('assess', '.', '--json').stdout)
  })
})

// INVARIANT: this checkout has a GitHub origin, so the composition root builds a roster for it; the
// spawn fixture's refusing `gh` is what keeps the section present-and-failed rather than absent.
// What is asserted is the capability — a source that could not answer says so — never the state:
// no login, no row count and no level, on the same footing as the rest of this suite.
describe('5. the contributor roster is present, refused, and names nobody', () => {
  it('answers a failed roster rather than an absent one', () => {
    expect(report.contributors).not.toBeNull()
    if (report.contributors === null) return

    expect(report.contributors.status).toBe('FAILED')
    expect(report.contributors.rows).toEqual([])
    expect('reason' in report.contributors ? report.contributors.reason : '').not.toBe('')
  })

  it('says so in prose, with no row for any account', () => {
    expect(prose).toContain('Contributors: could not be read')
    // SAFETY: a row, were the roster COMPLETED, would open with two leading spaces and an em dash
    // before "proven:" — `renderContributorRow`'s own shape. A FAILED roster is typed with no rows
    // at all, so this is a belt-and-braces check on the rendering rather than the contract.
    expect(prose).not.toMatch(/^ {2}\S+ — proven:/m)
  })
})
