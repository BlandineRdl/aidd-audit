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

// INVARIANT: axes lists what a collector was asked to attempt, fixed before it ran and never
// revised by what it answered — a COMPLETED entry is not a claim that anything was observed;
// `coverage` and the axis reports say what was. Stated in full rather than by reference since this
// contract is self-contained on purpose; `evidence/models/collector-provenance.model.ts` carries
// the same shape and the two must not drift.
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

  // INVARIANT: null means evidence could not establish even the baseline — never replace it with
  // White or any other default.
  readonly proven: LevelReport | null

  // Level immediately above proven, or null once the highest level is proven.
  readonly next: LevelReport | null

  // Full model evaluation ordered by rank.
  readonly levels: readonly LevelReport[]

  // Requirements preventing next from being proven.
  readonly blocking: readonly BlockingRequirement[]

  readonly coverage: CoverageReport
  readonly provenance: readonly ProvenanceEntry[]
}
