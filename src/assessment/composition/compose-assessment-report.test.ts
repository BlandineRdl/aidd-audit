import { describe, expect, it } from 'vitest'
import { composeAssessmentReport } from './compose-assessment-report.js'
import { ASSESSMENT_REPORT_SCHEMA_VERSION } from '../contracts/assessment-report.contract.js'
import type {
  AssessmentReport,
  LevelReport,
  RequirementReport,
} from '../contracts/assessment-report.contract.js'
import { UndeclaredAxisError } from './undeclared-axis.error.js'
import type { CollectorProvenance } from '../../evidence/models/collector-provenance.model.js'
import type { CollectorDiagnostic } from '../../evidence/models/collector-diagnostic.model.js'
import type { AxisId } from '../../evidence/models/axis.model.js'
import type {
  Evidence,
  EvidenceStatus,
  ObservedValue,
} from '../../evidence/models/observation.model.js'
import type { ContributorRosterRun } from '../../evidence/ports/contributor-roster.port.js'
import { validModel as model } from '../../maturity/engine/maturity-model.test-fixture.js'

type Unresolved = Exclude<EvidenceStatus, 'CONFIRMED'>

type Reading =
  | { readonly status: 'CONFIRMED'; readonly value: ObservedValue }
  | { readonly status: Unresolved }

const confirmed = (value: ObservedValue): Reading => ({ status: 'CONFIRMED', value })
const unresolved = (status: Unresolved): Reading => ({ status })

function evidenceOf(overrides: Partial<Record<AxisId, Reading | 'absent'>> = {}): Evidence[] {
  const base: Record<AxisId, Reading | 'absent'> = {
    size: confirmed('L'),
    harness: confirmed(['prompts', 'context-engineering']),
    parallelism: confirmed(3),
    ...overrides,
  }
  return Object.entries(base)
    .filter((entry): entry is [AxisId, Reading] => entry[1] !== 'absent')
    .map(([axis, reading]) =>
      reading.status === 'CONFIRMED'
        ? {
            axis,
            reading: 'SUSTAINED' as const,
            status: reading.status,
            value: reading.value,
            demonstration: null,
            observations: [
              {
                axis,
                reading: 'SUSTAINED' as const,
                value: reading.value,
                kind: 'OBSERVED' as const,
                collector: 'fixture-collector',
                basis: 'fixture',
                demonstration: null,
              },
            ],
          }
        : {
            axis,
            reading: 'SUSTAINED' as const,
            status: reading.status,
            value: null,
            demonstration: null,
            observations: [],
          },
    )
}

const provenance: readonly CollectorProvenance[] = [
  { collector: 'fixture-collector', status: 'COMPLETED', axes: ['size', 'harness', 'parallelism'] },
]

const compose = (
  evidence: readonly Evidence[],
  overrides: Partial<{
    provenance: readonly CollectorProvenance[]
    roster: ContributorRosterRun | null
    diagnostics: readonly CollectorDiagnostic[]
  }> = {},
): AssessmentReport =>
  composeAssessmentReport({
    subjectPath: '/repo/example',
    model,
    evidence,
    provenance: overrides.provenance ?? provenance,
    roster: overrides.roster ?? null,
    ...(overrides.diagnostics === undefined ? {} : { diagnostics: overrides.diagnostics }),
  })

const levelOf = (report: AssessmentReport, levelId: string): LevelReport =>
  report.levels.find((level) => level.id === levelId)!

const requirementOf = (
  report: AssessmentReport,
  levelId: string,
  axis: AxisId,
): RequirementReport => levelOf(report, levelId).axes.find((a) => a.axis === axis)!.requirements[0]!

