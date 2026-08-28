import { describe, expect, it } from 'vitest'
import { checkMaturity } from '../../src/maturity/engine/maturity-engine.js'
import { InvalidMaturityModelError } from '../../src/maturity/models/invalid-maturity-model.error.js'
import type {
  AxisObservation,
  ObservedValue,
} from '../../src/maturity/models/axis-observation.model.js'
import type { AxisId } from '../../src/maturity/models/maturity.model.js'
import {
  loadMaturityModel,
  parseMaturityModel,
} from '../../src/maturity/loading/load-maturity-model.js'
import { validSource } from './maturity-model-document.fixture.js'

describe('parseMaturityModel', () => {
  it('accepts the minimal valid document unchanged', () => {
    expect(() => parseMaturityModel(validSource)).not.toThrow()
  })
})

describe('loadMaturityModel', () => {
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

  it('loads the canonical aidd.yml into a MaturityModel with four axes and seven ranks', () => {
    const model = loadMaturityModel('aidd.yml')
    expect(model.axes.map((axis) => axis.id).sort()).toEqual([
      'harness',
      'intervention',
      'parallelism',
      'size',
    ])
    expect(new Set(model.levels.map((level) => level.rank)).size).toBe(7)
  })

  it('grades a Copper-shaped repository at Copper once loaded', () => {
    const model = loadMaturityModel('aidd.yml')
    const check = checkMaturity(model, copperShaped)
    expect(check.proven?.level.id).toBe('copper')
  })

  describe('a path the filesystem cannot serve', () => {
    it('refuses a path that does not exist, naming the path and the reason', () => {
      const run = () => loadMaturityModel('this-file-does-not-exist.yml')
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/this-file-does-not-exist\.yml/)
      expect(run).toThrow(/ENOENT/)
    })

    it('refuses a path that is a directory, naming the path and the reason', () => {
      const run = () => loadMaturityModel('src')
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/src/)
    })
  })
})
