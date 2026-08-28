import { describe, expect, it } from 'vitest'
import { checkMaturity } from './maturity-engine.js'
import { InvalidMaturityModelError } from '../models/invalid-maturity-model.error.js'
import { InvalidObservationError } from './invalid-observation.error.js'
import type {
  AxisObservation,
  EvidenceConfidence,
  ObservedValue,
} from '../models/axis-observation.model.js'
import type { AxisId, MaturityModel } from '../models/maturity.model.js'
import { validModel as model } from './maturity-model.test-fixture.js'

/**
 * The executable specification: no filesystem, no Git, no YAML, no CLI. It
 * assumes a well-formed model, as the engine does. When prose and these tests
 * disagree, these decide.
 */
type Unproven = Exclude<EvidenceConfidence, 'CONFIRMED'>

type Reading =
  | { readonly confidence: 'CONFIRMED'; readonly value: ObservedValue }
  | { readonly confidence: Unproven }

const confirmed = (value: ObservedValue): Reading => ({ confidence: 'CONFIRMED', value })
const unproven = (confidence: Unproven): Reading => ({ confidence })

function observe(overrides: Partial<Record<AxisId, Reading>> = {}): AxisObservation[] {
  const base: Record<AxisId, Reading> = {
    size: confirmed('L'),
    harness: confirmed(['prompts', 'context-engineering']),
    parallelism: confirmed(3),
    ...overrides,
  }
  return Object.entries(base).map(([axis, reading]) =>
    reading.confidence === 'CONFIRMED'
      ? { axis, confidence: reading.confidence, value: reading.value }
      : { axis, confidence: reading.confidence, value: null },
  )
}

const axisOf = (check: ReturnType<typeof checkMaturity>, levelId: string, axis: AxisId) =>
  check.levels.find((l) => l.level.id === levelId)!.axes.find((a) => a.axis === axis)!

describe('requirement resolution', () => {
  it('is MET when CONFIRMED evidence reaches the threshold', () => {
    const check = checkMaturity(model, observe({ size: confirmed('L') }))
    expect(axisOf(check, 'high', 'size').outcome).toBe('MET')
  })

  it('is MET when CONFIRMED evidence exceeds the threshold, because cells are minimums', () => {
    const check = checkMaturity(model, observe({ parallelism: confirmed(4) }))
    expect(axisOf(check, 'high', 'parallelism').outcome).toBe('MET')
  })

  it('is NOT_MET when CONFIRMED evidence falls short of the threshold', () => {
    const check = checkMaturity(model, observe({ size: confirmed('M') }))
    expect(axisOf(check, 'high', 'size').outcome).toBe('NOT_MET')
  })

  it.each<Unproven>(['CLAIMED', 'CONFLICTING', 'UNKNOWN'])(
    'is UNPROVEN when the evidence is %s',
    (confidence) => {
      const check = checkMaturity(model, observe({ size: unproven(confidence) }))
      expect(axisOf(check, 'high', 'size').outcome).toBe('UNPROVEN')
    },
  )

  it('is UNPROVEN when the axis was never observed', () => {
    const check = checkMaturity(
      model,
      observe().filter((o) => o.axis !== 'size'),
    )
    expect(axisOf(check, 'high', 'size').outcome).toBe('UNPROVEN')
  })

  it('needs every member of a set requirement, not just one', () => {
    const check = checkMaturity(model, observe({ harness: confirmed(['prompts']) }))
    expect(axisOf(check, 'high', 'harness').outcome).toBe('NOT_MET')
    expect(axisOf(check, 'low', 'harness').outcome).toBe('MET')
  })

  it('accepts a set holding more than the requirement asks', () => {
    const check = checkMaturity(
      model,
      observe({ harness: confirmed(['prompts', 'context-engineering', 'behavior']) }),
    )
    expect(axisOf(check, 'high', 'harness').outcome).toBe('MET')
  })
})

