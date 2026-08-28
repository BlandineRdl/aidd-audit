import type {
  AssessmentReport,
  AxisReport,
  BlockingRequirement,
  CoverageReport,
  LevelReport,
  ProvenanceEntry,
  RequirementReport,
} from '../../assessment/contracts/assessment-report.contract.js'
import { UnrenderableReportError } from './unrenderable-report.error.js'

// Projecting field by field, rather than stringifying the report, is what keeps
// a field the contract does not declare out of the published output.
export function renderJsonReport(report: AssessmentReport): string {
  const projected = projectReport(report)
  assertEveryNumberFinite(projected, '$')
  return JSON.stringify(projected, null, 2)
}

// JSON serialises NaN and Infinity as null. In this contract, null carries
// domain meaning, so non-finite numbers must be rejected before serialisation.
function assertEveryNumberFinite(value: unknown, path: string): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new UnrenderableReportError(
        `${path} is ${value}; JSON renders it as null, which this report reads as absence.`,
      )
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertEveryNumberFinite(item, `${path}[${index}]`))
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, member] of Object.entries(value)) {
      assertEveryNumberFinite(member, `${path}.${key}`)
    }
  }
}

function projectReport(report: AssessmentReport): AssessmentReport {
  return {
    schemaVersion: report.schemaVersion,
    model: { id: report.model.id, schemaVersion: report.model.schemaVersion },
    subject: { path: report.subject.path },
    proven: report.proven === null ? null : projectLevel(report.proven),
    next: report.next === null ? null : projectLevel(report.next),
    levels: report.levels.map(projectLevel),
    blocking: report.blocking.map(projectBlockingRequirement),
    coverage: projectCoverage(report.coverage),
    provenance: report.provenance.map(projectProvenanceEntry),
  }
}

function projectLevel(level: LevelReport): LevelReport {
  return {
    id: level.id,
    rank: level.rank,
    label: level.label,
    outcome: level.outcome,
    axes: level.axes.map(projectAxis),
  }
}

function projectAxis(axis: AxisReport): AxisReport {
  return {
    axis: axis.axis,
    label: axis.label,
    outcome: axis.outcome,
    requirements: axis.requirements.map(projectRequirement),
  }
}

// Branching preserves the contract's discriminated union without a cast.
function projectRequirement(requirement: RequirementReport): RequirementReport {
  switch (requirement.outcome) {
    case 'MET':
    case 'NOT_MET':
      return {
        axis: requirement.axis,
        threshold: requirement.threshold,
        observed: requirement.observed,
        evidence: requirement.evidence,
        outcome: requirement.outcome,
      }
    case 'UNPROVEN':
      return {
        axis: requirement.axis,
        threshold: requirement.threshold,
        observed: requirement.observed,
        evidence: requirement.evidence,
        outcome: requirement.outcome,
      }
  }
}

// Branching preserves the contract's discriminated union without a cast.
function projectBlockingRequirement(blocker: BlockingRequirement): BlockingRequirement {
  switch (blocker.gap) {
    case 'PRACTICE':
      return {
        level: blocker.level,
        axis: blocker.axis,
        evidence: blocker.evidence,
        outcome: blocker.outcome,
        gap: blocker.gap,
      }
    case 'EVIDENCE':
      return {
        level: blocker.level,
        axis: blocker.axis,
        evidence: blocker.evidence,
        outcome: blocker.outcome,
        gap: blocker.gap,
      }
  }
}

function projectCoverage(coverage: CoverageReport): CoverageReport {
  return {
    axesRequested: coverage.axesRequested,
    axesObserved: coverage.axesObserved,
    axesConfirmed: coverage.axesConfirmed,
  }
}

// `reason` exists only on a non-COMPLETED entry; the switch is what keeps it
// from being emitted as `undefined` on a COMPLETED one.
function projectProvenanceEntry(entry: ProvenanceEntry): ProvenanceEntry {
  switch (entry.status) {
    case 'COMPLETED':
      return { collector: entry.collector, status: entry.status, axes: entry.axes }
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
