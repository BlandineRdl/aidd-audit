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
      readonly diagnostic?: EvidenceGapDiagnostic
    }

export interface EvidenceGapDiagnostic {
  readonly collector: string
  readonly axis: string
  readonly reason: 'INSUFFICIENT_ACTIVE_DAYS'
  readonly observed: number
  readonly minimum: number
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

// INVARIANT: The loaded model owns the words explaining its scale values. Renderers receive this projection
// with the verdict, rather than reopening the model or carrying an AIDD-specific glossary.
export type AxisVocabularyReport =
  | {
      readonly axis: string
      readonly kind: 'ordinal'
      readonly values: readonly string[]
      readonly descriptions: Readonly<Record<string, string>>
    }
  | {
      readonly axis: string
      readonly kind: 'set'
      readonly members: readonly string[]
      readonly descriptions: Readonly<Record<string, string>>
    }
  | {
      readonly axis: string
      readonly kind: 'numeric'
      readonly description: string
    }

// INVARIANT: What a share counts. Size counts delivered changes and parallelism counts active days,
// so a rendering that said "40% of occasions" for both would erase a difference the reader needs.
// Stated in full rather than by reference since this contract is self-contained on purpose;
// `evidence/models/observation.model.ts` carries the same names and the two must not drift.
export type DemonstrationUnit = 'DELIVERIES' | 'ACTIVE_DAYS'

// INVARIANT: One axis the subject repeatedly reached, and how often it did. `share` is a fraction of
// occasions between 0 and 1, not a percentage — the recorded bundle format already states every
// ratio that way, and a bare `40` would read as a count. It is not optional: a demonstrated value
// without the frequency that earned it is a maximum wearing a habit's clothes, and must never be
// published or rendered alone.
export interface DemonstratedAxis {
  readonly axis: string
  readonly observed: ObservedValue
  readonly share: number
  readonly unit: DemonstrationUnit
}

// INVARIANT: The level alone, without the per-axis requirement reports a `LevelReport` carries. Those
// pair a threshold with an observed value, and the observed value that earned a demonstrated level is
// not the one the sustained reading published: a `LevelReport` here would state `threshold: 3,
// observed: 1, outcome: MET` on the same line. What was demonstrated per axis is `axes` below, in a
// shape that carries the share as well, so nothing is lost by narrowing this.
export interface DemonstratedLevel {
  readonly id: string
  readonly rank: number
  readonly label: string
  readonly outcome: AssessmentOutcome
}

// INVARIANT: What the subject has shown it can reach, as opposed to what it sustains. `level` is
// never below `proven`: a demonstrated reading that lands under the habitual one says the
// distribution leans low, and the habitual figure is then already the honest answer. `axes` carries
// only the axes a demonstrated reading was actually observed for, so it may be shorter than the
// model's axis list and is empty on none of them.
export interface DemonstratedReport {
  readonly level: DemonstratedLevel | null
  readonly axes: readonly DemonstratedAxis[]
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

  // INVARIANT: null when no collector observed a demonstrated reading on any axis, which is the
  // whole output of every source that records a median without the distribution behind it. The
  // field is additive: a consumer reading `proven` alone sees what it saw before this field
  // existed, which is why the schema version does not move.
  readonly demonstrated: DemonstratedReport | null

  // Full model evaluation ordered by rank.
  readonly levels: readonly LevelReport[]

  // Requirements preventing next from being proven.
  readonly blocking: readonly BlockingRequirement[]

  // INVARIANT: Per-axis scale vocabulary comes from the loaded model. Raw scale values remain the public facts;
  // descriptions make them legible without teaching a renderer any model-specific terminology.
  readonly vocabulary: readonly AxisVocabularyReport[]

  readonly coverage: CoverageReport
  readonly provenance: readonly ProvenanceEntry[]
}
