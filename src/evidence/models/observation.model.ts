import type { AxisId } from './axis.model.js'

/**
 * What a collector emits: a normalised observation, never a raw Git commit or
 * a file's contents. Collectors read the world; they do not decide anything.
 *
 * Resolving several observations of the same axis into one status is
 * `resolve-evidence.usecase.ts`, and nothing else.
 */

/** Where an observation comes from, which is what separates proof from claim. */
export type ObservationKind =
  /** Read from the repository itself. Can prove a requirement. */
  | 'OBSERVED'
  /** Stated by the developer or the project's own documentation. Cannot prove one. */
  | 'DECLARED'

export type ObservedValue = string | number | readonly string[]

export interface Observation {
  readonly axis: AxisId
  /**
   * Drawn from the vocabulary the axis declares in CollectorContext: a scale
   * value for an ordinal axis, a subset of the members for a set axis, a number
   * for a numeric one. A value off its scale is rejected downstream rather than
   * ranked, so a collector must never invent one.
   */
  readonly value: ObservedValue
  readonly kind: ObservationKind
  /** The collector that produced it. Carried into the report as provenance. */
  readonly collector: string
  /** The fact that supports it — a path, a count, a ratio. Shown to the reader. */
  readonly because: string
}

export const EVIDENCE_STATUSES = ['CONFIRMED', 'CLAIMED', 'CONFLICTING', 'UNKNOWN'] as const

export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number]

/** One axis after resolution: a single status, and the observations behind it. */
export interface Evidence {
  readonly axis: AxisId
  readonly status: EvidenceStatus
  /** null whenever the status is not CONFIRMED. */
  readonly value: ObservedValue | null
  readonly observations: readonly Observation[]
}
