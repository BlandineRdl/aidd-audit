import { describe, expect, it } from 'vitest'
import YAML from 'yaml'
import { InvalidMaturityModelError } from '../models/invalid-maturity-model.error.js'
import { parseMaturityModel } from './load-maturity-model.js'
import { mutate, mutateShape, pick } from './maturity-model-document.test-fixture.js'

describe('a document the parser cannot turn into a model', () => {
  describe('a document that is not a model at all', () => {
    it('rejects a YAML list', () => {
      const run = () => parseMaturityModel(YAML.stringify(['not', 'a', 'model']))
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/not an array/)
    })

    it('rejects a bare scalar', () => {
      const run = () => parseMaturityModel(YAML.stringify('just a string'))
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/not a string/)
    })

    it('rejects invalid YAML syntax', () => {
      const run = () => parseMaturityModel('scales: [unterminated')
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/not valid YAML/)
    })
  })

  describe('a schemaVersion the parser does not understand', () => {
    it('rejects a schemaVersion other than 1, naming the value it got', () => {
      const source = mutate((document) => {
        document.schemaVersion = 7
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/got 7/)
    })
  })

  describe('a field of the wrong type', () => {
    it('rejects a document missing levels', () => {
      const source = mutate((document) => {
        document.levels = undefined
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/levels/i)
    })

    it('rejects a level whose rank is a string', () => {
      const source = mutate((document) => {
        pick(document.levels ?? [], (level) => level.id === 'low').rank = 'one'
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/'low'\.rank/)
    })
  })

  describe('scale descriptions', () => {
    it('rejects a scale missing the description of one of its terms', () => {
      const source = mutate((document) => {
        delete document.scales.size!.descriptions?.S
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(/descriptions.*missing 'S'/)
    })

    it('rejects a description for a term the scale does not declare', () => {
      const source = mutate((document) => {
        document.scales.size!.descriptions!.XL = 'extra large'
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(/descriptions.*XL.*not on its scale/)
    })

    it('rejects a description that is not a string', () => {
      const source = mutateShape((document) => {
        document.scales.size.descriptions.S = 1
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(/descriptions\.S.*non-empty string/)
    })
  })

  describe('a requirement carrying both min and includes', () => {
    it('rejects it, rather than silently keeping includes and dropping min', () => {
      const source = mutate((document) => {
        pick(
          pick(document.levels ?? [], (level) => level.id === 'low').requirements,
          (r) => r.axis === 'harness',
        ).min = 'prompts'
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/must carry exactly one of 'min' or 'includes'/)
    })
  })

  describe('shape guards with no prior coverage', () => {
    it('rejects an empty id', () => {
      const source = mutate((document) => {
        document.id = ''
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/'id' must be a non-empty string/)
    })

    it('rejects a scale whose values are not all strings', () => {
      const source = mutateShape((document) => {
        document.scales.size = { kind: 'ordinal', values: [1, 2] }
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/'size'\.values' must be an array of strings/)
    })

    it('rejects scales that is not a mapping', () => {
      const source = mutateShape((document) => {
        document.scales = null
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/'scales' must be a mapping/)
    })

    it('rejects an empty scales mapping', () => {
      const source = mutateShape((document) => {
        document.scales = {}
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/'scales' must declare at least one scale/)
    })

    it('rejects a scale that is not a mapping', () => {
      const source = mutateShape((document) => {
        document.scales.size = 'ordinal'
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/Scale 'size' must be a mapping/)
    })

    it('rejects a scale with an unrecognised kind', () => {
      const source = mutateShape((document) => {
        document.scales.size = { kind: 'fuzzy' }
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/Scale 'size' has an unknown kind/)
    })

    it.each([
      ['an empty array', []],
      ['null', null],
    ])('rejects axes that is %s', (_label, value) => {
      const source = mutateShape((document) => {
        document.axes = value
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/'axes' must be a non-empty array/)
    })

    it('rejects an axis that is not a mapping', () => {
      const source = mutateShape((document) => {
        document.axes = [3]
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/axes\[0\] must be a mapping/)
    })

    it('rejects a level that is not a mapping', () => {
      const source = mutateShape((document) => {
        document.levels = ['red']
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/levels\[0\] must be a mapping/)
    })

    it('rejects a level whose requirements is not an array', () => {
      const source = mutateShape((document) => {
        document.levels[0].requirements = null
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/requirements must be an array/)
    })

    it('rejects a requirement that is not a mapping', () => {
      const source = mutateShape((document) => {
        document.levels[0].requirements = [null]
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/requirements\[0\] must be a mapping/)
    })

    it.each([
      ['null', null],
      ['an array', [1]],
    ])('rejects a min that is %s', (_label, value) => {
      const source = mutateShape((document) => {
        document.levels[0].requirements[0].min = value
      })
      const run = () => parseMaturityModel(source)
      expect(run).toThrow(InvalidMaturityModelError)
      expect(run).toThrow(/min must be a string or a number/)
    })
  })
})
