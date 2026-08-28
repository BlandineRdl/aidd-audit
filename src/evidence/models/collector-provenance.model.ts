import type { AxisId } from './axis.model.js'

// Self-contained rather than importing CollectorRun's status union: models/ does not
// depend on ports/, and the port is frozen, so the two cannot drift silently.
export type CollectorProvenance =
  | {
      readonly collector: string
      readonly status: 'COMPLETED'
      readonly axes: readonly AxisId[]
    }
  | {
      readonly collector: string
      readonly status: 'FAILED' | 'TIMED_OUT' | 'SKIPPED'
      readonly axes: readonly AxisId[]
      readonly reason: string
    }
