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
import type {
  AxisReport,
  BlockingRequirement,
  DemonstratedLevel,
  DemonstratedReport,
  LevelReport,
  RequirementReport,
  Threshold,
} from '../contracts/assessment-report.contract.js'

export interface ProjectionContext {
  readonly evidenceByAxis: ReadonlyMap<AxisId, Evidence>
  readonly labelsByAxis: ReadonlyMap<AxisId, string>
}

// This mapping only carries CONFIRMED values; what null means from here is the engine's rule.
export function toObservation(evidence: Evidence): AxisObservation {
  switch (evidence.status) {
    case 'CONFIRMED':
      return { axis: evidence.axis, confidence: 'CONFIRMED', value: evidence.value }
    case 'CLAIMED':
    case 'CONFLICTING':
    case 'UNKNOWN':
      return { axis: evidence.axis, confidence: evidence.status, value: null }
  }
}

export function reportLevel(result: LevelResult, context: ProjectionContext): LevelReport {
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
export function blockersOf(next: LevelReport | null): readonly BlockingRequirement[] {
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

// INVARIANT: The engine is asked a second time, and is not modified to answer it. Two readings are
// two observation arrays, so the decision semantics stay one implementation with one set of tests.
//
// INVARIANT: An axis carrying no confirmed demonstrated reading falls back to its sustained value.
// Without that, harness and intervention — which have one reading by nature and by decision — would
// be UNKNOWN in this run and no level would ever be demonstrated on any subject.
export function reportDemonstrated(
  model: MaturityModel,
  sustained: readonly Evidence[],
  demonstrated: readonly Evidence[],
  proven: LevelResult | null,
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
