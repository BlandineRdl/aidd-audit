import type { AxisId } from './maturity.model.js'

/**
 * What the decision engine accepts as input, one entry per axis.
 *
 * The four confidence names are declared here rather than imported: `maturity`
 * and `evidence` are peers that never import each other, so each owns its side
 * of the vocabulary and `assessment` maps between them.
 */
export const EVIDENCE_CONFIDENCES = ['CONFIRMED', 'CLAIMED', 'CONFLICTING', 'UNKNOWN'] as const

export type EvidenceConfidence = (typeof EVIDENCE_CONFIDENCES)[number]

export type ObservedValue = string | number | readonly string[]

export interface AxisObservation {
  readonly axis: AxisId
  readonly confidence: EvidenceConfidence
  readonly value: ObservedValue | null
}
