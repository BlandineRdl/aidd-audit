import { describe, expect, it } from 'vitest'
import {
  checkMaturity,
  MaturityModelError,
} from '../../src/maturity/usecases/check-maturity.usecase.js'
import type {
  AxisObservation,
  EvidenceConfidence,
} from '../../src/maturity/models/axis-observation.model.js'
import type { MaturityModel } from '../../src/maturity/models/maturity.model.js'

/**
 * The executable specification of the product.
 *
 * These tests freeze the decision semantics and touch no filesystem, no Git, no
 * YAML and no CLI. The model below is a fixture of the shape aidd.yml carries,
 * not aidd.yml itself: the engine must not depend on the canonical thresholds.
 *
 * When prose and these tests disagree, these tests decide.
 */
const model: MaturityModel = {
  schemaVersion: 1,
  id: 'test',
  scales: {
    size: { kind: 'ordinal', values: ['none', 'S', 'M', 'L'] },
    harness: { kind: 'set', members: ['prompts', 'context-engineering', 'behavior'] },
    parallelism: { kind: 'numeric' },
  },
  axes: [
    { id: 'size', label: 'Taille', scale: 'size' },
    { id: 'harness', label: 'Harness', scale: 'harness' },
    { id: 'parallelism', label: 'En parallèle', scale: 'parallelism' },
  ],
  levels: [
    {
      id: 'low',
      rank: 1,
      label: 'Low',
      requirements: [
        { axis: 'size', min: 'S' },
        { axis: 'harness', includes: ['prompts'] },
        { axis: 'parallelism', min: 1 },
      ],
    },
    {
      id: 'high',
      rank: 2,
      label: 'High',
      requirements: [
        { axis: 'size', min: 'L' },
        { axis: 'harness', includes: ['prompts', 'context-engineering'] },
        { axis: 'parallelism', min: 3 },
      ],
    },
  ],
}

function observe(
  overrides: Partial<Record<string, [unknown, EvidenceConfidence]>> = {},
): AxisObservation[] {
  const base: Record<string, [unknown, EvidenceConfidence]> = {
    size: ['L', 'CONFIRMED'],
    harness: [['prompts', 'context-engineering'], 'CONFIRMED'],
    parallelism: [3, 'CONFIRMED'],
    ...overrides,
  }
  return Object.entries(base).map(([axis, [value, confidence]]) => ({
    axis,
    confidence,
    value: value as AxisObservation['value'],
  }))
}

const requirementOf = (check: ReturnType<typeof checkMaturity>, levelId: string, axis: string) =>
  check.levels.find((l) => l.level.id === levelId)!.axes.find((a) => a.axis === axis)!

describe('requirement resolution', () => {
  it('is MET when CONFIRMED evidence reaches the threshold', () => {
    const check = checkMaturity(model, observe({ size: ['L', 'CONFIRMED'] }))
    expect(requirementOf(check, 'high', 'size').outcome).toBe('MET')
  })

  it('is MET when CONFIRMED evidence exceeds the threshold, because cells are minimums', () => {
    const check = checkMaturity(model, observe({ parallelism: [4, 'CONFIRMED'] }))
    expect(requirementOf(check, 'high', 'parallelism').outcome).toBe('MET')
  })

  it('is NOT_MET when CONFIRMED evidence falls short of the threshold', () => {
    const check = checkMaturity(model, observe({ size: ['M', 'CONFIRMED'] }))
    expect(requirementOf(check, 'high', 'size').outcome).toBe('NOT_MET')
  })

  it.each<EvidenceConfidence>(['CLAIMED', 'CONFLICTING', 'UNKNOWN'])(
    'is UNPROVEN when the evidence is %s, whatever the value',
    (confidence) => {
      const check = checkMaturity(model, observe({ size: ['L', confidence] }))
      expect(requirementOf(check, 'high', 'size').outcome).toBe('UNPROVEN')
    },
  )

  it('is UNPROVEN when the axis was never observed', () => {
    const check = checkMaturity(
      model,
      observe().filter((o) => o.axis !== 'size'),
    )
    expect(requirementOf(check, 'high', 'size').outcome).toBe('UNPROVEN')
  })

  it('is UNPROVEN when a collector reported the axis without a value', () => {
    const check = checkMaturity(model, observe({ size: [null, 'CONFIRMED'] }))
    expect(requirementOf(check, 'high', 'size').outcome).toBe('UNPROVEN')
  })

  it('needs every member of a set requirement, not just one', () => {
    const check = checkMaturity(model, observe({ harness: [['prompts'], 'CONFIRMED'] }))
    expect(requirementOf(check, 'high', 'harness').outcome).toBe('NOT_MET')
    expect(requirementOf(check, 'low', 'harness').outcome).toBe('MET')
  })

  it('accepts a set holding more than the requirement asks', () => {
    const check = checkMaturity(
      model,
      observe({ harness: [['prompts', 'context-engineering', 'behavior'], 'CONFIRMED'] }),
    )
    expect(requirementOf(check, 'high', 'harness').outcome).toBe('MET')
  })
})

