import { describe, expect, it } from 'vitest'
import { resolveEvidence } from '../../src/evidence/resolution/resolve-evidence.js'
import type { Observation } from '../../src/evidence/models/observation.model.js'

function observation(overrides: Partial<Observation> & Pick<Observation, 'axis'>): Observation {
  return {
    value: 'L',
    kind: 'OBSERVED',
    collector: 'fixture-collector',
    basis: 'fixture',
    ...overrides,
  }
}

const evidenceFor = (axis: string, observations: readonly Observation[]) =>
  resolveEvidence(observations, [axis])[0]!

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

    expect(evidence).toEqual({ axis: 'size', status: 'UNKNOWN', value: null, observations: [] })
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

  it('resolves one Evidence per requested axis, including axes absent from the observations', () => {
    const observations = [observation({ axis: 'size', value: 'L', kind: 'OBSERVED' })]

    const evidences = resolveEvidence(observations, ['size', 'harness'])

    expect(evidences.map((e) => e.axis)).toEqual(['size', 'harness'])
    expect(evidences.find((e) => e.axis === 'harness')?.status).toBe('UNKNOWN')
  })
})
