import type { AxisId } from './axis.model.js'

export type ObservationKind = 'OBSERVED' | 'DECLARED'

export type ObservedValue = string | number | readonly string[]

export interface Observation {
  readonly axis: AxisId
  readonly value: ObservedValue
  readonly kind: ObservationKind
  readonly collector: string
  readonly basis: string
}

export const EVIDENCE_STATUSES = ['CONFIRMED', 'CLAIMED', 'CONFLICTING', 'UNKNOWN'] as const

export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number]

export type Evidence =
  | {
      readonly axis: AxisId
      readonly status: 'CONFIRMED'
      readonly value: ObservedValue
      readonly observations: readonly Observation[]
    }
  | {
      readonly axis: AxisId
      readonly status: Exclude<EvidenceStatus, 'CONFIRMED'>
      readonly value: null
      readonly observations: readonly Observation[]
    }
