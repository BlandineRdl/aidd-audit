import type {
  AssessmentOutcome,
  AssessmentReport,
  AxisReport,
  BlockingRequirement,
  EvidenceStatus,
  LevelReport,
  ObservedValue,
  ProvenanceEntry,
  RequirementReport,
  Threshold,
} from '../../assessment/contracts/assessment-report.contract.js'

export function renderHumanReport(report: AssessmentReport): string {
  const sections = [
    renderHeader(report),
    renderProvenSection(report),
    renderCoverageSection(report),
    renderIncompleteCollectorsSection(report),
    renderNextSection(report),
    renderBlockingSection(report),
  ]
  return sections.filter((section) => section.length > 0).join('\n\n')
}

function renderHeader(report: AssessmentReport): string {
  return [
    `AIDD maturity assessment for ${report.subject.path}`,
    `Model: ${report.model.id} (schema v${report.model.schemaVersion})`,
  ].join('\n')
}

function renderProvenSection(report: AssessmentReport): string {
  const { proven } = report
  // Never White, never any level: "no proven level" is a result, not a rank
  // below the floor. It names no cause either — the blockers know which.
  if (proven === null) {
    return "Proven level: could not be established. No level's requirements were fully proven."
  }
  return [`Proven level: ${proven.label} (rank ${proven.rank})`, renderLevelAxes(proven)].join('\n')
}

// Null-proven only: MET implies every axis CONFIRMED, so the counts are then full.
function renderCoverageSection(report: AssessmentReport): string {
  if (report.proven !== null) {
    return ''
  }
  const { axesRequested, axesObserved, axesConfirmed } = report.coverage
  return `Evidence coverage: ${axesConfirmed} of ${axesRequested} axes confirmed (${axesObserved} observed).`
}

type IncompleteCollector = Exclude<ProvenanceEntry, { status: 'COMPLETED' }>

function renderIncompleteCollectorsSection(report: AssessmentReport): string {
  const incomplete = report.provenance.filter(
    (entry): entry is IncompleteCollector => entry.status !== 'COMPLETED',
  )
  if (incomplete.length === 0) {
    return ''
  }
  const lines = incomplete.map((entry) => {
    const axes = entry.axes.length > 0 ? ` on ${entry.axes.join(', ')}` : ''
    return `  ${entry.collector}: ${glossProvenanceStatus(entry.status)}${axes} — ${entry.reason}`
  })
  return ['Collectors that did not complete:', ...lines].join('\n')
}

function glossProvenanceStatus(status: IncompleteCollector['status']): string {
  switch (status) {
    case 'FAILED':
      return 'failed'
    case 'TIMED_OUT':
      return 'timed out'
    case 'SKIPPED':
      return 'skipped'
  }
}

function renderNextSection(report: AssessmentReport): string {
  const { next } = report
  if (next === null) {
    return ''
  }
  return [`Next level: ${next.label} (rank ${next.rank})`, renderLevelAxes(next)].join('\n')
}

function renderLevelAxes(level: LevelReport): string {
  return level.axes.map((axis) => `  ${axis.label}: ${glossOutcome(axis.outcome)}`).join('\n')
}

function glossOutcome(outcome: AssessmentOutcome): string {
  switch (outcome) {
    case 'MET':
      return 'MET'
    case 'NOT_MET':
      return 'NOT_MET (practice gap)'
    case 'UNPROVEN':
      return 'UNPROVEN (evidence gap)'
  }
}

function renderBlockingSection(report: AssessmentReport): string {
  if (report.blocking.length === 0) {
    return ''
  }
  const lines = report.blocking.map((blocker) => renderBlocker(report, blocker))
  return ['Blocking requirements:', ...lines].join('\n')
}

function renderBlocker(report: AssessmentReport, blocker: BlockingRequirement): string {
  switch (blocker.gap) {
    case 'PRACTICE':
      return renderPracticeGap(report, blocker)
    case 'EVIDENCE':
      return renderEvidenceGap(report, blocker)
  }
}

interface AxisLocation {
  readonly levelLabel: string
  readonly axisLabel: string
  readonly axis: AxisReport | undefined
}

function locateAxis(report: AssessmentReport, blocker: BlockingRequirement): AxisLocation {
  const level = report.levels.find((candidate) => candidate.id === blocker.level)
  const axis = level?.axes.find((candidate) => candidate.axis === blocker.axis)
  return {
    levelLabel: level?.label ?? blocker.level,
    axisLabel: axis?.label ?? blocker.axis,
    axis,
  }
}

type PracticeRequirement = Extract<RequirementReport, { evidence: 'CONFIRMED' }>
type PracticeBlocker = Extract<BlockingRequirement, { gap: 'PRACTICE' }>
type EvidenceBlocker = Extract<BlockingRequirement, { gap: 'EVIDENCE' }>

function renderPracticeGap(report: AssessmentReport, blocker: PracticeBlocker): string {
  const { levelLabel, axisLabel, axis } = locateAxis(report, blocker)
  const requirement = findUniquePracticeRequirement(axis, blocker)
  if (requirement) {
    return `  [practice gap] ${axisLabel} at ${levelLabel}: observed ${formatValue(requirement.observed)} does not reach the required ${formatValue(requirement.threshold)}.`
  }
  return `  [practice gap] ${axisLabel} at ${levelLabel}: the observed practice does not meet the requirement. Improve ${axisLabel} to close the gap.`
}

// Contract debt: BlockingRequirement carries no requirement identity, so the
// blocking requirement is re-derived from a key that is not unique. Ambiguous
// means no threshold, never a guessed one. Fix belongs in the contract —
// see aidd_docs/memory/architecture.md, "Frozen before the split".
function findUniquePracticeRequirement(
  axis: AxisReport | undefined,
  blocker: PracticeBlocker,
): PracticeRequirement | undefined {
  const matches = (axis?.requirements ?? []).filter(
    (candidate): candidate is PracticeRequirement =>
      candidate.evidence === 'CONFIRMED' && candidate.outcome === blocker.outcome,
  )
  return matches.length === 1 ? matches[0] : undefined
}

function renderEvidenceGap(report: AssessmentReport, blocker: EvidenceBlocker): string {
  const { levelLabel, axisLabel } = locateAxis(report, blocker)
  return `  [evidence gap] ${axisLabel} at ${levelLabel}: ${explainEvidenceGap(blocker.evidence)}.`
}

function explainEvidenceGap(evidence: Exclude<EvidenceStatus, 'CONFIRMED'>): string {
  switch (evidence) {
    case 'UNKNOWN':
      return 'no observable evidence was established'
    case 'CLAIMED':
      return 'the claim could not be independently confirmed'
    case 'CONFLICTING':
      return 'observed evidence disagrees'
  }
}

function formatValue(value: Threshold | ObservedValue): string {
  return Array.isArray(value) ? value.join(', ') : String(value)
}
