import type { CollectorProvenance } from '../../evidence/models/collector-provenance.model.js'
import type { Evidence } from '../../evidence/models/observation.model.js'
import { checkMaturity } from '../../maturity/engine/maturity-engine.js'
import type { AxisObservation } from '../../maturity/models/axis-observation.model.js'
import {
  isSetRequirement,
  type AxisId,
  type LevelRequirement,
  type MaturityModel,
} from '../../maturity/models/maturity.model.js'
import type {
  AxisResult,
  LevelResult,
  RequirementResult,
} from '../../maturity/models/requirement-result.model.js'
import {
  ASSESSMENT_REPORT_SCHEMA_VERSION,
  type AssessmentReport,
  type AxisReport,
  type BlockingRequirement,
  type CoverageReport,
  type LevelReport,
  type ProvenanceEntry,
  type RequirementReport,
  type Threshold,
} from '../contracts/assessment-report.contract.js'
import { UndeclaredAxisError } from './undeclared-axis.error.js'

export interface AssessmentComposition {
  readonly subjectPath: string
  readonly model: MaturityModel
  readonly evidence: readonly Evidence[]
  readonly provenance: readonly CollectorProvenance[]
}

/** Composes the two peer contexts into the public report. Every maturity
 *  verdict it publishes is the engine's; it decides none of them itself. */
export function composeAssessmentReport(input: AssessmentComposition): AssessmentReport {
  const { model, evidence, subjectPath, provenance } = input

  requireDeclaredAxes(model, evidence)

  const check = checkMaturity(model, evidence.map(toObservation))
  const context: ProjectionContext = {
    evidenceByAxis: new Map(evidence.map((entry) => [entry.axis, entry])),
    labelsByAxis: new Map(model.axes.map((axis) => [axis.id, axis.label])),
  }
  const next = check.next === null ? null : reportLevel(check.next, context)

  return {
    schemaVersion: ASSESSMENT_REPORT_SCHEMA_VERSION,
    model: { id: model.id, schemaVersion: model.schemaVersion },
    subject: { path: subjectPath },
    proven: check.proven === null ? null : reportLevel(check.proven, context),
    next,
    levels: check.levels.map((level) => reportLevel(level, context)),
    blocking: blockersOf(next),
    coverage: deriveCoverage(model, evidence),
    provenance: provenance.map(toProvenanceEntry),
  }
}

/** `axesRequested` comes from the model, not from `evidence.length`: an axis
 *  absent from `evidence` altogether still counts as requested and unobserved. */
function deriveCoverage(model: MaturityModel, evidence: readonly Evidence[]): CoverageReport {
  return {
    axesRequested: model.axes.length,
    axesObserved: evidence.filter((entry) => entry.observations.length > 0).length,
    axesConfirmed: evidence.filter((entry) => entry.status === 'CONFIRMED').length,
  }
}

function toProvenanceEntry(entry: CollectorProvenance): ProvenanceEntry {
  switch (entry.status) {
    case 'COMPLETED':
      return { collector: entry.collector, status: 'COMPLETED', axes: entry.axes }
    case 'FAILED':
    case 'TIMED_OUT':
    case 'SKIPPED':
      return {
        collector: entry.collector,
        status: entry.status,
        axes: entry.axes,
        reason: entry.reason,
      }
  }
}

interface ProjectionContext {
  readonly evidenceByAxis: ReadonlyMap<AxisId, Evidence>
  readonly labelsByAxis: ReadonlyMap<AxisId, string>
}

/**
 * The engine walks the model's axes, so evidence for an axis the model does not
 * declare would be dropped without a word — and a collector speaking off the
 * vocabulary would be silently forgiven instead of rejected.
 */
function requireDeclaredAxes(model: MaturityModel, evidence: readonly Evidence[]): void {
  const declared = new Set(model.axes.map((axis) => axis.id))
  for (const entry of evidence) {
    if (!declared.has(entry.axis)) {
      throw new UndeclaredAxisError(
        `Evidence names an axis the model does not declare: '${entry.axis}'.`,
      )
    }
  }
}

