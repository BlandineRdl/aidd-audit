import type { AxisId } from './axis.model.js'

// Self-contained rather than importing CollectorRun's status union: models/ does not
// depend on ports/, and the port is frozen, so the two cannot drift silently.
/**
 * Which axes a collector was **asked to attempt** — its `supportedAxes` narrowed to the axes
 * the loaded model actually declares — fixed before it runs and never revised by what it
 * answered. A COMPLETED run lists every such axis whether it emitted an observation for each,
 * for one, or for none.
 *
 * Provenance says who was asked; the evidence says who answered. Anything naming what is
 * missing must read the evidence, never this list.
 */
export type CollectorProvenance =
  | {
      readonly collector: string
      readonly status: 'COMPLETED'
      /** See {@link CollectorProvenance} — asked, never answered. */
      readonly axes: readonly AxisId[]
    }
  | {
      readonly collector: string
      readonly status: 'FAILED' | 'TIMED_OUT' | 'SKIPPED'
      readonly axes: readonly AxisId[]
      readonly reason: string
    }
