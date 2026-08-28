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
import type { AxisId } from '../../evidence/models/axis.model.js'
import type {
  Evidence,
  EvidenceStatus,
  ObservedValue,
} from '../../evidence/models/observation.model.js'
import { validModel as model } from '../../maturity/engine/maturity-model.test-fixture.js'

/**
 * Sociable specification: real evidence and the real maturity engine.
 * Only external boundaries would be doubled here.
 */
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
            status: reading.status,
            value: reading.value,
            observations: [
              {
                axis,
                value: reading.value,
                kind: 'OBSERVED',
                collector: 'fixture-collector',
                basis: 'fixture',
              },
            ],
          }
        : { axis, status: reading.status, value: null, observations: [] },
    )
}

const provenance: readonly CollectorProvenance[] = [
  { collector: 'fixture-collector', status: 'COMPLETED', axes: ['size', 'harness', 'parallelism'] },
]

const compose = (
  evidence: readonly Evidence[],
  overrides: Partial<{ provenance: readonly CollectorProvenance[] }> = {},
): AssessmentReport =>
  composeAssessmentReport({
    subjectPath: '/repo/example',
    model,
    evidence,
    provenance: overrides.provenance ?? provenance,
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
        status: 'CLAIMED',
        value: null,
        observations: [
          {
            axis: 'size',
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
      { axis: 'telepathy', status: 'CONFIRMED', value: 'L', observations: [] },
    ]
    expect(() => compose(offAxis)).toThrow(UndeclaredAxisError)
    expect(() => compose(offAxis)).toThrow(/telepathy/)
  })
})