describe('a requirement carries both its verdict and the evidence behind it', () => {
  it('is MET and keeps the observed value when CONFIRMED evidence reaches the threshold', () => {
    const requirement = requirementOf(compose(evidenceOf()), 'high', 'size')
    expect(requirement).toEqual({
      axis: 'size',
      threshold: 'L',
      observed: 'L',
      evidence: 'CONFIRMED',
      outcome: 'MET',
    })
  })

  it('is NOT_MET and still keeps the observed value when the evidence falls short', () => {
    const requirement = requirementOf(compose(evidenceOf({ size: confirmed('M') })), 'high', 'size')
    expect(requirement).toEqual({
      axis: 'size',
      threshold: 'L',
      observed: 'M',
      evidence: 'CONFIRMED',
      outcome: 'NOT_MET',
    })
  })

  it.each<Unresolved>(['CLAIMED', 'CONFLICTING', 'UNKNOWN'])(
    'is UNPROVEN with no observed value and keeps the %s status',
    (status) => {
      const report = compose(evidenceOf({ size: unresolved(status) }))
      expect(requirementOf(report, 'high', 'size')).toEqual({
        axis: 'size',
        threshold: 'L',
        observed: null,
        evidence: status,
        outcome: 'UNPROVEN',
      })
    },
  )

  it('reads an axis with no evidence entry at all as UNKNOWN, never as a practice gap', () => {
    const report = compose(evidenceOf({ size: 'absent' }))
    expect(requirementOf(report, 'high', 'size')).toEqual({
      axis: 'size',
      threshold: 'L',
      observed: null,
      evidence: 'UNKNOWN',
      outcome: 'UNPROVEN',
    })
  })

  it('attaches a completed collector diagnostic to the UNKNOWN requirement it explains', () => {
    const diagnostic: CollectorDiagnostic = {
      collector: 'forge-repository',
      axis: 'parallelism',
      reason: 'INSUFFICIENT_ACTIVE_DAYS',
      observed: 3,
      minimum: 5,
    }

    const report = compose(evidenceOf({ parallelism: unresolved('UNKNOWN') }), {
      diagnostics: [diagnostic],
    })

    expect(requirementOf(report, 'high', 'parallelism')).toMatchObject({ diagnostic })
  })

  it('reports a set requirement by the members it asks for, and a minimum by its value', () => {
    const report = compose(evidenceOf())
    expect(requirementOf(report, 'high', 'harness').threshold).toEqual([
      'prompts',
      'context-engineering',
    ])
    expect(requirementOf(report, 'high', 'parallelism').threshold).toBe(3)
  })

  it('labels each axis from the model, so the report never speaks in ids alone', () => {
    const axis = levelOf(compose(evidenceOf()), 'high').axes.find((a) => a.axis === 'parallelism')!
    expect(axis.label).toBe('En parallèle')
  })

  it('projects only the loaded model vocabulary into the report', () => {
    const custom = {
      ...model,
      scales: {
        ...model.scales,
        harness: {
          kind: 'set' as const,
          members: ['prompts', 'context-engineering', 'behavior'],
          descriptions: {
            prompts: 'custom prompt practice',
            'context-engineering': 'custom project context',
            behavior: 'custom guardrails',
          },
        },
      },
    }
    const report = composeAssessmentReport({
      subjectPath: '/repo/custom',
      model: custom,
      evidence: evidenceOf(),
      provenance,
    })

    expect(report.vocabulary).toContainEqual({
      axis: 'harness',
      kind: 'set',
      members: ['prompts', 'context-engineering', 'behavior'],
      descriptions: {
        prompts: 'custom prompt practice',
        'context-engineering': 'custom project context',
        behavior: 'custom guardrails',
      },
    })
  })
})

describe('the report names the level reached and the one above it', () => {
  it('reports the highest proven level and the level immediately above it', () => {
    const report = compose(evidenceOf({ size: confirmed('S'), parallelism: confirmed(1) }))
    expect(report.proven?.id).toBe('low')
    expect(report.next?.id).toBe('high')
    expect(report.levels.map((level) => level.rank)).toEqual([1, 2])
  })

  it('leaves proven null when nothing is proven, rather than falling back to the floor', () => {
    const report = compose(
      evidenceOf({
        size: unresolved('UNKNOWN'),
        harness: unresolved('UNKNOWN'),
        parallelism: unresolved('UNKNOWN'),
      }),
    )
    expect(report.proven).toBeNull()
    expect(report.next?.id).toBe('low')
    expect(report.levels.every((level) => level.outcome === 'UNPROVEN')).toBe(true)
  })

  it('reports no next level once the top one is proven', () => {
    const report = compose(evidenceOf())
    expect(report.proven?.id).toBe('high')
    expect(report.next).toBeNull()
    expect(report.blocking).toEqual([])
  })
})

describe('blocking requirements separate a practice gap from an evidence gap', () => {
  it('reports a NOT_MET requirement on the next level as a practice gap', () => {
    const report = compose(evidenceOf({ size: confirmed('M') }))
    expect(report.next?.id).toBe('high')
    expect(report.blocking).toEqual([
      { level: 'high', axis: 'size', evidence: 'CONFIRMED', outcome: 'NOT_MET', gap: 'PRACTICE' },
    ])
  })

  it('reports an UNPROVEN requirement on the next level as an evidence gap', () => {
    const report = compose(evidenceOf({ size: unresolved('CLAIMED') }))
    expect(report.next?.id).toBe('low')
    expect(report.blocking).toEqual([
      { level: 'low', axis: 'size', evidence: 'CLAIMED', outcome: 'UNPROVEN', gap: 'EVIDENCE' },
    ])
  })

  it('lists every requirement blocking the next level, and only those', () => {
    const report = compose(evidenceOf({ size: confirmed('M'), parallelism: confirmed(1) }))
    expect(report.next?.id).toBe('high')
    expect(report.blocking.map((blocker) => blocker.axis)).toEqual(['size', 'parallelism'])
  })
})

