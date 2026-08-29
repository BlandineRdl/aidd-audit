/**
 * Public assessment contract emitted by --json and consumed by driving adapters.
 *
 * Self-contained and versioned so internal refactors cannot silently change the
 * published shape.
 */

export const ASSESSMENT_REPORT_SCHEMA_VERSION = 1

export type EvidenceStatus = 'CONFIRMED' | 'CLAIMED' | 'CONFLICTING' | 'UNKNOWN'
export type AssessmentOutcome = 'MET' | 'NOT_MET' | 'UNPROVEN'

export type Threshold = string | number | readonly string[]
export type ObservedValue = string | number | readonly string[]

export type RequirementReport =
  | {
      readonly axis: string
      readonly threshold: Threshold
      readonly observed: ObservedValue
      readonly evidence: 'CONFIRMED'
      readonly outcome: 'MET' | 'NOT_MET'
    }
  | {
      readonly axis: string
      readonly threshold: Threshold
      readonly observed: ObservedValue | null
      readonly evidence: Exclude<EvidenceStatus, 'CONFIRMED'>
      readonly outcome: 'UNPROVEN'
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
  readonly axes: readonly AxisReport[]
}

export type BlockingRequirement =
  | {
      readonly level: string
      readonly axis: string
      readonly evidence: 'CONFIRMED'
      readonly outcome: 'NOT_MET'
      readonly gap: 'PRACTICE'
    }
  | {
      readonly level: string
      readonly axis: string
      readonly evidence: Exclude<EvidenceStatus, 'CONFIRMED'>
      readonly outcome: 'UNPROVEN'
      readonly gap: 'EVIDENCE'
    }

/**
 * Which axes a collector was **asked to attempt**, fixed before it ran and never revised by
 * what it answered. A COMPLETED entry lists every such axis whether the collector emitted an
 * observation for each, for one, or for none — so an entry here is not a claim that anything
 * was observed. `coverage` and the axis reports say what was.
 *
 * Stated in full rather than by reference: this contract is self-contained on purpose, and
 * `evidence/models/collector-provenance.model.ts` carries the same definition for the same
 * reason. The two must not drift.
 */
export type ProvenanceEntry =
  | {
      readonly collector: string
      readonly status: 'COMPLETED'
      readonly axes: readonly string[]
    }
  | {
      readonly collector: string
      readonly status: 'FAILED' | 'TIMED_OUT' | 'SKIPPED'
      readonly axes: readonly string[]
      readonly reason: string
    }

export interface CoverageReport {
  readonly axesRequested: number
  readonly axesObserved: number
  readonly axesConfirmed: number
}

export interface AssessmentReport {
  readonly schemaVersion: typeof ASSESSMENT_REPORT_SCHEMA_VERSION

  readonly model: {
    readonly id: string
    readonly schemaVersion: number
  }

  readonly subject: {
    readonly path: string
  }

  /**
   * Highest fully proven level.
   *
   * null means the available evidence could not establish even the baseline.
   * It must never be replaced with White or any other default.
   */
  readonly proven: LevelReport | null

  /** Level immediately above proven, or null once the highest level is proven. */
  readonly next: LevelReport | null

  /** Full model evaluation ordered by rank. */
  readonly levels: readonly LevelReport[]

  /** Requirements preventing next from being proven. */
  readonly blocking: readonly BlockingRequirement[]

  readonly coverage: CoverageReport
  readonly provenance: readonly ProvenanceEntry[]
}
