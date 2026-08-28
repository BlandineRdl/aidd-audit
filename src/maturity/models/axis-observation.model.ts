import type { AxisId } from './maturity.model.js'

export const EVIDENCE_CONFIDENCES = ['CONFIRMED', 'CLAIMED', 'CONFLICTING', 'UNKNOWN'] as const

export type EvidenceConfidence = (typeof EVIDENCE_CONFIDENCES)[number]

export type ObservedValue = string | number | readonly string[]

export type AxisObservation =
  | {
      readonly axis: AxisId
      readonly confidence: 'CONFIRMED'
      readonly value: ObservedValue
    }
  | {
      readonly axis: AxisId
      readonly confidence: Exclude<EvidenceConfidence, 'CONFIRMED'>
      readonly value: null
    }
