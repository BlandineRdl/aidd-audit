import { describe, expect, it } from 'vitest'
import { InvalidMaturityModelError } from '../models/invalid-maturity-model.error.js'
import { parseMaturityModel } from './load-maturity-model.js'
import { mutate, pick } from './maturity-model-document.test-fixture.js'
import type { TestDocument } from './maturity-model-document.test-fixture.js'

describe('a well-formed model that does not hold together', () => {
  describe('an axis on an undeclared scale', () => {
    it('rejects an axis naming a scale the model does not define', () => {
      const source = mutate((document) => {
        pick(document.axes, (axis) => axis.id === 'size').scale = 'ghost'
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/ghost/)
    })
  })

  describe('an axis naming a scale that only resolves off Object.prototype', () => {
    // SAFETY: none of these keys is ever declared under `scales:`, but a plain lookup resolves each
    // one off Object.prototype as if it were.
    it.each(['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty'])(
      "rejects an axis naming a scale of '%s'",
      (scaleName) => {
        const source = mutate((document) => {
          pick(document.axes, (axis) => axis.id === 'size').scale = scaleName
        })
        const run = () => parseMaturityModel(source)
        expect(run).toThrow(InvalidMaturityModelError)
        expect(run).toThrow(new RegExp(scaleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      },
    )

    it('rejects nonsense thresholds on a scale named after a real level (AC3)', () => {
      const source = mutate((document) => {
        pick(document.axes, (axis) => axis.id === 'size').scale = 'constructor'
        pick(
          pick(document.levels ?? [], (level) => level.id === 'low').requirements,
          (r) => r.axis === 'size',
        ).min = 'NONSENSE-A'
        pick(
          pick(document.levels ?? [], (level) => level.id === 'high').requirements,
          (r) => r.axis === 'size',
        ).min = 'NONSENSE-B'
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/constructor/)
    })

    it('rejects a dip on a scale named after a real level (AC6)', () => {
      const source = mutate((document) => {
        pick(document.axes, (axis) => axis.id === 'size').scale = 'toString'
        pick(
          pick(document.levels ?? [], (level) => level.id === 'low').requirements,
          (r) => r.axis === 'size',
        ).min = 'L'
        pick(
          pick(document.levels ?? [], (level) => level.id === 'high').requirements,
          (r) => r.axis === 'size',
        ).min = 'S'
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/toString/)
    })
  })

  describe('a threshold off its axis vocabulary', () => {
    it('rejects a numeric scale with no unit description', () => {
      const source = mutate((document) => {
        delete document.scales.parallelism?.description
      })
      expect(() => parseMaturityModel(source)).toThrow(/parallelism'.description.*non-empty string/)
    })

    it('rejects an ordinal minimum absent from the scale values', () => {
      const source = mutate((document) => {
        pick(
          pick(document.levels ?? [], (level) => level.id === 'low').requirements,
          (r) => r.axis === 'size',
        ).min = 'XL'
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/XL/)
    })

    it('rejects a set member absent from the scale members', () => {
      const source = mutate((document) => {
        pick(
          pick(document.levels ?? [], (level) => level.id === 'low').requirements,
          (r) => r.axis === 'harness',
        ).includes = ['ghost-member']
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/ghost-member/)
    })

    it('rejects a min threshold on a set-scaled axis', () => {
      const source = mutate((document) => {
        const requirement = pick(
          pick(document.levels ?? [], (level) => level.id === 'low').requirements,
          (r) => r.axis === 'harness',
        )
        delete requirement.includes
        requirement.min = 'prompts'
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/harness.*is a set scale and needs 'includes'/s)
    })

    it('rejects a numeric-scale minimum that is not a number', () => {
      const source = mutate((document) => {
        document.scales.size = { kind: 'numeric', description: 'a numeric size' }
        for (const level of document.levels ?? []) {
          pick(level.requirements, (r) => r.axis === 'size').min = 'not-a-number'
        }
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      // SAFETY: this exact phrase can only come from Vocabulary's numeric check — Cumulativity
      // would also throw here (NaN >= NaN) but with a message naming no "minimum".
      expect(run).toThrow(/minimum is not a number/)
    })
  })

  describe('a requirement on an undeclared axis', () => {
    it('rejects a level that requires an axis the model does not declare', () => {
      const source = mutate((document) => {
        pick(document.levels ?? [], (level) => level.id === 'low').requirements.push({
          axis: 'ghost-axis',
          min: '1',
        })
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/ghost-axis/)
    })
  })

  describe('a level silent on an axis', () => {
    it('rejects a level that omits a declared axis', () => {
      const source = mutate((document) => {
        const low = pick(document.levels ?? [], (level) => level.id === 'low')
        low.requirements = low.requirements.filter((requirement) => requirement.axis !== 'harness')
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/low.*harness|harness.*low/is)
    })

    it('rejects a level that names one axis twice', () => {
      const source = mutate((document) => {
        pick(document.levels ?? [], (level) => level.id === 'low').requirements.push({
          axis: 'size',
          min: 'L',
        })
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/size/)
    })
  })

  describe('a level that dips', () => {
    const requirementFor = (document: TestDocument, levelId: string, axis: string) =>
      pick(
        pick(document.levels ?? [], (level) => level.id === levelId).requirements,
        (requirement) => requirement.axis === axis,
      )

    // One case per scale kind: each compares differently, so each needs pinning.
    it('rejects a dip on an ordinal axis, where the higher rank ranks lower', () => {
      const source = mutate((document) => {
        requirementFor(document, 'low', 'size').min = 'L'
        requirementFor(document, 'high', 'size').min = 'S'
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/'high' asks less than 'low' on axis 'size'/)
    })

    it('rejects a dip on a numeric axis, where the higher rank asks a smaller minimum', () => {
      const source = mutate((document) => {
        requirementFor(document, 'high', 'parallelism').min = 0
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/'high' asks less than 'low' on axis 'parallelism'/)
    })

    it('rejects a dip on a set axis, where the higher rank drops a required member', () => {
      const source = mutate((document) => {
        requirementFor(document, 'high', 'harness').includes = ['behavior']
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/'high' asks less than 'low' on axis 'harness'/)
    })
  })

  describe('ranks that do not order', () => {
    it('rejects two levels sharing a rank', () => {
      const source = mutate((document) => {
        const low = pick(document.levels ?? [], (level) => level.id === 'low')
        const high = pick(document.levels ?? [], (level) => level.id === 'high')
        high.rank = low.rank
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/Rank 1/)
    })

    // SAFETY: NaN is a number, so a typed check alone lets it through — it survives the
    // distinctness Set and leaves sort unspecified.
    it.each([
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['-Infinity', Number.NEGATIVE_INFINITY],
    ])('refuses a rank of %s, which orders against nothing', (_name, rank) => {
      const source = mutate((document) => {
        pick(document.levels ?? [], (level) => level.id === 'high').rank = rank
      })
      // SAFETY: the string '.nan' round-trips as a quoted string and would be caught by the type
      // check instead, proving nothing.
      expect(source).toMatch(/rank: -?\.(nan|inf)/)

      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/rank' must be a finite number/)
    })

    it.each([
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ])('names %s in the message, rather than reporting "a number"', (name, rank) => {
      const source = mutate((document) => {
        pick(document.levels ?? [], (level) => level.id === 'high').rank = rank
      })
      expect(() => parseMaturityModel(source)).toThrow(new RegExp(`got ${name}\\.`))
    })
  })

  describe('a threshold that is not a finite number', () => {
    // Never met by any observation, so it would report a practice gap.
    it.each([
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ])('refuses a minimum of %s rather than scoring it NOT_MET', (_name, min) => {
      const source = mutate((document) => {
        const level = pick(document.levels ?? [], (candidate) => candidate.id === 'high')
        pick(level.requirements, (requirement) => requirement.axis === 'parallelism').min = min
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/min must be a finite number/)
    })
  })

  describe('ids that are not distinct', () => {
    it('refuses two axes sharing an id', () => {
      const source = mutate((document) => {
        pick(document.axes, (axis) => axis.id === 'harness').id = 'size'
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/'axes' declares 'size' more than once/)
    })

    it('refuses two levels sharing an id', () => {
      const source = mutate((document) => {
        pick(document.levels ?? [], (level) => level.id === 'high').id = 'low'
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/'levels' declares 'low' more than once/)
    })
  })
})
