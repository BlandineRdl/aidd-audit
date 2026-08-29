import { describe, expect, it } from 'vitest'
import { resolveEvidence } from './resolve-evidence.js'
import type { Observation } from '../models/observation.model.js'

function observation(overrides: Partial<Observation> & Pick<Observation, 'axis'>): Observation {
  return {
    reading: 'SUSTAINED',
    value: 'L',
    kind: 'OBSERVED',
    collector: 'fixture-collector',
    basis: 'fixture',
    demonstration: null,
    ...overrides,
  }
}

const evidenceFor = (axis: string, observations: readonly Observation[]) =>
  resolveEvidence(observations, [axis]).find((evidence) => evidence.reading === 'SUSTAINED')!

const demonstratedFor = (axis: string, observations: readonly Observation[]) =>
  resolveEvidence(observations, [axis]).find((evidence) => evidence.reading === 'DEMONSTRATED')!

describe('resolveEvidence', () => {
  it('confirms an axis when its OBSERVED observations agree on the same value', () => {
    const observations = [
      observation({ axis: 'size', value: 'L', kind: 'OBSERVED', collector: 'a' }),
      observation({ axis: 'size', value: 'L', kind: 'OBSERVED', collector: 'b' }),
    ]

    const evidence = evidenceFor('size', observations)

    expect(evidence).toMatchObject({ axis: 'size', status: 'CONFIRMED', value: 'L' })
    expect(evidence.observations).toEqual(observations)
  })

  it('claims an axis whose only observations are DECLARED', () => {
    const observations = [observation({ axis: 'size', value: 'L', kind: 'DECLARED' })]

    const evidence = evidenceFor('size', observations)

    expect(evidence.status).toBe('CLAIMED')
    expect(evidence.value).toBeNull()
    expect(evidence.observations).toEqual(observations)
  })

  it('conflicts an axis whose OBSERVED observations disagree', () => {
    const observations = [
      observation({ axis: 'size', value: 'L', kind: 'OBSERVED', collector: 'a' }),
      observation({ axis: 'size', value: 'M', kind: 'OBSERVED', collector: 'b' }),
      observation({ axis: 'size', value: 'L', kind: 'DECLARED', collector: 'repo-context' }),
    ]

    const evidence = evidenceFor('size', observations)

    expect(evidence.status).toBe('CONFLICTING')
    expect(evidence.value).toBeNull()
    expect(evidence.observations).toEqual(observations)
  })

  it('reports UNKNOWN for an axis with no observation at all', () => {
    const evidence = evidenceFor('size', [])

    expect(evidence).toEqual({
      axis: 'size',
      reading: 'SUSTAINED',
      status: 'UNKNOWN',
      value: null,
      demonstration: null,
      observations: [],
    })
  })

  it('confirms the OBSERVED value even when a DECLARED observation disagrees, because a fact never conflicts with a claim', () => {
    const observations = [
      observation({ axis: 'size', value: 'L', kind: 'OBSERVED', collector: 'live-repo' }),
      observation({ axis: 'size', value: 'XL', kind: 'DECLARED', collector: 'repo-context' }),
    ]

    const evidence = evidenceFor('size', observations)

    expect(evidence.status).toBe('CONFIRMED')
    expect(evidence.value).toBe('L')
    expect(evidence.observations).toEqual(observations)
  })

  it('claims an axis whose several DECLARED observations disagree, because no evidence was observed to conflict', () => {
    const observations = [
      observation({ axis: 'size', value: 'L', kind: 'DECLARED', collector: 'repo-context' }),
      observation({ axis: 'size', value: 'XL', kind: 'DECLARED', collector: 'readme' }),
    ]

    const evidence = evidenceFor('size', observations)

    expect(evidence.status).toBe('CLAIMED')
    expect(evidence.value).toBeNull()
    expect(evidence.observations).toEqual(observations)
  })

  it('confirms a set axis whose OBSERVED members match regardless of order', () => {
    const observations = [
      observation({
        axis: 'harness',
        value: ['prompts', 'behavior'],
        kind: 'OBSERVED',
        collector: 'a',
      }),
      observation({
        axis: 'harness',
        value: ['behavior', 'prompts'],
        kind: 'OBSERVED',
        collector: 'b',
      }),
    ]

    const evidence = evidenceFor('harness', observations)

    expect(evidence.status).toBe('CONFIRMED')
    expect(evidence.value).toEqual(['prompts', 'behavior'])
  })

  it('confirms a set axis whose OBSERVED members match once a duplicate is discounted', () => {
    const observations = [
      observation({
        axis: 'harness',
        value: ['prompts', 'prompts'],
        kind: 'OBSERVED',
        collector: 'a',
      }),
      observation({ axis: 'harness', value: ['prompts'], kind: 'OBSERVED', collector: 'b' }),
    ]

    const evidence = evidenceFor('harness', observations)

    expect(evidence.status).toBe('CONFIRMED')
  })

  it('conflicts a set axis whose OBSERVED members genuinely differ', () => {
    const observations = [
      observation({
        axis: 'harness',
        value: ['prompts', 'behavior'],
        kind: 'OBSERVED',
        collector: 'a',
      }),
      observation({ axis: 'harness', value: ['prompts'], kind: 'OBSERVED', collector: 'b' }),
    ]

    const evidence = evidenceFor('harness', observations)

    expect(evidence.status).toBe('CONFLICTING')
  })

  it('conflicts observations of the same axis whose values differ only in type, because no cross-type coercion happens', () => {
    const observations = [
      observation({ axis: 'parallelism', value: 1, kind: 'OBSERVED', collector: 'a' }),
      observation({ axis: 'parallelism', value: '1', kind: 'OBSERVED', collector: 'b' }),
    ]

    const evidence = evidenceFor('parallelism', observations)

    expect(evidence.status).toBe('CONFLICTING')
  })

  it('resolves one Evidence per requested axis and reading, absent axes included', () => {
    const observations = [observation({ axis: 'size', value: 'L', kind: 'OBSERVED' })]

    const evidences = resolveEvidence(observations, ['size', 'harness'])

    expect(evidences.map((e) => `${e.axis}:${e.reading}`)).toEqual([
      'size:SUSTAINED',
      'size:DEMONSTRATED',
      'harness:SUSTAINED',
      'harness:DEMONSTRATED',
    ])
    expect(demonstratedFor('harness', observations).status).toBe('UNKNOWN')
    expect(demonstratedFor('size', observations).status).toBe('UNKNOWN')
  })

  it('keeps a disagreement inside the reading it happened in', () => {
    const observations = [
      observation({ axis: 'size', reading: 'SUSTAINED', value: 'M' }),
      observation({ axis: 'size', reading: 'SUSTAINED', value: 'L' }),
      observation({
        axis: 'size',
        reading: 'DEMONSTRATED',
        value: 'XL',
        demonstration: { share: 0.4, unit: 'DELIVERIES' },
      }),
    ]

    // INVARIANT: CONFLICTING must keep meaning "two collectors saw the same thing differently". A
    // habitual value and a demonstrated one differ by design, so comparing across the two would
    // call every subject that answers both a conflict and cost it the whole axis.
    expect(evidenceFor('size', observations).status).toBe('CONFLICTING')
    expect(demonstratedFor('size', observations)).toMatchObject({
      status: 'CONFIRMED',
      value: 'XL',
      demonstration: { share: 0.4, unit: 'DELIVERIES' },
    })
  })

  it('carries the demonstration of the observation that agreed, and none on a habitual value', () => {
    expect(
      demonstratedFor('size', [
        observation({
          axis: 'size',
          reading: 'DEMONSTRATED',
          value: 'L',
          demonstration: { share: 0.35, unit: 'ACTIVE_DAYS' },
        }),
      ]).demonstration,
    ).toEqual({ share: 0.35, unit: 'ACTIVE_DAYS' })
    expect(
      evidenceFor('size', [observation({ axis: 'size', value: 'L' })]).demonstration,
    ).toBeNull()
  })
})