/** Only CONFIRMED evidence carries a value into the engine. What the absence of
 *  a value then means is the engine's conservative rule, not this mapping's. */
function toObservation(evidence: Evidence): AxisObservation {
  switch (evidence.status) {
    case 'CONFIRMED':
      return { axis: evidence.axis, confidence: 'CONFIRMED', value: evidence.value }
    case 'CLAIMED':
    case 'CONFLICTING':
    case 'UNKNOWN':
      return { axis: evidence.axis, confidence: evidence.status, value: null }
  }
}

function reportLevel(result: LevelResult, context: ProjectionContext): LevelReport {
  return {
    id: result.level.id,
    rank: result.level.rank,
    label: result.level.label,
    outcome: result.outcome,
    axes: result.axes.map((axis) => reportAxis(axis, context)),
  }
}

function reportAxis(result: AxisResult, context: ProjectionContext): AxisReport {
  return {
    axis: result.axis,
    label: labelOf(result.axis, context),
    outcome: result.outcome,
    requirements: result.requirements.map((requirement) =>
      reportRequirement(requirement, context.evidenceByAxis.get(result.axis)),
    ),
  }
}

// Unreachable for a model accepted by the loader.
function labelOf(axis: AxisId, context: ProjectionContext): string {
  const label = context.labelsByAxis.get(axis)
  if (label === undefined) {
    throw new Error(`Axis '${axis}' has no label in the loaded model.`)
  }
  return label
}

function reportRequirement(
  result: RequirementResult,
  evidence: Evidence | undefined,
): RequirementReport {
  const threshold = thresholdOf(result.requirement)

  if (evidence === undefined) {
    return unprovenRequirement(result, threshold, 'UNKNOWN')
  }

  switch (evidence.status) {
    case 'CONFIRMED':
      if (result.outcome === 'UNPROVEN') {
        throw contradiction(result, evidence.status)
      }
      return {
        axis: result.axis,
        threshold,
        observed: evidence.value,
        evidence: 'CONFIRMED',
        outcome: result.outcome,
      }
    case 'CLAIMED':
    case 'CONFLICTING':
    case 'UNKNOWN':
      return unprovenRequirement(result, threshold, evidence.status)
  }
}

function unprovenRequirement(
  result: RequirementResult,
  threshold: Threshold,
  evidence: 'CLAIMED' | 'CONFLICTING' | 'UNKNOWN',
): RequirementReport {
  if (result.outcome !== 'UNPROVEN') {
    throw contradiction(result, evidence)
  }
  return { axis: result.axis, threshold, observed: null, evidence, outcome: 'UNPROVEN' }
}

// Guards the evidence/outcome invariant shared with the maturity engine.
function contradiction(result: RequirementResult, evidence: string): Error {
  return new Error(
    `Axis '${result.axis}': ${evidence} evidence cannot produce outcome ${result.outcome}.`,
  )
}

function thresholdOf(requirement: LevelRequirement): Threshold {
  return isSetRequirement(requirement) ? requirement.includes : requirement.min
}

// Only the next level is read: a requirement two levels up blocks nothing in reach.
function blockersOf(next: LevelReport | null): readonly BlockingRequirement[] {
  if (next === null) return []

  return next.axes.flatMap((axis) =>
    axis.requirements.flatMap((requirement): BlockingRequirement[] => {
      switch (requirement.outcome) {
        case 'MET':
          return []
        case 'NOT_MET':
          return [
            {
              level: next.id,
              axis: requirement.axis,
              evidence: requirement.evidence,
              outcome: 'NOT_MET',
              gap: 'PRACTICE',
            },
          ]
        case 'UNPROVEN':
          return [
            {
              level: next.id,
              axis: requirement.axis,
              evidence: requirement.evidence,
              outcome: 'UNPROVEN',
              gap: 'EVIDENCE',
            },
          ]
      }
    }),
  )
}