describe('coverage is derived from the axes requested and the evidence returned', () => {
  it('counts every model axis as requested, observed and confirmed when all are CONFIRMED', () => {
    const report = compose(evidenceOf())
    expect(report.coverage).toEqual({ axesRequested: 3, axesObserved: 3, axesConfirmed: 3 })
  })

  it('counts an axis with observations but an unresolved status as observed, not confirmed', () => {
    const claimedWithObservation: Evidence[] = [
      ...evidenceOf({ size: 'absent' }),
      {
        axis: 'size',
        reading: 'SUSTAINED',
        status: 'CLAIMED',
        value: null,
        demonstration: null,
        observations: [
          {
            axis: 'size',
            reading: 'SUSTAINED',
            demonstration: null,
            value: 'M',
            kind: 'DECLARED',
            collector: 'docs-collector',
            basis: 'README',
          },
        ],
      },
    ]
    const report = compose(claimedWithObservation)
    expect(report.coverage).toEqual({ axesRequested: 3, axesObserved: 3, axesConfirmed: 2 })
  })

  it('counts an axis whose observations array is empty as neither observed nor confirmed', () => {
    const report = compose(evidenceOf({ size: unresolved('UNKNOWN') }))
    expect(report.coverage).toEqual({ axesRequested: 3, axesObserved: 2, axesConfirmed: 2 })
  })

  it('counts an axis absent from evidence entirely as requested only', () => {
    const report = compose(evidenceOf({ size: 'absent' }))
    expect(report.coverage).toEqual({ axesRequested: 3, axesObserved: 2, axesConfirmed: 2 })
  })
})

describe('provenance is projected from what collectors reported', () => {
  it('carries a COMPLETED entry through without a reason', () => {
    const report = compose(evidenceOf())
    expect(report.provenance).toEqual([
      {
        collector: 'fixture-collector',
        status: 'COMPLETED',
        axes: ['size', 'harness', 'parallelism'],
      },
    ])
  })

  it.each<'FAILED' | 'TIMED_OUT' | 'SKIPPED'>(['FAILED', 'TIMED_OUT', 'SKIPPED'])(
    'carries a %s entry through with its reason',
    (status) => {
      const report = compose(evidenceOf(), {
        provenance: [{ collector: 'flaky-collector', status, axes: ['size'], reason: 'boom' }],
      })
      expect(report.provenance).toEqual([
        { collector: 'flaky-collector', status, axes: ['size'], reason: 'boom' },
      ])
    },
  )
})

describe('what the composition carries rather than decides', () => {
  it('stamps the schema version, the model it used and the subject it assessed', () => {
    const report = compose(evidenceOf())
    expect(report.schemaVersion).toBe(ASSESSMENT_REPORT_SCHEMA_VERSION)
    expect(report.model).toEqual({ id: 'test', schemaVersion: 1 })
    expect(report.subject).toEqual({ path: '/repo/example' })
  })
})

describe('evidence the model cannot rank is rejected, never dropped', () => {
  it('refuses evidence for an axis the model does not declare, naming that axis', () => {
    const offAxis: Evidence[] = [
      ...evidenceOf(),
      {
        axis: 'telepathy',
        reading: 'SUSTAINED',
        status: 'CONFIRMED',
        value: 'L',
        demonstration: null,
        observations: [],
      },
    ]
    expect(() => compose(offAxis)).toThrow(UndeclaredAxisError)
    expect(() => compose(offAxis)).toThrow(/telepathy/)
  })
})