describe('axis satisfaction', () => {
  it('is MET when every requirement is MET', () => {
    expect(requirementOf(checkMaturity(model, observe()), 'high', 'size').outcome).toBe('MET')
  })

  it('is NOT_MET as soon as one requirement is NOT_MET', () => {
    const check = checkMaturity(model, observe({ size: ['M', 'CONFIRMED'] }))
    expect(requirementOf(check, 'high', 'size').outcome).toBe('NOT_MET')
  })

  it('is UNPROVEN when nothing is NOT_MET and at least one requirement is UNPROVEN', () => {
    const check = checkMaturity(model, observe({ harness: [['prompts'], 'UNKNOWN'] }))
    expect(requirementOf(check, 'high', 'harness').outcome).toBe('UNPROVEN')
  })

  it('lets NOT_MET dominate UNPROVEN, because disproof is firmer than absence', () => {
    const check = checkMaturity(
      model,
      observe({ size: ['M', 'CONFIRMED'], harness: [null, 'UNKNOWN'] }),
    )
    const high = check.levels.find((l) => l.level.id === 'high')!
    expect(high.outcome).toBe('NOT_MET')
  })
})

describe('level satisfaction', () => {
  it('is satisfied when all axes are MET', () => {
    const check = checkMaturity(model, observe())
    expect(check.proven?.level.id).toBe('high')
  })

  it('is not reached when one axis is NOT_MET', () => {
    const check = checkMaturity(model, observe({ parallelism: [1, 'CONFIRMED'] }))
    expect(check.levels.find((l) => l.level.id === 'high')!.outcome).toBe('NOT_MET')
  })

  it('is not reached when one axis is UNPROVEN', () => {
    const check = checkMaturity(model, observe({ parallelism: [3, 'UNKNOWN'] }))
    expect(check.levels.find((l) => l.level.id === 'high')!.outcome).toBe('UNPROVEN')
  })

  it('keeps a fully proven lower level when the higher one is only unproven', () => {
    const check = checkMaturity(
      model,
      observe({ parallelism: [1, 'CONFIRMED'], size: ['S', 'CONFIRMED'] }),
    )
    expect(check.proven?.level.id).toBe('low')
    expect(check.next?.level.id).toBe('high')
    expect(check.levels.find((l) => l.level.id === 'high')!.outcome).toBe('NOT_MET')
  })

  it('separates "not mature enough" from "we do not know yet"', () => {
    const notMature = checkMaturity(
      model,
      observe({ size: ['S', 'CONFIRMED'], parallelism: [1, 'CONFIRMED'] }),
    )
    const unknown = checkMaturity(model, observe({ size: ['L', 'UNKNOWN'] }))
    expect(notMature.levels.find((l) => l.level.id === 'high')!.outcome).toBe('NOT_MET')
    expect(unknown.levels.find((l) => l.level.id === 'high')!.outcome).toBe('UNPROVEN')
  })

  it('proves no level at all when nothing is CONFIRMED, rather than defaulting to the floor', () => {
    const check = checkMaturity(
      model,
      observe({
        size: ['L', 'UNKNOWN'],
        harness: [['prompts'], 'UNKNOWN'],
        parallelism: [3, 'UNKNOWN'],
      }),
    )
    expect(check.proven).toBeNull()
    expect(check.next?.level.id).toBe('low')
  })

  it('points next at the level immediately above the proven one', () => {
    const check = checkMaturity(
      model,
      observe({ size: ['S', 'CONFIRMED'], parallelism: [1, 'CONFIRMED'] }),
    )
    expect(check.proven?.level.id).toBe('low')
    expect(check.next?.level.rank).toBe(2)
  })

  it('reports no next level once the top is proven', () => {
    expect(checkMaturity(model, observe()).next).toBeNull()
  })

  it('orders levels by rank, never by declaration order', () => {
    const shuffled: MaturityModel = { ...model, levels: [...model.levels].reverse() }
    expect(checkMaturity(shuffled, observe()).levels.map((l) => l.level.rank)).toEqual([1, 2])
  })
})

describe('an invalid model is rejected, never worked around', () => {
  it('refuses two observations of the same axis instead of keeping the last', () => {
    const twice = [...observe(), { axis: 'size', confidence: 'CONFIRMED', value: 'S' } as const]
    expect(() => checkMaturity(model, twice)).toThrow(MaturityModelError)
  })

  it('refuses a level silent on an axis, which would otherwise grant it for free', () => {
    const holed: MaturityModel = {
      ...model,
      levels: model.levels.map((level) =>
        level.id === 'high'
          ? { ...level, requirements: level.requirements.filter((r) => r.axis !== 'parallelism') }
          : level,
      ),
    }
    expect(() => checkMaturity(holed, observe())).toThrow(MaturityModelError)
  })

  it('refuses a requirement pointing at an axis the model does not declare', () => {
    const typo: MaturityModel = {
      ...model,
      levels: model.levels.map((level) =>
        level.id === 'high'
          ? { ...level, requirements: [...level.requirements, { axis: 'paralellism', min: 3 }] }
          : level,
      ),
    }
    expect(() => checkMaturity(typo, observe())).toThrow(MaturityModelError)
  })
})

describe('determinism', () => {
  it('returns the same result for the same input', () => {
    const once = checkMaturity(model, observe({ size: ['M', 'CONFIRMED'] }))
    const twice = checkMaturity(model, observe({ size: ['M', 'CONFIRMED'] }))
    expect(JSON.stringify(once)).toEqual(JSON.stringify(twice))
  })

  it('rejects a value that is not on its scale instead of guessing a rank', () => {
    expect(() => checkMaturity(model, observe({ size: ['XXL', 'CONFIRMED'] }))).toThrow(
      MaturityModelError,
    )
  })
})
