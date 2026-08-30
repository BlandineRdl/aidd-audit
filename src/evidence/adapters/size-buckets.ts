// INVARIANT: A table two adapters computed differently would break their interchangeability behind
// the collector port.

// Ordered low to high, which is what lets a demonstrated reading walk it from the top.
export const SIZE_BUCKETS = ['S', 'M', 'L', 'XL'] as const

export type SizeBucket = (typeof SIZE_BUCKETS)[number]

// Bounds are half-open, so a half-integer median lands in exactly one row.
export function bucketForLines(value: number): SizeBucket {
  if (value < 100) return 'S'
  if (value < 400) return 'M'
  if (value < 1000) return 'L'
  return 'XL'
}

export function bucketForFiles(value: number): SizeBucket {
  if (value < 5) return 'S'
  if (value < 10) return 'M'
  if (value < 25) return 'L'
  return 'XL'
}

// SAFETY: The axis is a minimum threshold, so the higher of two disagreeing readings would publish
// a habit the source does not carry.
export function lowerBucket(left: SizeBucket, right: SizeBucket): SizeBucket {
  return SIZE_BUCKETS.indexOf(left) <= SIZE_BUCKETS.indexOf(right) ? left : right
}
