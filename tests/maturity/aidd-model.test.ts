import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import YAML from 'yaml'
import { checkMaturity } from '../../src/maturity/usecases/check-maturity.usecase.js'
import type { MaturityModel } from '../../src/maturity/models/maturity.model.js'

/**
 * The canonical model, checked against the engine that will load it.
 *
 * Not a decision test: those stay free of the filesystem and of YAML, and this
 * one reads both on purpose. It exists so a typo in aidd.yml — a level silent
 * on an axis, a misspelt axis name, a threshold off its scale — fails at commit
 * instead of at assessment time.
 */
const model = YAML.parse(readFileSync('aidd.yml', 'utf8')) as MaturityModel

const confirmed = (axis: string, value: unknown) =>
  ({ axis, confidence: 'CONFIRMED', value }) as never

describe('aidd.yml', () => {
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

  it('is accepted by the engine, which rejects a level silent on an axis', () => {
    expect(() =>
      checkMaturity(model, [
        confirmed('size', 'L'),
        confirmed('harness', ['prompts', 'context-engineering', 'behavior']),
        confirmed('intervention', 'key-steps'),
        confirmed('parallelism', 3),
      ]),
    ).not.toThrow()
  })

  it('states every threshold on its own scale', () => {
    const scaleOf = (axisId: string) => {
      const axis = model.axes.find((candidate) => candidate.id === axisId)!
      return model.scales[axis.scale]!
    }
    for (const level of model.levels) {
      for (const requirement of level.requirements) {
        const scale = scaleOf(requirement.axis)
        if ('includes' in requirement) {
          expect(scale.kind).toBe('set')
          if (scale.kind !== 'set') continue
          for (const member of requirement.includes) expect(scale.members).toContain(member)
        } else if (scale.kind === 'ordinal') {
          expect(scale.values).toContain(String(requirement.min))
        } else {
          expect(typeof requirement.min).toBe('number')
        }
      }
    }
  })

  it('grades a Copper-shaped repository at Copper, and points next at Silver', () => {
    const check = checkMaturity(model, [
      confirmed('size', 'L'),
      confirmed('harness', ['prompts', 'context-engineering', 'behavior']),
      confirmed('intervention', 'key-steps'),
      confirmed('parallelism', 3),
    ])
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

  /**
   * Every level of this model declares all four axes, so one unobserved axis
   * makes every level unprovable, White included. That is the conservative rule
   * taken to its end: nothing is inferred from missing information. The report
   * still explains itself through coverage and the blocking requirements.
   */
  it('proves nothing at all when a single axis stays unknown', () => {
    const check = checkMaturity(model, [
      confirmed('size', 'L'),
      confirmed('harness', ['prompts', 'context-engineering', 'behavior']),
      confirmed('intervention', 'key-steps'),
      { axis: 'parallelism', confidence: 'UNKNOWN', value: null } as never,
    ])
    expect(check.proven).toBeNull()
    expect(check.next?.level.id).toBe('white')
    expect(check.next?.outcome).toBe('UNPROVEN')
  })
})
