import type {
  AssessmentReport,
  AxisVocabularyReport,
  AxisReport,
  BlockingRequirement,
  ContributorRosterReport,
  ContributorRow,
  CoverageReport,
  DemonstratedLevel,
  DemonstratedReport,
  LevelReport,
  ProvenanceEntry,
  RequirementReport,
} from '../../assessment/contracts/assessment-report.contract.js'
import { UnrenderableReportError } from './unrenderable-report.error.js'

export function renderJsonReport(report: AssessmentReport): string {
  return JSON.stringify(projectValidated(report, '$'), null, 2)
}

// INVARIANT: every element is the same projection a single-report call would publish for that
// subject, so the array reading adds no shape a consumer of the existing route has not already
// seen. Every report is validated before any is stringified, so a refusal on the last one leaves
// nothing published for the ones before it.
export function renderJsonReports(reports: readonly AssessmentReport[]): string {
  const projected = reports.map((report, index) => projectValidated(report, `$[${index}]`))
  return JSON.stringify(projected, null, 2)
}

function projectValidated(report: AssessmentReport, path: string): AssessmentReport {
  const projected = projectReport(report)
  assertEveryNumberFinite(projected, path)
  return projected
}

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
    contributors: projectContributors(report.contributors),
    proven: report.proven === null ? null : projectLevel(report.proven),
    next: report.next === null ? null : projectLevel(report.next),
    demonstrated: report.demonstrated === null ? null : projectDemonstrated(report.demonstrated),
    levels: report.levels.map(projectLevel),
    blocking: report.blocking.map(projectBlockingRequirement),
    vocabulary: report.vocabulary.map(projectVocabulary),
    coverage: projectCoverage(report.coverage),
    provenance: report.provenance.map(projectProvenanceEntry),
  }
}

function projectVocabulary(vocabulary: AxisVocabularyReport): AxisVocabularyReport {
  switch (vocabulary.kind) {
    case 'ordinal':
      return {
        axis: vocabulary.axis,
        kind: vocabulary.kind,
        values: vocabulary.values,
        descriptions: vocabulary.descriptions,
      }
    case 'set':
      return {
        axis: vocabulary.axis,
        kind: vocabulary.kind,
        members: vocabulary.members,
        descriptions: vocabulary.descriptions,
      }
    case 'numeric':
      return { axis: vocabulary.axis, kind: vocabulary.kind, description: vocabulary.description }
  }
}

// INVARIANT: the share travels with its value here as everywhere else. `assertEveryNumberFinite`
// walks the projected document, so a share that arrived as NaN makes the renderer refuse rather than
// publish `null`, which this contract reads as an absence nobody reported.
function projectDemonstrated(demonstrated: DemonstratedReport): DemonstratedReport {
  return {
    level: demonstrated.level === null ? null : projectDemonstratedLevel(demonstrated.level),
    axes: demonstrated.axes.map((axis) => ({
      axis: axis.axis,
      observed: axis.observed,
      share: axis.share,
      unit: axis.unit,
    })),
  }
}

// The level and nothing beneath it; the contract narrows this shape on purpose.
function projectDemonstratedLevel(level: DemonstratedLevel): DemonstratedLevel {
  return { id: level.id, rank: level.rank, label: level.label, outcome: level.outcome }
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
        ...(requirement.diagnostic === undefined ? {} : { diagnostic: requirement.diagnostic }),
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

// SAFETY: `reason` exists only on a non-COMPLETED entry — the switch is what keeps it from being
// emitted as `undefined` on a COMPLETED one.
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

// SAFETY: branches on the roster's own status the way `projectProvenanceEntry` branches on a
// collector's. The two arms differ by more than one key: a failed roster emits `reason` and no
// `harnessObserved` or `harnessPaths`, because it scanned no tree; a completed one emits both and
// no `reason`. Neither arm may emit the other's keys as `undefined`.
function projectContributors(
  contributors: ContributorRosterReport | null,
): ContributorRosterReport | null {
  if (contributors === null) return null

  switch (contributors.status) {
    case 'COMPLETED':
      return {
        status: contributors.status,
        windowDays: contributors.windowDays,
        harnessObserved: contributors.harnessObserved,
        harnessPaths: contributors.harnessPaths,
        rows: contributors.rows.map(projectContributorRow),
      }
    case 'FAILED':
    case 'TIMED_OUT':
      return { status: contributors.status, rows: [], reason: contributors.reason }
  }
}

// Never spread: a field the contract does not declare must not reach the published output.
function projectContributorRow(row: ContributorRow): ContributorRow {
  return {
    account: row.account,
    emailAddresses: row.emailAddresses,
    commits: row.commits,
    deliveries: row.deliveries,
    activeDays: row.activeDays,
    harnessAuthorship:
      row.harnessAuthorship === null
        ? null
        : { files: row.harnessAuthorship.files, commits: row.harnessAuthorship.commits },
    proven: row.proven === null ? null : projectLevel(row.proven),
    next: row.next === null ? null : projectLevel(row.next),
    observed: row.observed.map((entry) => ({
      axis: entry.axis,
      value: entry.value,
      evidence: entry.evidence,
    })),
    demonstrated: row.demonstrated === null ? null : projectDemonstrated(row.demonstrated),
    blocking: row.blocking.map(projectBlockingRequirement),
  }
}
