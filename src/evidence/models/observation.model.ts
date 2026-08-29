import type { AxisId } from './axis.model.js'

export type ObservationKind = 'OBSERVED' | 'DECLARED'

export type ObservedValue = string | number | readonly string[]

// INVARIANT: Which question an observation answers about its axis. `SUSTAINED` is what the subject
// habitually does, `DEMONSTRATED` what it has repeatedly shown it can reach. They are two questions,
// not two opinions: a collector emitting both for one axis is not contradicting itself, and
// resolution compares values only inside a reading. Emitting them as two values of one axis would
// resolve to CONFLICTING and destroy both.
export const EVIDENCE_READINGS = ['SUSTAINED', 'DEMONSTRATED'] as const

export type EvidenceReading = (typeof EVIDENCE_READINGS)[number]

// INVARIANT: What a share is a share *of*. The two axes carrying a demonstrated reading do not count
// the same occasions — size counts delivered changes, parallelism counts active days — and a
// rendering that said "40% of occasions" for both would erase a difference the reader needs.
export const DEMONSTRATION_UNITS = ['DELIVERIES', 'ACTIVE_DAYS'] as const

export type DemonstrationUnit = (typeof DEMONSTRATION_UNITS)[number]

// INVARIANT: The share of occasions that earned a demonstrated value, and what those occasions are.
// The two travel as one value because neither means anything alone: a share with no unit cannot be
// rendered, and a unit with no share states nothing. `null` in place of the whole is a sustained
// reading, which is a habit and has no frequency to carry.
export interface Demonstration {
  readonly share: number
  readonly unit: DemonstrationUnit
}

export interface Observation {
  readonly axis: AxisId
  readonly reading: EvidenceReading
  readonly value: ObservedValue
  readonly kind: ObservationKind
  readonly collector: string
  readonly basis: string
  // A demonstrated value never travels without its frequency, so the two are one field.
  readonly demonstration: Demonstration | null
}

export const EVIDENCE_STATUSES = ['CONFIRMED', 'CLAIMED', 'CONFLICTING', 'UNKNOWN'] as const

export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number]

export type Evidence =
  | {
      readonly axis: AxisId
      readonly reading: EvidenceReading
      readonly status: 'CONFIRMED'
      readonly value: ObservedValue
      readonly demonstration: Demonstration | null
      readonly observations: readonly Observation[]
    }
  | {
      readonly axis: AxisId
      readonly reading: EvidenceReading
      readonly status: Exclude<EvidenceStatus, 'CONFIRMED'>
      readonly value: null
      readonly demonstration: null
      readonly observations: readonly Observation[]
    }
