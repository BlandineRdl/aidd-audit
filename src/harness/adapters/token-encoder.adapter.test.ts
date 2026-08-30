import { describe, expect, it } from 'vitest'
import { GptTokenizerEncoderAdapter } from './token-encoder.adapter.js'

describe('the gpt-tokenizer encoder adapter', () => {
  it('returns the same estimate for the same text, with the encoding name attached', () => {
    const encoder = new GptTokenizerEncoderAdapter()
    const text = 'Two households, both alike in dignity.'

    const first = encoder.estimate(text)
    const second = encoder.estimate(text)

    expect(first).toEqual(second)
    expect(first.encoding).toBe('o200k_base')
    expect(encoder.encoding).toBe('o200k_base')
  })

  it('estimates more tokens for more text', () => {
    const encoder = new GptTokenizerEncoderAdapter()

    const short = encoder.estimate('hello').tokens
    const long = encoder.estimate(
      'hello world, this is a much longer sentence than the first',
    ).tokens

    expect(short).toBeGreaterThan(0)
    expect(long).toBeGreaterThan(short)
  })

  it('estimates zero tokens for an empty file', () => {
    const encoder = new GptTokenizerEncoderAdapter()

    expect(encoder.estimate('').tokens).toBe(0)
  })
})
