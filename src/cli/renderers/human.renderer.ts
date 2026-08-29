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
    renderNoCollectorsSection(report),
    renderCollectorsSection(report),
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
  // INVARIANT: "no proven level" is a result, never White and never a rank below the floor. It
  // names no cause either — the blockers know which.
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

// INVARIANT: "nothing was looked at" is a third state above both gaps, and must never read as
// either.
function renderNoCollectorsSection(report: AssessmentReport): string {
  if (report.provenance.length > 0) {
    return ''
  }
  return 'No collector ran: nothing about this subject was observed. The axes below are unproven because AIDD did not look, not because it looked and found nothing.'
}

type IncompleteCollector = Exclude<ProvenanceEntry, { status: 'COMPLETED' }>

function renderCollectorsSection(report: AssessmentReport): string {
  const completed = report.provenance.filter((entry) => entry.status === 'COMPLETED')
  if (completed.length === 0) {
    return ''
  }
  const names = completed.map((entry) => entry.collector).join(', ')
  return `Collectors that ran: ${names}.`
}

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
  return level.axes
    .flatMap((axis) => [
      `  ${axis.label}: ${glossOutcome(axis.outcome)}`,
      ...axis.requirements.map(renderRequirementDetail),
    ])
    .join('\n')
}

function renderRequirementDetail(requirement: RequirementReport): string {
  // No threshold where nothing was compared: naming one states a test that never ran.
  if (requirement.observed === null) {
    return `    no observation was made (${requirement.evidence}) — the requirement was never tested`
  }
  return `    required: ${formatSet(requirement.threshold)} · observed: ${formatSet(requirement.observed)} (${requirement.evidence})`
}

// Not `none`, which `aidd.yml` already ships as a `size` scale value.
function formatSet(value: Threshold | ObservedValue): string {
  return Array.isArray(value) && value.length === 0 ? 'an empty set' : formatValue(value)
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
    return `  [practice gap] ${axisLabel} at ${levelLabel}: observed ${formatSet(requirement.observed)} does not reach the required ${formatSet(requirement.threshold)}.`
  }
  return `  [practice gap] ${axisLabel} at ${levelLabel}: the observed practice does not meet the requirement. Improve ${axisLabel} to close the gap.`
}

// LIMITATION: BlockingRequirement carries no requirement identity, so the requirement is re-derived
// from a key that is not unique. Ambiguous means no threshold, never a guessed one. Fix belongs in
// the contract — see aidd_docs/memory/architecture.md, "Frozen before the split".
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
  return `  [evidence gap] ${axisLabel} at ${levelLabel}: ${explainEvidenceGap(report, blocker)}.`
}

function explainEvidenceGap(report: AssessmentReport, blocker: EvidenceBlocker): string {
  switch (blocker.evidence) {
    case 'UNKNOWN':
      return whoWasAsked(report, blocker.axis)
    case 'CLAIMED':
      return 'the claim could not be independently confirmed'
    case 'CONFLICTING':
      return 'observed evidence disagrees'
  }
}

// LIMITATION: the contract records that a collector ran, never why it emitted nothing for one axis,
// so the gap stays unexplained rather than invented. A per-axis reason on ProvenanceEntry would
// lift it.
function whoWasAsked(report: AssessmentReport, axis: string): string {
  const asked = report.provenance.filter((entry) => entry.axes.includes(axis))
  if (asked.length === 0) {
    return 'no collector was asked for this axis'
  }
  const names = asked.map((entry) => entry.collector).join(', ')
  return `asked ${names}, and no value was observed`
}

function formatValue(value: Threshold | ObservedValue): string {
  return Array.isArray(value) ? value.join(', ') : String(value)
}
