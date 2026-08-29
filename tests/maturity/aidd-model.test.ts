import { describe, expect, it } from 'vitest'
import { loadMaturityModel } from '../../src/maturity/loading/load-maturity-model.js'
import { checkMaturity } from '../../src/maturity/engine/maturity-engine.js'
import type {
  AxisObservation,
  ObservedValue,
} from '../../src/maturity/models/axis-observation.model.js'
import type { AxisId } from '../../src/maturity/models/maturity.model.js'

const model = loadMaturityModel('aidd.yml')

const confirmed = (axis: AxisId, value: ObservedValue): AxisObservation => ({
  axis,
  confidence: 'CONFIRMED',
  value,
})

const copperShaped: readonly AxisObservation[] = [
  confirmed('size', 'L'),
  confirmed('harness', ['prompts', 'context-engineering', 'behavior']),
  confirmed('intervention', 'key-steps'),
  confirmed('parallelism', 3),
]

describe('aidd.yml', () => {
  it('loads without throwing — shape, vocabulary, coverage and cumulativity all hold', () => {
    expect(() => loadMaturityModel('aidd.yml')).not.toThrow()
  })

  it('declares the four axes of the reference grid', () => {
    expect(model.axes.map((axis) => axis.id).sort()).toEqual([
      'harness',
      'intervention',
      'parallelism',
      'size',
    ])
  })

  it('declares the seven levels, each at a distinct rank', () => {
    const ranks = model.levels.map((level) => level.rank)
    expect(model.levels).toHaveLength(7)
    expect(new Set(ranks).size).toBe(7)
  })

  it('grades a Copper-shaped repository at Copper, and points next at Silver', () => {
    const check = checkMaturity(model, copperShaped)
    expect(check.proven?.level.id).toBe('copper')
    expect(check.next?.level.id).toBe('silver')
    expect(check.next?.outcome).toBe('NOT_MET')
  })

  it('keeps a proven level when a higher level is the only thing unknown', () => {
    const check = checkMaturity(model, [
      confirmed('size', 'L'),
      confirmed('harness', ['prompts', 'context-engineering', 'behavior']),
      confirmed('intervention', 'key-steps'),
      confirmed('parallelism', 1),
    ])
    expect(check.proven?.level.id).toBe('green')
    expect(check.next?.level.id).toBe('copper')
    expect(check.next?.outcome).toBe('NOT_MET')
  })

  it('proves nothing at all when a single axis stays unknown', () => {
    const check = checkMaturity(model, [
      confirmed('size', 'L'),
      confirmed('harness', ['prompts', 'context-engineering', 'behavior']),
      confirmed('intervention', 'key-steps'),
      { axis: 'parallelism', confidence: 'UNKNOWN', value: null },
    ])
    expect(check.proven).toBeNull()
    expect(check.next?.level.id).toBe('white')
    expect(check.next?.outcome).toBe('UNPROVEN')
  })
})
