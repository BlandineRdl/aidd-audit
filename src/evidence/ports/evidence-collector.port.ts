import type { AxisId, AxisVocabulary } from '../models/axis.model.js'
import type { Observation } from '../models/observation.model.js'

/**
 * The one interface every evidence source implements.
 *
 * Two adapters bind to it and they must not diverge: `profile-bundle.adapter`
 * reads the acceptance fixtures, `live-repository.adapter` reads a real
 * repository through the filesystem and local Git. Both return the same
 * normalised observations, which is precisely why fixtures cannot be said to
 * exercise the live implementation.
 */

export interface CollectorContext {
  /** The repository or fixture bundle under assessment. */
  readonly path: string
  /** The values each axis accepts. A collector emits nothing outside it. */
  readonly vocabulary: readonly AxisVocabulary[]
  /** Aborted when the collector exceeds its budget. Honour it. */
  readonly signal: AbortSignal
}

export interface EvidenceCollector {
  readonly id: string
  /** The axes this collector can contribute to. Used for coverage. */
  readonly axes: readonly AxisId[]
  collect(context: CollectorContext): Promise<readonly Observation[]>
}

/**
 * How a collector's execution ended. Deliberately separate from EvidenceStatus:
 * a collector that failed leaves its axes UNKNOWN, it does not introduce a new
 * evidence state, and it never turns absence into a negative observation.
 */
export type CollectorStatus = 'COMPLETED' | 'FAILED' | 'TIMED_OUT' | 'SKIPPED'

export interface CollectorRun {
  readonly collector: string
  readonly status: CollectorStatus
  readonly observations: readonly Observation[]
  /** Present only when the run did not complete. Explains, never fabricates. */
  readonly failure?: string
}
