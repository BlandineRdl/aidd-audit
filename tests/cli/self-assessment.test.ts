import { beforeAll, describe, expect, it } from 'vitest'
import type {
  AssessmentReport,
  AxisReport,
  LevelReport,
  RequirementReport,
} from '../../src/assessment/contracts/assessment-report.contract.js'
import { REPO_ROOT, runCli, runCliFresh } from './spawn-cli.test-fixture.js'

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
      expect(prose).toContain("Aucun niveau n'a pu être entièrement prouvé")
      expect(prose).not.toContain('Niveau prouvé : White')
    } else {
      expect(prose).toContain(`Niveau prouvé : ${report.proven.label} (rang ${report.proven.rank})`)
    }
  })

  it('names the same next level, with the same axis outcomes', () => {
    const next: LevelReport | null = report.next
    if (next === null) {
      expect(prose).not.toContain('Pour atteindre')
      return
    }
    expect(prose).toContain(`Pour atteindre ${next.label} (rang ${next.rank}) :`)

    // INVARIANT: prose states every axis outcome one way or the other, never neither. An axis the
    // proven level already detailed word for word is named in the carried-over line, not repeated.
    const marker = { MET: '✓', NOT_MET: '✗', UNPROVEN: '?' } as const
    const carriedOver =
      prose.split('\n').find((line) => line.includes('Déjà au niveau requis')) ?? ''
    for (const axis of next.axes) {
      const detailed = prose.includes(`${marker[axis.outcome]} ${axis.label}`)
      const named = axis.outcome === 'MET' && carriedOver.includes(axis.label)
      expect(detailed || named).toBe(true)
    }
  })

  it('uses the report vocabulary to make every rendered scale value legible', () => {
    for (const axis of report.next?.axes ?? []) {
      for (const requirement of axis.requirements) {
        if (requirement.observed === null) continue
        const vocabulary = report.vocabulary.find((entry) => entry.axis === axis.axis)
        if (vocabulary === undefined || vocabulary.kind === 'numeric') continue
        const values = Array.isArray(requirement.observed)
          ? requirement.observed
          : [requirement.observed]
        for (const value of values) {
          const description = vocabulary.descriptions[value]
          expect(description === undefined || prose.includes(description)).toBe(true)
        }
      }
    }
  })

  it('names in prose every axis the contract lists as blocking', () => {
    for (const blocker of report.blocking) {
      const label = everyAxis(report).find((axis) => axis.axis === blocker.axis)?.label
      expect(label).toBeDefined()
      expect(prose).toContain(String(label))
    }

    // INVARIANT: a tagged line appears exactly when the contract carries a blocker. The gaps live
    // on the requirement lines they belong to, so there is no section of their own to key on.
    expect(prose.includes('[écart de')).toBe(report.blocking.length > 0)
  })

  it('reports the same coverage counts it publishes', () => {
    if (report.proven !== null) return
    const { axesConfirmed, axesRequested, axesObserved } = report.coverage
    expect(prose).toContain(
      `${axesConfirmed}/${axesRequested} axes confirmés, ${axesObserved}/${axesRequested} observés`,
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
    expect(runCliFresh('assess', '.').stdout).toBe(runCliFresh('assess', '.').stdout)
    expect(runCliFresh('assess', '.', '--json').stdout).toBe(
      runCliFresh('assess', '.', '--json').stdout,
    )
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
    expect(prose).toContain('Contributeurs : lecture impossible')
    // SAFETY: a row, were the roster COMPLETED, would open with two leading spaces and an em dash
    // before "proven:" — `renderContributorRow`'s own shape. A FAILED roster is typed with no rows
    // at all, so this is a belt-and-braces check on the rendering rather than the contract.
    expect(prose).not.toMatch(/^ {2}\S+ — niveau prouvé/m)
  })
})
