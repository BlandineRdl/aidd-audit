import type { AxisId } from './axis.model.js'

// INVARIANT: A diagnostic is a fact a completed collector learned while withholding an observation. It is not
// provenance: provenance answers whether the collector ran, while a diagnostic explains one axis
// it was unable to measure honestly.
export interface InsufficientActiveDaysDiagnostic {
  readonly collector: string
  readonly axis: AxisId
  readonly reason: 'INSUFFICIENT_ACTIVE_DAYS'
  readonly observed: number
  readonly minimum: number
}

export type CollectorDiagnostic = InsufficientActiveDaysDiagnostic
