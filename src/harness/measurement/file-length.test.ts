import { describe, expect, it } from 'vitest'
import { GptTokenizerEncoderAdapter } from '../adapters/token-encoder.adapter.js'
import { countLines, measureFileLength, splitLines } from './file-length.js'

const encoder = new GptTokenizerEncoderAdapter()

describe('file length', () => {
  it('counts lines and tokens independently, so one file can be long in one and short in the other', () => {
    const manyShortLines = Array.from({ length: 50 }, () => 'x').join('\n')
    const oneLongLine = 'the quick brown fox jumps over the lazy dog '.repeat(20)

    const manyLines = measureFileLength(manyShortLines, encoder)
    const oneLine = measureFileLength(oneLongLine, encoder)

    expect(manyLines.lineCount).toBe(50)
    expect(oneLine.lineCount).toBe(1)
    expect(oneLine.tokenEstimate).toBeGreaterThan(manyLines.tokenEstimate)
  })

  it('counts the same lines whether or not the file ends with a trailing newline', () => {
    expect(countLines('a\nb\n')).toBe(2)
    expect(countLines('a\nb')).toBe(2)
  })

  it('counts zero lines for an empty file', () => {
    expect(countLines('')).toBe(0)
    expect(splitLines('')).toEqual([])
  })

  it('returns the same estimate for the same text measured twice', () => {
    const content = 'the same text, measured twice over'

    expect(measureFileLength(content, encoder)).toEqual(measureFileLength(content, encoder))
  })
})