describe('axis satisfaction', () => {
  it('is MET when every requirement is MET', () => {
    expect(axisOf(checkMaturity(model, observe()), 'high', 'size').outcome).toBe('MET')
  })

  it('is NOT_MET as soon as one requirement is NOT_MET', () => {
    const check = checkMaturity(model, observe({ size: confirmed('M') }))
    expect(axisOf(check, 'high', 'size').outcome).toBe('NOT_MET')
  })

  it('is UNPROVEN when nothing is NOT_MET and at least one requirement is UNPROVEN', () => {
    const check = checkMaturity(model, observe({ harness: unproven('UNKNOWN') }))
    expect(axisOf(check, 'high', 'harness').outcome).toBe('UNPROVEN')
  })

  it('lets NOT_MET dominate UNPROVEN, because disproof is firmer than absence', () => {
    const check = checkMaturity(
      model,
      observe({ size: confirmed('M'), harness: unproven('UNKNOWN') }),
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
    const check = checkMaturity(model, observe({ parallelism: confirmed(1) }))
    expect(check.levels.find((l) => l.level.id === 'high')!.outcome).toBe('NOT_MET')
  })

  it('is not reached when one axis is UNPROVEN', () => {
    const check = checkMaturity(model, observe({ parallelism: unproven('UNKNOWN') }))
    expect(check.levels.find((l) => l.level.id === 'high')!.outcome).toBe('UNPROVEN')
  })

  it('keeps a fully proven lower level when the higher one is only unproven', () => {
    const check = checkMaturity(model, observe({ parallelism: confirmed(1), size: confirmed('S') }))
    expect(check.proven?.level.id).toBe('low')
    expect(check.next?.level.id).toBe('high')
    expect(check.levels.find((l) => l.level.id === 'high')!.outcome).toBe('NOT_MET')
  })

  it('separates "not mature enough" from "we do not know yet"', () => {
    const notMature = checkMaturity(
      model,
      observe({ size: confirmed('S'), parallelism: confirmed(1) }),
    )
    const unknown = checkMaturity(model, observe({ size: unproven('UNKNOWN') }))
    expect(notMature.levels.find((l) => l.level.id === 'high')!.outcome).toBe('NOT_MET')
    expect(unknown.levels.find((l) => l.level.id === 'high')!.outcome).toBe('UNPROVEN')
  })

  it('proves no level at all when nothing is CONFIRMED, rather than defaulting to the floor', () => {
    const check = checkMaturity(
      model,
      observe({
        size: unproven('UNKNOWN'),
        harness: unproven('UNKNOWN'),
        parallelism: unproven('UNKNOWN'),
      }),
    )
    expect(check.proven).toBeNull()
    expect(check.next?.level.id).toBe('low')
  })

  it('points next at the level immediately above the proven one', () => {
    const check = checkMaturity(model, observe({ size: confirmed('S'), parallelism: confirmed(1) }))
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

/** An invalid model is refused at the loading boundary, before anything is scored. */
describe('an unusable observation is rejected, never worked around', () => {
  it('refuses two observations of the same axis instead of keeping the last', () => {
    const twice = [...observe(), { axis: 'size', confidence: 'CONFIRMED', value: 'S' } as const]
    expect(() => checkMaturity(model, twice)).toThrow(InvalidObservationError)
  })

  it('rejects a value that is not on its scale instead of guessing a rank', () => {
    expect(() => checkMaturity(model, observe({ size: confirmed('XXL') }))).toThrow(
      InvalidObservationError,
    )
  })

  it('rejects a value whose type does not match the scale', () => {
    expect(() => checkMaturity(model, observe({ harness: confirmed('prompts') }))).toThrow(
      InvalidObservationError,
    )
    expect(() => checkMaturity(model, observe({ parallelism: confirmed('3') }))).toThrow(
      InvalidObservationError,
    )
  })
})

/**
 * A model defect is rejected, never scored. These guards live in the engine only
 * until the loader owns them; the behaviour they protect is permanent.
 */
describe('an invalid model is rejected, never scored', () => {
  const withHigh = (
    requirements: MaturityModel['levels'][number]['requirements'],
  ): MaturityModel => ({
    ...model,
    levels: model.levels.map((level) => (level.id === 'high' ? { ...level, requirements } : level)),
  })

  /**
   * The engine's `scales` is a plain object built by hand — which is what every
   * model in this suite is — so an axis naming an inherited member resolves to
   * a function and every `kind` branch misses it.
   */
  it('refuses an axis whose scale only resolves off Object.prototype', () => {
    const inherited: MaturityModel = {
      ...model,
      axes: model.axes.map((axis) =>
        axis.id === 'size' ? { ...axis, scale: 'constructor' } : axis,
      ),
    }
    expect(() => checkMaturity(inherited, observe({ size: confirmed('S') }))).toThrow(
      InvalidMaturityModelError,
    )
  })

  it('refuses a level silent on an axis, which would otherwise grant it for free', () => {
    const holed = withHigh(model.levels[1]!.requirements.filter((r) => r.axis !== 'parallelism'))
    expect(() => checkMaturity(holed, observe({ parallelism: confirmed(1) }))).toThrow(
      InvalidMaturityModelError,
    )
  })

  it('refuses an ordinal threshold off its scale, which every observation would clear', () => {
    const typo = withHigh([
      { axis: 'size', min: 'XXL' },
      { axis: 'harness', includes: ['prompts'] },
      { axis: 'parallelism', min: 3 },
    ])
    expect(() => checkMaturity(typo, observe())).toThrow(InvalidMaturityModelError)
  })

  it('refuses a set member off its scale, which would report a practice gap', () => {
    const typo = withHigh([
      { axis: 'size', min: 'L' },
      { axis: 'harness', includes: ['telepathy'] },
      { axis: 'parallelism', min: 3 },
    ])
    expect(() => checkMaturity(typo, observe())).toThrow(InvalidMaturityModelError)
  })

  it('refuses a non-finite minimum on a numeric axis, rather than scoring it NOT_MET', () => {
    const typo = withHigh([
      { axis: 'size', min: 'L' },
      { axis: 'harness', includes: ['prompts', 'context-engineering'] },
      { axis: 'parallelism', min: Number.NaN },
    ])
    expect(() => checkMaturity(typo, observe())).toThrow(InvalidMaturityModelError)
    expect(() => checkMaturity(typo, observe())).toThrow(/min must be a finite number/)
  })

  it('refuses a non-numeric minimum on a numeric axis', () => {
    const typo = withHigh([
      { axis: 'size', min: 'L' },
      { axis: 'harness', includes: ['prompts'] },
      { axis: 'parallelism', min: 'three' },
    ])
    expect(() => checkMaturity(typo, observe())).toThrow(InvalidMaturityModelError)
  })

  it("refuses 'includes' on a scale that is not a set", () => {
    const typo = withHigh([
      { axis: 'size', includes: ['L'] },
      { axis: 'harness', includes: ['prompts'] },
      { axis: 'parallelism', min: 3 },
    ])
    expect(() => checkMaturity(typo, observe())).toThrow(InvalidMaturityModelError)
  })

  it('refuses a min threshold on a set-scaled axis, capitalising its own sentence', () => {
    const typo = withHigh([
      { axis: 'size', min: 'L' },
      { axis: 'harness', min: 'prompts' },
      { axis: 'parallelism', min: 3 },
    ])
    expect(() => checkMaturity(typo, observe())).toThrow(InvalidMaturityModelError)
    expect(() => checkMaturity(typo, observe())).toThrow(
      /^Axis 'harness' is a set scale and needs 'includes'\.$/,
    )
  })

  it('refuses a requirement pointing at an axis the model does not declare', () => {
    const typo = withHigh([...model.levels[1]!.requirements, { axis: 'paralellism', min: 3 }])
    expect(() => checkMaturity(typo, observe())).toThrow(InvalidMaturityModelError)
  })
})

describe('determinism', () => {
  it('returns the same result for the same input', () => {
    const once = checkMaturity(model, observe({ size: confirmed('M') }))
    const twice = checkMaturity(model, observe({ size: confirmed('M') }))
    expect(JSON.stringify(once)).toEqual(JSON.stringify(twice))
  })
})
