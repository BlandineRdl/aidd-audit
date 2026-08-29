// INVARIANT: What sample of deliveries a collector will trust, and over what period. Shared for the
// reason `size-buckets.ts` is: the port promises the collectors are interchangeable, and a period or
// a floor two of them read differently would break that promise silently, at composition time.

// LIMITATION: The 180 days ending at the most recent delivery, never wall-clock now: the same
// subject must not report two different levels on two different days. **The length is chosen, not
// measured**: long enough that two quarters of ordinary delivery fall inside it, short enough that a
// practice abandoned a year ago stops counting. Nothing observed here establishes 180 over 90 or
// 365.
export const WINDOW_DAYS = 180

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

export function windowStartFrom(endInstant: number): number {
  return endInstant - WINDOW_DAYS * MILLISECONDS_PER_DAY
}

// LIMITATION: A sample is not a habit: below these counts a median describes an accident, and a
// collector emits nothing rather than publish it. That much follows from the conservative rule.
// **The number 5 is chosen, not measured, and nothing in this project establishes it.** No
// distribution of delivered changes was consulted, and the four reference profiles cannot stand in
// for one: a bundle publishes pre-aggregated medians without the counts behind them, so it never
// crosses this floor at all. What is known is the shape of the cost on each side, and it is
// asymmetric. Too low, and a fortnight of unusual weeks is published as a habit, a wrong level
// stated confidently. Too high, and a small but genuine practice stays UNKNOWN, an evidence gap the
// report names as one and which may never be read as a practice gap. Withholding a level is
// recoverable; inventing one is not. That asymmetry is the whole argument for 5 over 3, and it is an
// argument about direction, not about the value. **Not to be lowered so that a given repository
// classifies.** Move either number only from an observed distribution across real repositories,
// which needs a corpus this project does not have. Either changes what `assess` reports about every
// subject, so it is a product decision, never a tuning knob.
export const MINIMUM_DELIVERED_CHANGES = 5
export const MINIMUM_ACTIVE_DAYS = 5

// LIMITATION: The share of occasions at or above a value before the subject is credited with having
// demonstrated it. **One third is chosen, not measured.** It is argued from the model rather than
// from any repository's result: `levels/aidd.md` says each cell is a minimum, and Copper's own
// illustration names "PR de taille L et XL", a mix rather than a majority. A half would be the
// median again; a maximum is what the model excludes by name. Nothing here establishes a third over
// a quarter or two fifths, and two fifths was measured to silence one subject without changing the
// case that motivated the rule at all.
export const DEMONSTRATED_SHARE = 1 / 3

// LIMITATION: A share needs a larger sample than a median, which is why this floor is not the five
// above. A median moves slowly; a share over nine observations moves a whole bucket on one of them.
// **Ten is chosen, not measured**, from four real repositories: it withholds the readings that stood
// on three days out of nine and on two active days, and it keeps a finished mobile application whose
// twenty-two deliveries over fifteen active days are an ordinary project rather than a thin sample.
// Twenty was weighed and rejected for excluding that application. The measurement is in
// `aidd_docs/tasks/2026_08/2026_08_29_dual-reading-and-forge-collector/size-transcription.md`.
export const MINIMUM_DEMONSTRATED_SAMPLE = 10

// SAFETY: callers guarantee a non-empty sample, and an even count yields a half-integer median. A
// default of zero would publish the smallest bucket from a sample nobody took — a practice gap
// invented out of an empty list, which is the one outcome this project forbids outright. Shared so
// that a collector cannot reach for a weaker copy: two were written and both defaulted to zero.
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle]
  const lower = sorted.length % 2 === 1 ? upper : sorted[middle - 1]
  if (upper === undefined || lower === undefined) {
    throw new RangeError('A median needs a non-empty sample.')
  }
  return (lower + upper) / 2
}

export interface DemonstratedValue<T> {
  readonly value: T
  readonly share: number
}

// INVARIANT: The highest candidate that at least `DEMONSTRATED_SHARE` of the sample reaches, with
// the share that earned it. `null` below the floor, and `null` when even the lowest candidate is not
// reached often enough — a demonstrated value is granted upward on positive evidence, never derived
// from the absence of one. `candidates` runs low to high; `atOrAbove` counts the sample reaching one.
export function demonstratedFrom<T>(
  sampleSize: number,
  candidates: readonly T[],
  atOrAbove: (candidate: T) => number,
): DemonstratedValue<T> | null {
  if (sampleSize < MINIMUM_DEMONSTRATED_SAMPLE) return null

  for (const candidate of [...candidates].reverse()) {
    const share = atOrAbove(candidate) / sampleSize
    if (share >= DEMONSTRATED_SHARE) return { value: candidate, share }
  }
  return null
}

// INVARIANT: The demonstrated reading of a count per occasion — branches carried on a day, and
// nothing else so far. Shared so the two collectors that answer it cannot drift, which a copy in
// each of them could and a comment claiming otherwise would not prevent.
//
// SAFETY: takes the occurrence counts rather than one entry per occasion. A bundle records
// `{"3": 1000000000}` as easily as `{"3": 4}`, and expanding that into an array is a billion
// elements allocated from a file the tool did not write.
export function demonstratedCountFrom(
  occurrencesByCount: ReadonlyMap<number, number>,
): DemonstratedValue<number> | null {
  const sampleSize = [...occurrencesByCount.values()].reduce((total, count) => total + count, 0)
  const seen = [...occurrencesByCount.keys()].sort((left, right) => left - right)

  return demonstratedFrom(sampleSize, seen, (candidate) =>
    [...occurrencesByCount.entries()]
      .filter(([count]) => count >= candidate)
      .reduce((total, [, occurrences]) => total + occurrences, 0),
  )
}
