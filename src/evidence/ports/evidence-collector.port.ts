import type { AxisId, AxisVocabulary } from '../models/axis.model.js'
import type { CollectorDiagnostic } from '../models/collector-diagnostic.model.js'
import type { Observation } from '../models/observation.model.js'

export interface CollectorContext {
  readonly path: string
  readonly vocabulary: readonly AxisVocabulary[]
  readonly signal: AbortSignal
}

export interface EvidenceCollector {
  readonly id: string
  readonly supportedAxes: readonly AxisId[]
  collect(context: CollectorContext): Promise<CollectorCollection>
}

export interface CollectorCollection {
  readonly observations: readonly Observation[]
  readonly diagnostics: readonly CollectorDiagnostic[]
}

export type CollectorRun =
  | {
      readonly collector: string
      readonly status: 'COMPLETED'
      readonly observations: readonly Observation[]
      readonly diagnostics: readonly CollectorDiagnostic[]
    }
  | {
      readonly collector: string
      readonly status: 'FAILED' | 'TIMED_OUT' | 'SKIPPED'
      readonly observations: readonly Observation[]
      readonly diagnostics: readonly CollectorDiagnostic[]
      readonly reason: string
    }
