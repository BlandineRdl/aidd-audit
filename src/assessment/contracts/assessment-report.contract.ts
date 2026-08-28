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
 * What the assessment concluded.
 *
 * Never conflated with EvidenceStatus:
 * * NOT_MET means observable evidence proves the requirement is not met.
 * * UNPROVEN means the available evidence could not establish whether it is met.
 */
export type AssessmentOutcome = 'MET' | 'NOT_MET' | 'UNPROVEN'

/**
 * Why a blocking requirement prevents progression.
 *
 * PRACTICE means the observed practice is proven below the requirement.
 * EVIDENCE means the practice itself is not proven deficient; the evidence is
 * missing, insufficient, claimed, or conflicting.
 */
export type GapKind = 'PRACTICE' | 'EVIDENCE'

export interface RequirementReport {
  readonly axis: string

  /** The minimum the maturity model requires, expressed in the model's vocabulary. */
  readonly threshold: string | number | readonly string[]

  /** What was observed, or null when no usable observation was obtained. */
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

  /**
   * MET means the level is fully proven.
   * NOT_MET means at least one required axis is proven below threshold.
   * UNPROVEN means no axis is NOT_MET, but at least one cannot be proven.
   */
  readonly outcome: AssessmentOutcome

  readonly axes: readonly AxisReport[]
}

/** One requirement standing between the proven level and the next one. */
export interface BlockingRequirement {
  readonly level: string
  readonly axis: string
  readonly evidence: EvidenceStatus

  /** A blocking requirement can never be MET. */
  readonly outcome: Exclude<AssessmentOutcome, 'MET'>

  /**
   * Derived from outcome:
   *   NOT_MET  -> PRACTICE
   *   UNPROVEN -> EVIDENCE
   *
   * Consumers must not have to infer this distinction themselves.
   */
  readonly gap: GapKind
}

/** Which collector ran and what it contributed to the assessment. */
export interface ProvenanceEntry {
  readonly collector: string
  readonly status: 'COMPLETED' | 'FAILED' | 'TIMED_OUT' | 'SKIPPED'

  /** Axes this collector contributed at least one observation for. */
  readonly axes: readonly string[]
}

/**
 * How much of the intended evidence the run actually obtained.
 *
 * A degraded run remains a valid assessment; it simply proves less.
 *
 * Coverage is currently axis-based. If collectors later operate at a finer
 * requirement granularity, this contract may evolve in a future schema version.
 */
export interface CoverageReport {
  readonly axesRequested: number
  readonly axesObserved: number
  readonly axesConfirmed: number
}

export interface AssessmentReport {
  readonly schemaVersion: typeof ASSESSMENT_REPORT_SCHEMA_VERSION

  /** The maturity model this run was assessed against. */
  readonly model: {
    readonly id: string
    readonly schemaVersion: number
  }

  readonly subject: {
    readonly path: string
  }

  /** The highest fully proven level, or null when no level can be proven. */
  readonly proven: LevelReport | null

  /** The first level above `proven`, or null once the top level is reached. */
  readonly next: LevelReport | null

  /** Full evaluation of the maturity model, ordered by rank. */
  readonly levels: readonly LevelReport[]

  /**
   * Requirements blocking progression to `next`.
   *
   * PRACTICE gaps may justify changing the practice.
   * EVIDENCE gaps must only explain what could not be established.
   */
  readonly blocking: readonly BlockingRequirement[]

  readonly coverage: CoverageReport
  readonly provenance: readonly ProvenanceEntry[]
}
