/**
 * The public assessment contract.
 *
 * This is what `--json` emits, what acceptance tests bind to, and what any
 * future driving adapter reads. It is versioned and deliberately distinct from
 * the internal assessment model: reshaping it invalidates every fixture at
 * once, so `schemaVersion` exists to make that break loud instead of silent.
 *
 * It is self-contained on purpose. It imports no context's internal types, so a
 * refactor inside `maturity` or `evidence` cannot change the published shape by
 * accident.
 */

export const ASSESSMENT_REPORT_SCHEMA_VERSION = 1

/** Why a requirement could or could not be satisfied. Only CONFIRMED can satisfy one. */
export type EvidenceStatus = 'CONFIRMED' | 'CLAIMED' | 'CONFLICTING' | 'UNKNOWN'

/**
 * What the assessment concluded. Never conflated with EvidenceStatus:
 * NOT_MET means the minimum is proven out of reach, UNPROVEN means the
 * evidence could not settle it.
 */
export type AssessmentOutcome = 'MET' | 'NOT_MET' | 'UNPROVEN'

export interface RequirementReport {
  readonly axis: string
  /** The minimum the model asks for, rendered as the model expresses it. */
  readonly threshold: string | number | readonly string[]
  /** What was observed, or null when nothing was. */
  readonly observed: string | number | readonly string[] | null
  readonly evidence: EvidenceStatus
  readonly outcome: AssessmentOutcome
}

export interface AxisReport {
  readonly axis: string
  readonly label: string
  readonly outcome: AssessmentOutcome
  readonly requirements: readonly RequirementReport[]
}

export interface LevelReport {
  readonly id: string
  readonly rank: number
  readonly label: string
  readonly outcome: AssessmentOutcome
  readonly satisfied: boolean
  readonly axes: readonly AxisReport[]
}

/** One requirement standing between the proven level and the next one. */
export interface BlockingRequirement {
  readonly level: string
  readonly axis: string
  readonly evidence: EvidenceStatus
  readonly outcome: AssessmentOutcome
}

/** Which collector produced an observation, and whether it ran at all. */
export interface ProvenanceEntry {
  readonly collector: string
  readonly status: 'COMPLETED' | 'FAILED' | 'TIMED_OUT' | 'SKIPPED'
  /** Axes this collector contributed an observation for. */
  readonly axes: readonly string[]
}

/**
 * How much of the intended evidence the run actually obtained. A degraded run
 * stays a valid assessment; it simply proves less.
 */
export interface CoverageReport {
  readonly axesRequested: number
  readonly axesObserved: number
  readonly axesConfirmed: number
}

export interface AssessmentReport {
  readonly schemaVersion: typeof ASSESSMENT_REPORT_SCHEMA_VERSION
  /** The maturity model this run was assessed against. */
  readonly model: { readonly id: string; readonly schemaVersion: number }
  readonly subject: { readonly path: string }
  /** The highest fully proven level, or null when no level is proven. */
  readonly proven: LevelReport | null
  /** The lowest level above the proven one, or null once the top is reached. */
  readonly next: LevelReport | null
  readonly levels: readonly LevelReport[]
  readonly blocking: readonly BlockingRequirement[]
  readonly coverage: CoverageReport
  readonly provenance: readonly ProvenanceEntry[]
}
