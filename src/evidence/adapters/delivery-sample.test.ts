import { describe, expect, it } from 'vitest'
import { demonstratedCountFrom, demonstratedFrom, median } from './delivery-sample.js'

// SAFETY: driven directly rather than through a collector, because a threshold is pinned only by
// rows on both sides of it and no collector fixture puts them there. Through the adapters the
// tightest brackets are 16.7% and 38.9% around the share, and 4 and 18 around the floor — wide
// enough that a quarter would pass the whole suite green, which is one of the two values the
// constant's own LIMITATION names as unestablished.

const CANDIDATES = [1, 2, 3, 4] as const

// A sample held as one entry per occasion, so the rows below read as the distribution they are.
function atOrAbove(sample: readonly number[]) {
  return (candidate: number): number => sample.filter((value) => value >= candidate).length
}

describe('the share that separates a demonstrated value from a maximum', () => {
  it.each([
    ['seven occasions in twenty-four, 29.2%', 7, 1],
    ['eight occasions in twenty-four, 33.3%', 8, 4],
  ])('reads %s as %s', (_name, reaching, expected) => {
    // INVARIANT: the tightest bracket around a third that also lies between a quarter and a third,
    // which is what makes it bite. 7/24 is 29.2% — over a quarter, under a third — so a share
    // lowered to 0.25 turns the first row red, and one raised past a third turns the second red.
    const sample = [
      ...Array.from({ length: reaching }, () => 4),
      ...Array.from({ length: 24 - reaching }, () => 1),
    ]
    expect(demonstratedFrom(sample.length, CANDIDATES, atOrAbove(sample))?.value).toBe(expected)
  })

  it('grants the highest candidate a third reaches, never a higher one a few did', () => {
    const sample = [4, 4, 4, 4, 3, 3, 3, 3, 1, 1, 1, 1]

    // Four of twelve reach 4 and eight reach 3: both clear a third, and the higher wins.
    expect(demonstratedFrom(sample.length, CANDIDATES, atOrAbove(sample))?.value).toBe(4)
  })

  it('reports nothing when even the lowest candidate is not reached often enough', () => {
    const sample = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

    // INVARIANT: granted upward on positive evidence only. `atOrAbove` here counts zero for every
    // candidate, and the answer is an absence rather than the floor of the scale.
    expect(demonstratedFrom(sample.length, CANDIDATES, () => 0)).toBeNull()
    expect(demonstratedFrom(sample.length, CANDIDATES, atOrAbove(sample))?.value).toBe(1)
  })

  it('carries the share that earned the value, not the bar it cleared', () => {
    const sample = [4, 4, 4, 4, 4, 4, 1, 1, 1, 1, 1, 1]

    expect(demonstratedFrom(sample.length, CANDIDATES, atOrAbove(sample))?.share).toBeCloseTo(0.5)
  })
})

describe('the sample a share needs before it says anything', () => {
  const everyOccasionReaches = () => (candidate: number) => (candidate === 4 ? 1000 : 1000)

  it.each([
    ['nine occasions', 9, null],
    ['ten occasions', 10, 4],
  ])('reads %s as %s', (_name, sampleSize, expected) => {
    // INVARIANT: a median moves slowly and a share does not — nine observations move a whole
    // bucket on one of them. The pair brackets the floor, so moving it turns one of these two red.
    expect(demonstratedFrom(sampleSize, CANDIDATES, everyOccasionReaches())?.value ?? null).toBe(
      expected,
    )
  })
})

describe('a distribution held as counts answers the same question', () => {
  it('reads the counts without expanding them into one entry per occasion', () => {
    // INVARIANT: the same distribution written as counts, which is how a bundle records it. The
    // answer must match, and `{"4": 1000000000}` must never become an array to get there.
    const counts = new Map([
      [4, 4],
      [1, 8],
    ])

    expect(demonstratedCountFrom(counts)).toEqual({ value: 4, share: 4 / 12 })
  })

  it('withholds below the floor, on the summed occasions rather than the entry count', () => {
    // Two entries, nine occasions: the floor counts what happened, not how the record spells it.
    expect(
      demonstratedCountFrom(
        new Map([
          [4, 3],
          [1, 6],
        ]),
      ),
    ).toBeNull()
  })
})

describe('a median needs a sample', () => {
  it.each([
    [[3], 3],
    [[1, 3], 2],
    [[1, 2, 3], 2],
    [[1, 2, 3, 10], 2.5],
  ])('reads %s as %s', (values, expected) => {
    expect(median(values)).toBe(expected)
  })

  it('refuses an empty one rather than answering zero', () => {
    // INVARIANT: a default of zero would publish the smallest bucket from a sample nobody took — a
    // practice gap invented out of an empty list. Three copies of this function once defaulted.
    expect(() => median([])).toThrow(RangeError)
    expect(() => median([])).toThrow(/non-empty sample/)
  })
})
