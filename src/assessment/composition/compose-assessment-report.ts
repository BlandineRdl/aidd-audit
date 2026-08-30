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
  type DemonstratedLevel,
  type DemonstratedReport,
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

// Publishes only the engine's own verdicts; this function decides none of them.
export function composeAssessmentReport(input: AssessmentComposition): AssessmentReport {
  const { model, evidence, subjectPath, provenance } = input

  requireDeclaredAxes(model, evidence)

  const sustained = evidence.filter((entry) => entry.reading === 'SUSTAINED')
  const demonstrated = evidence.filter((entry) => entry.reading === 'DEMONSTRATED')

  const check = checkMaturity(model, sustained.map(toObservation))
  const context: ProjectionContext = {
    evidenceByAxis: new Map(sustained.map((entry) => [entry.axis, entry])),
    labelsByAxis: new Map(model.axes.map((axis) => [axis.id, axis.label])),
  }
  const next = check.next === null ? null : reportLevel(check.next, context)
  const proven = check.proven === null ? null : reportLevel(check.proven, context)

  return {
    schemaVersion: ASSESSMENT_REPORT_SCHEMA_VERSION,
    model: { id: model.id, schemaVersion: model.schemaVersion },
    subject: { path: subjectPath },
    proven,
    next,
    demonstrated: reportDemonstrated(model, sustained, demonstrated, check.proven, context),
    levels: check.levels.map((level) => reportLevel(level, context)),
    blocking: blockersOf(next),
    coverage: deriveCoverage(model, sustained),
    provenance: provenance.map(toProvenanceEntry),
  }
}

// INVARIANT: The engine is asked a second time, and is not modified to answer it. Two readings are
// two observation arrays, so the decision semantics stay one implementation with one set of tests.
//
// INVARIANT: An axis carrying no confirmed demonstrated reading falls back to its sustained value.
// Without that, harness and intervention — which have one reading by nature and by decision — would
// be UNKNOWN in this run and no level would ever be demonstrated on any subject.
function reportDemonstrated(
  model: MaturityModel,
  sustained: readonly Evidence[],
  demonstrated: readonly Evidence[],
  proven: LevelResult | null,
  context: ProjectionContext,
): DemonstratedReport | null {
  // SAFETY: a confirmed reading whose demonstration was lost carries no share, and a level named
  // from it would print with no frequency at all — the maximum wearing a habit's clothes. Dropped
  // here rather than later, so `level` and `axes` cannot disagree about whether anything was shown.
  const observed = demonstrated.filter(
    (entry) => entry.status === 'CONFIRMED' && entry.demonstration !== null,
  )
  if (observed.length === 0) return null

  const projection = model.axes.map((axis) => {
    const reached = observed.find((entry) => entry.axis === axis.id)
    return reached ?? sustained.find((entry) => entry.axis === axis.id)
  })

  const check = checkMaturity(
    model,
    projection.filter((entry) => entry !== undefined).map(toObservation),
  )

  // SAFETY: never below the habitual level. A share reading under the median says the distribution
  // leans low, and the habitual figure is then the honest answer already; publishing less than it
  // would read as a capability the subject lost.
  const level = highestOf(check.proven, proven)

  return {
    level: level === null ? null : namedLevel(level),
    // INVARIANT: a confirmed demonstrated reading always carries its demonstration. Anything without
    // one is dropped rather than published at a fabricated share, because a demonstrated value the
    // reader cannot weigh is the maximum this whole reading exists to avoid.
    axes: observed.flatMap((entry) =>
      entry.demonstration === null
        ? []
        : [
            {
              axis: entry.axis,
              observed: entry.value,
              share: entry.demonstration.share,
              unit: entry.demonstration.unit,
            },
          ],
    ),
  }
}

// SAFETY: the level and nothing beneath it. A requirement report pairs a threshold with the observed
// value the *sustained* reading resolved, so projecting one here would publish `threshold: 3,
// observed: 1, outcome: MET` on the same line — a document contradicting itself. Projecting it from
// the demonstrated evidence instead would be no better whenever the clamp above returned the
// sustained level, because then the outcomes and the observations come from different runs again.
function namedLevel(result: LevelResult): DemonstratedLevel {
  return {
    id: result.level.id,
    rank: result.level.rank,
    label: result.level.label,
    outcome: result.outcome,
  }
}

function highestOf(left: LevelResult | null, right: LevelResult | null): LevelResult | null {
  if (left === null) return right
  if (right === null) return left
  return left.level.rank >= right.level.rank ? left : right
}

// INVARIANT: axesRequested counts the model's axes, not evidence.length — an axis missing from
// evidence entirely is still requested, just unobserved.
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

// SAFETY: the engine walks the model's axes, so evidence for an axis the model doesn't declare
// would be dropped without a word — throw here or a collector speaking off the vocabulary is
// silently forgiven instead of rejected.
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

// This mapping only carries CONFIRMED values; what null means from here is the engine's rule.
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
