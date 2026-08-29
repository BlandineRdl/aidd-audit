import type { AxisId } from './axis.model.js'

// INVARIANT: self-contained rather than importing CollectorRun's status union — models/ does not
// depend on ports/, and the port is frozen, so the two cannot drift silently. `axes` lists which
// axes a collector was asked to attempt — its `supportedAxes` narrowed to what the loaded model
// declares — fixed before it runs and never revised by what it answered. A COMPLETED run lists
// every such axis whether it emitted an observation for each, for one, or for none. Provenance says
// who was asked; evidence says who answered — anything naming what is missing must read the
// evidence, never this list.
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
