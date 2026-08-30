import { describe, expect, it } from 'vitest'
import { LIST_LINE_READING, measureProseShare, stripFencedBlocks } from './prose-share.js'

describe('prose share', () => {
  it('counts bullet, ordered and table list lines apart from prose lines', () => {
    const content = ['- one', '1. two', '| a | b |', 'just a sentence.'].join('\n')

    expect(measureProseShare(content)).toEqual({ countable: true, listLines: 3, proseLines: 1 })
  })

  it('ignores blank lines and lines inside a fenced code block', () => {
    const content = [
      'prose line',
      '',
      '```',
      '- not a list, just code',
      '```',
      '- a real list line',
    ].join('\n')

    expect(measureProseShare(content)).toEqual({ countable: true, listLines: 1, proseLines: 1 })
  })

  it('reports no countable line for a file that is entirely a code fence, rather than a share of zero', () => {
    const content = ['```', 'const x = 1', '```'].join('\n')

    expect(measureProseShare(content)).toEqual({ countable: false })
  })

  it('reports no countable line for an empty file', () => {
    expect(measureProseShare('')).toEqual({ countable: false })
  })

  it('states its own reading of what counts as a list line', () => {
    expect(LIST_LINE_READING).toContain('table')
  })

  it('drops fenced blocks entirely, for the duplication measurement to reuse', () => {
    const content = ['keep this', '```', 'drop this', '```', 'keep this too'].join('\n')

    expect(stripFencedBlocks(content)).toBe('keep this\nkeep this too')
  })
})