describe('what the subject reached is composed beside what it sustains', () => {
  const demonstrated = (axis: AxisId, value: ObservedValue, share: number): Evidence => ({
    axis,
    reading: 'DEMONSTRATED',
    status: 'CONFIRMED',
    value,
    demonstration: { share, unit: 'ACTIVE_DAYS' },
    observations: [
      {
        axis,
        reading: 'DEMONSTRATED',
        value,
        kind: 'OBSERVED',
        collector: 'fixture-collector',
        basis: 'fixture',
        demonstration: { share, unit: 'ACTIVE_DAYS' },
      },
    ],
  })

  it('reports nothing at all when no collector demonstrated anything', () => {
    expect(compose(evidenceOf()).demonstrated).toBeNull()
  })

  it('reaches a level the sustained reading does not, from the axis that carried it', () => {
    const report = compose([
      ...evidenceOf({ parallelism: confirmed(1) }),
      demonstrated('parallelism', 3, 0.42),
    ])

    // INVARIANT: the second run is the engine asked again, not a rule of its own. Sustained puts
    // this subject at `low`; a demonstrated parallelism of 3 carries it to `high` while every other
    // axis falls back to its habitual value.
    expect(report.proven?.id).toBe('low')
    expect(report.demonstrated?.level?.id).toBe('high')
    expect(report.demonstrated?.axes).toEqual([
      { axis: 'parallelism', observed: 3, share: 0.42, unit: 'ACTIVE_DAYS' },
    ])
  })

  it('publishes the level and never the requirements beneath it', () => {
    const report = compose([
      ...evidenceOf({ parallelism: confirmed(1) }),
      demonstrated('parallelism', 3, 0.42),
    ])

    // INVARIANT: a requirement report pairs a threshold with the value the *sustained* reading
    // resolved. Publishing one here stated `threshold: 3, observed: 1, outcome: MET` on one line —
    // a document contradicting itself, and the reason this shape carries no `axes`.
    expect(report.demonstrated?.level).toEqual({
      id: 'high',
      rank: 2,
      label: expect.any(String),
      outcome: 'MET',
    })
    expect(report.demonstrated?.level).not.toHaveProperty('axes')
  })

  it('never falls below the level the subject sustains', () => {
    const report = compose([...evidenceOf(), demonstrated('parallelism', 1, 0.4)])

    // INVARIANT: a share reading under the median says the distribution leans low, so the habitual
    // figure is already the honest answer; publishing less would read as a capability lost.
    expect(report.proven?.id).toBe('high')
    expect(report.demonstrated?.level?.id).toBe('high')
  })

  it('drops a demonstrated value that arrived without the share that earned it', () => {
    const shareless: Evidence = {
      axis: 'parallelism',
      reading: 'DEMONSTRATED',
      status: 'CONFIRMED',
      value: 3,
      demonstration: null,
      observations: [],
    }

    // INVARIANT: a demonstrated value the reader cannot weigh is the maximum this reading exists to
    // avoid. Dropping it from `axes` alone would leave a level named with no frequency under it, so
    // the whole block goes: `level` and `axes` can never disagree about whether anything was shown.
    expect(compose([...evidenceOf(), shareless]).demonstrated).toBeNull()
  })

  it('composes an axis demonstrated but never sustained, rather than failing on it', () => {
    // INVARIANT: a bundle may record a distribution and no median. The demonstrated run then holds a
    // CONFIRMED value where the sustained one holds UNKNOWN, which must compose rather than throw.
    const report = compose([
      ...evidenceOf({ parallelism: 'absent' }),
      demonstrated('parallelism', 3, 0.42),
    ])

    expect(report.demonstrated?.level?.id).toBe('high')
    expect(report.proven).toBeNull()
  })
})

describe('a roster never moves the repository-level fields', () => {
  it('composes the same proven, demonstrated, levels, next, blocking, coverage and provenance with and without a roster', () => {
    const roster: ContributorRosterRun = {
      status: 'COMPLETED',
      windowDays: 180,
      harnessObserved: ['prompts', 'context-engineering'],
      harnessPaths: 3,
      records: [
        {
          account: 'alice',
          emailAddresses: 1,
          commits: 5,
          deliveries: 5,
          activeDays: 5,
          harnessAuthorship: { files: 2, commits: 3 },
          observations: [],
        },
        {
          account: 'bob',
          emailAddresses: 2,
          commits: 3,
          deliveries: 3,
          activeDays: 3,
          harnessAuthorship: null,
          observations: [],
        },
        {
          account: null,
          emailAddresses: 0,
          commits: 1,
          deliveries: 0,
          activeDays: 0,
          harnessAuthorship: null,
          observations: [],
        },
      ],
    }

    const withoutRoster = compose(evidenceOf())
    const withRoster = compose(evidenceOf(), { roster })

    const { contributors: _withoutContributors, ...withoutRest } = withoutRoster
    const { contributors: _withContributors, ...withRest } = withRoster

    expect(withRest).toEqual(withoutRest)
  })
})
