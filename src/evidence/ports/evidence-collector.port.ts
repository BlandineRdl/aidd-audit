import type { AxisId, AxisVocabulary } from '../models/axis.model.js'
import type { Observation } from '../models/observation.model.js'

export interface CollectorContext {
  readonly path: string
  readonly vocabulary: readonly AxisVocabulary[]
  readonly signal: AbortSignal
}

export interface EvidenceCollector {
  readonly id: string
  readonly supportedAxes: readonly AxisId[]
  collect(context: CollectorContext): Promise<readonly Observation[]>
}

export type CollectorRun =
  | {
      readonly collector: string
      readonly status: 'COMPLETED'
      readonly observations: readonly Observation[]
    }
  | {
      readonly collector: string
      readonly status: 'FAILED' | 'TIMED_OUT' | 'SKIPPED'
      readonly observations: readonly Observation[]
      readonly reason: string
    }
