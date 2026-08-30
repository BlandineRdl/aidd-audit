import type { ContributorRosterRun } from '../../evidence/ports/contributor-roster.port.js'
import type { CollectorProvenance } from '../../evidence/models/collector-provenance.model.js'
import type { CollectorDiagnostic } from '../../evidence/models/collector-diagnostic.model.js'
import type { Evidence } from '../../evidence/models/observation.model.js'
import { checkMaturity } from '../../maturity/engine/maturity-engine.js'
import type { MaturityModel } from '../../maturity/models/maturity.model.js'
import {
  ASSESSMENT_REPORT_SCHEMA_VERSION,
  type AssessmentReport,
  type AxisVocabularyReport,
  type CoverageReport,
  type ProvenanceEntry,
} from '../contracts/assessment-report.contract.js'
import { composeContributorRoster } from './compose-contributor-roster.js'
import {
  blockersOf,
  reportDemonstrated,
  reportLevel,
  toObservation,
  type ProjectionContext,
} from './report-projection.js'
import { UndeclaredAxisError } from './undeclared-axis.error.js'
import { scaleNamedBy } from '../../maturity/models/scale-for-axis.js'

export interface AssessmentComposition {
  readonly subjectPath: string
  readonly model: MaturityModel
  readonly evidence: readonly Evidence[]
  readonly provenance: readonly CollectorProvenance[]
  readonly diagnostics?: readonly CollectorDiagnostic[]
  readonly roster?: ContributorRosterRun | null
}

// Publishes only the engine's own verdicts; this function decides none of them.
export function composeAssessmentReport(input: AssessmentComposition): AssessmentReport {
  const { model, evidence, subjectPath, provenance, diagnostics = [], roster } = input

  requireDeclaredAxes(model, evidence)

  const sustained = evidence.filter((entry) => entry.reading === 'SUSTAINED')
  const demonstrated = evidence.filter((entry) => entry.reading === 'DEMONSTRATED')

  const check = checkMaturity(model, sustained.map(toObservation))
  const context: ProjectionContext = {
    evidenceByAxis: new Map(sustained.map((entry) => [entry.axis, entry])),
    diagnosticsByAxis: new Map(diagnostics.map((diagnostic) => [diagnostic.axis, diagnostic])),
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
    demonstrated: reportDemonstrated(model, sustained, demonstrated, check.proven),
    levels: check.levels.map((level) => reportLevel(level, context)),
    blocking: blockersOf(next),
    vocabulary: reportVocabulary(model),
    coverage: deriveCoverage(model, sustained),
    provenance: provenance.map(toProvenanceEntry),
    contributors: composeContributorRoster({ model, run: roster ?? null }),
  }
}

function reportVocabulary(model: MaturityModel): readonly AxisVocabularyReport[] {
  return model.axes.map((axis) => {
    const scale = scaleNamedBy(model, axis)
    switch (scale.kind) {
      case 'ordinal':
        return {
          axis: axis.id,
          kind: 'ordinal',
          values: scale.values,
          descriptions: scale.descriptions,
        }
      case 'set':
        return {
          axis: axis.id,
          kind: 'set',
          members: scale.members,
          descriptions: scale.descriptions,
        }
      case 'numeric':
        return { axis: axis.id, kind: 'numeric', description: scale.description }
    }
  })
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
