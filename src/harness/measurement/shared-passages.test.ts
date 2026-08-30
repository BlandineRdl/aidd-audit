import { describe, expect, it } from 'vitest'
import { SHINGLE_LENGTH, sharedPassagesBetween, wordsOf } from './shared-passages.js'

describe('shared passages', () => {
  it('finds a shared eight-word sequence reworded across two files that share no whole line', () => {
    const left = 'Preamble text goes here. the quick brown fox jumps over the lazy dog, and stops.'
    const right =
      'Different opening sentence entirely! The Quick Brown Fox jumps over the lazy tail wagged happily.'

    expect(sharedPassagesBetween(left, right)).toEqual([
      { words: ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy'] },
    ])
  })

  it('finds nothing shared between two files with no repeated sequence', () => {
    const left = 'one two three four five six seven eight'
    const right = 'nothing in common at all here whatsoever today'

    expect(sharedPassagesBetween(left, right)).toEqual([])
  })

  it('drops fenced code blocks before comparing words', () => {
    const left = ['```', 'const shared = repeated eight word passage in code', '```', 'prose'].join(
      '\n',
    )
    const right = 'const shared = repeated eight word passage in code'

    expect(sharedPassagesBetween(left, right)).toEqual([])
  })

  it('uses a chosen sequence length of eight words', () => {
    expect(SHINGLE_LENGTH).toBe(8)
  })

  it('normalises case and strips punctuation before comparing words', () => {
    expect(wordsOf('Hello, World!')).toEqual(['hello', 'world'])
  })
})

describe('a run of shared words longer than one sequence', () => {
  const twelveWords = 'loading turns a yaml file into a model the engine may trust'

  it('is reported once, at its full length, not once per overlapping window', () => {
    const shared = sharedPassagesBetween(`alpha ${twelveWords} omega`, `beta ${twelveWords} zeta`)

    expect(shared).toHaveLength(1)
    expect(shared[0]?.words).toHaveLength(12)
    expect(shared[0]?.words.join(' ')).toBe(twelveWords)
  })

  it('keeps two runs separated by unshared words apart', () => {
    const left = `${'one two three four five six seven eight'} gap ${'nine ten eleven twelve thirteen fourteen fifteen sixteen'}`
    const right = `${'one two three four five six seven eight'} other ${'nine ten eleven twelve thirteen fourteen fifteen sixteen'}`

    const shared = sharedPassagesBetween(left, right)

    expect(shared).toHaveLength(2)
    expect(shared.every((passage) => passage.words.length === 8)).toBe(true)
  })

  it('does not merge adjacent left windows found at separate right-hand positions', () => {
    const left = 'a b c d e f g h i'
    const right = 'a b c d e f g h gap b c d e f g h i'

    expect(sharedPassagesBetween(left, right)).toEqual([
      { words: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] },
      { words: ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] },
    ])
  })
})
