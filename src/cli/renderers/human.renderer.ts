import type {
  AssessmentOutcome,
  AssessmentReport,
  AxisReport,
  DemonstratedAxis,
  BlockingRequirement,
  ContributorRosterReport,
  ContributorRow,
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
    renderDemonstratedSection(report),
    renderCoverageSection(report),
    renderNoCollectorsSection(report),
    renderCollectorsSection(report),
    renderIncompleteCollectorsSection(report),
    renderNextSection(report),
    renderBlockingSection(report),
    renderContributorsSection(report),
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

// INVARIANT: This section always sits *below* the proven one and never replaces it. The habitual
// level is what the subject holds; this is what it has reached often enough to count, which is a
// different and weaker claim. Printed first, or printed alone, it would be quoted as the level.
//
// INVARIANT: It is omitted entirely when it names nothing above the proven level, so the ordinary
// subject — every bundle, every source that records a median without the distribution behind it —
// reads exactly as it did before this section existed.
function renderDemonstratedSection(report: AssessmentReport): string {
  const { demonstrated, proven } = report
  if (demonstrated === null || demonstrated.level === null) return ''

  // SAFETY: no ceiling without a floor. With `proven` null this section would print the only level
  // in the document, on a page that says in the same breath that the subject could not be
  // classified and that the axis was never observed — handing a rank-4 label to a subject the tool
  // declined to place. A demonstrated level says "further than usual"; with no usual, it says
  // nothing that can be read safely.
  if (proven === null) return ''
  if (demonstrated.level.rank <= proven.rank) return ''

  // SAFETY: the level line ends in a colon and never stands alone. A reader who takes only the first
  // line of a paragraph must not come away with a bare rank: the sentence is unfinished without the
  // lines beneath it, each of which carries the share that earned the level.
  return [
    `Demonstrated: ${demonstrated.level.label} (rank ${demonstrated.level.rank}), reached on:`,
    ...demonstrated.axes.map((axis) => `  ${renderDemonstratedAxis(axis, report)}`),
  ].join('\n')
}

// SAFETY: the value and its frequency are one sentence, never two. A demonstrated value read without
// the share that earned it is a maximum wearing a habit's clothes, which is the one thing this
// reading must not become.
function renderDemonstratedAxis(axis: DemonstratedAxis, report: AssessmentReport): string {
  const label = labelFor(axis.axis, report) ?? axis.axis
  const percent = Math.round(axis.share * 100)
  return `${label}: ${formatSet(axis.observed)} · reached on ${percent}% of ${occasionsOf(axis.unit)}`
}

function occasionsOf(unit: DemonstratedAxis['unit']): string {
  switch (unit) {
    case 'DELIVERIES':
      return 'delivered changes'
    case 'ACTIVE_DAYS':
      return 'active days'
  }
}

// The model's own label for an axis, taken from any level that reports it.
function labelFor(axis: string, report: AssessmentReport): string | undefined {
  for (const level of report.levels) {
    const found = level.axes.find((candidate) => candidate.axis === axis)
    if (found !== undefined) return found.label
  }
  return undefined
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

type CompletedRoster = Extract<ContributorRosterReport, { status: 'COMPLETED' }>
type FailedRoster = Exclude<ContributorRosterReport, CompletedRoster>

// INVARIANT: existence is keyed on `report.contributors === null` alone, never on the roster's own
// status. Falling back to the repository-only rendering when the roster failed would make one
// subject produce two documents depending on credentials, and `cli.md` promises the same bytes on
// any machine, on any day.
function renderContributorsSection(report: AssessmentReport): string {
  const { contributors } = report
  if (contributors === null) return ''

  if (contributors.status !== 'COMPLETED') {
    return renderFailedRoster(contributors)
  }

  const header = renderContributorsHeader(contributors)
  if (contributors.rows.length === 0) {
    return header
  }

  const rows = contributors.rows.map((row) => renderContributorRow(report, contributors, row))
  const harness = renderSharedHarnessLine(contributors)

  return [header, ...rows, ...(harness === null ? [] : [harness])].join('\n\n')
}

function renderFailedRoster(roster: FailedRoster): string {
  return `Contributors: ${glossRosterStatus(roster.status)} — ${roster.reason}. The level above is unchanged.`
}

// INVARIANT: never `glossProvenanceStatus` — that one is typed on a provenance entry, and the
// roster is not a collector and answers no axis.
function glossRosterStatus(status: FailedRoster['status']): string {
  switch (status) {
    case 'FAILED':
      return 'could not be read'
    case 'TIMED_OUT':
      return 'timed out'
  }
}

function renderContributorsHeader(contributors: CompletedRoster): string {
  if (contributors.rows.length === 0) {
    return `Contributors: no account was active in the last ${contributors.windowDays} days.`
  }

  const named = contributors.rows.filter((row) => row.account !== null).length
  const hasUnattributed = contributors.rows.some((row) => row.account === null)
  const noun = named === 1 ? 'account' : 'accounts'
  const unattributedClause = hasUnattributed ? ', plus commits GitHub maps to no account' : ''

  return `Contributors: ${named} ${noun} active in the last ${contributors.windowDays} days${unattributedClause}. The level above covers every delivery in the window, whoever made it; each row below covers one account's own.`
}

function renderContributorRow(
  report: AssessmentReport,
  contributors: CompletedRoster,
  row: ContributorRow,
): string {
  const label = row.account ?? 'unattributed'
  const lines = [`  ${label} — ${renderRowProvenLabel(row)}`, `    ${renderRowSample(row)}`]

  const demonstratedLine = renderRowDemonstrated(row, report)
  if (demonstratedLine !== null) lines.push(demonstratedLine)

  // What stops the row's own next level: an evidence gap, a practice gap, or both.
  if (row.proven === null) lines.push(...renderRowGapLines(report, row))

  lines.push(`    ${renderRowHarness(row, contributors)}`)

  return lines.join('\n')
}

function renderRowProvenLabel(row: ContributorRow): string {
  return row.proven === null
    ? 'proven: could not be established'
    : `proven: ${row.proven.label} (rank ${row.proven.rank})`
}

// INVARIANT: `activeDays` where the sample supported a reading, `commits` where it did not — a day
// on which one of this account's own deliveries received a commit is meaningless at zero
// deliveries, so the commit count is what tells "nothing to measure" from "measured and low" for
// that row instead.
function renderRowSample(row: ContributorRow): string {
  if (row.deliveries === 0) {
    const whose = row.account === null ? ' whose author address GitHub maps to no account' : ''
    return `0 deliveries · ${row.commits} commits${whose}`
  }
  return `${row.deliveries} deliveries · ${row.activeDays} active days`
}

// SAFETY: never below the row's own proven level, and never without the share that earned it — the
// same rule `renderDemonstratedSection` applies at the top of the document.
function renderRowDemonstrated(row: ContributorRow, report: AssessmentReport): string | null {
  const { demonstrated, proven } = row
  if (demonstrated === null || demonstrated.level === null) return null
  if (proven === null) return null
  if (demonstrated.level.rank <= proven.rank) return null

  return [
    '    demonstrated:',
    ...demonstrated.axes.map((axis) => `      ${renderRowDemonstratedAxis(axis, report)}`),
  ].join('\n')
}

function renderRowDemonstratedAxis(axis: DemonstratedAxis, report: AssessmentReport): string {
  const label = labelFor(axis.axis, report) ?? axis.axis
  const percent = Math.round(axis.share * 100)
  return `${label}: ${formatSet(axis.observed)} · reached on ${percent}% of ${occasionsOf(axis.unit)}`
}

function renderRowGapLines(report: AssessmentReport, row: ContributorRow): readonly string[] {
  const practiceBlockers = row.blocking.filter(
    (blocker): blocker is PracticeBlocker => blocker.gap === 'PRACTICE',
  )
  // INVARIANT: a practice gap on the row is a measurement that did say something, and the row must
  // read that way rather than as the evidence gap the plan's agreed prose only shows. A row mixing
  // both never reads as an evidence gap once one axis was actually measured and found low.
  if (practiceBlockers.length > 0) {
    return practiceBlockers.map((blocker) => renderRowPracticeGap(report, blocker))
  }

  const evidenceBlockers = row.blocking.filter(
    (blocker): blocker is EvidenceBlocker => blocker.gap === 'EVIDENCE',
  )
  return evidenceBlockers.length === 0 ? [] : [renderRowEvidenceGap(report, evidenceBlockers)]
}

// SAFETY: never `renderPracticeGap` — its fallback ends `Improve ${axisLabel} to close the gap.`,
// an imperative aimed at a named human. `project-brief.md` forbids recommending a practice change
// from a failure to prove one, and the plan forbids reading a thin row as a performance problem at
// all — this line carries no imperative of its own.
function renderRowPracticeGap(report: AssessmentReport, blocker: PracticeBlocker): string {
  const { levelLabel, axisLabel, axis } = locateAxis(report, blocker)
  const requirement = findUniquePracticeRequirement(axis, blocker)
  if (requirement) {
    return `    [practice gap] ${axisLabel} at ${levelLabel}: observed ${formatSet(requirement.observed)} does not reach the required ${formatSet(requirement.threshold)}.`
  }
  return `    [practice gap] ${axisLabel} at ${levelLabel}: the observed practice does not meet the requirement.`
}

function renderRowEvidenceGap(
  report: AssessmentReport,
  blockers: readonly EvidenceBlocker[],
): string {
  const labels = blockers.map((blocker) => locateAxis(report, blocker).axisLabel)
  const verb = labels.length === 1 ? 'is' : 'are'
  return `    [evidence gap] this account's own sample could not decide it, so ${joinLabels(labels)} ${verb} UNKNOWN for this account. This is not a statement about their practice.`
}

function joinLabels(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

function renderSharedHarnessLine(contributors: CompletedRoster): string | null {
  // INVARIANT: `null` per R11 is an evidence gap the roster completed anyway — the loaded model
  // declares no harness axis, or the scan left a rankable member undecidable — never a failure, and
  // the sentence is omitted rather than printed with a fabricated value.
  if (contributors.harnessObserved === null) return null
  return `  Harness is the repository's, not a person's: ${formatSet(contributors.harnessObserved)} are available to every account above, and each carries that same value.`
}

function renderRowHarness(row: ContributorRow, contributors: CompletedRoster): string {
  // SAFETY: `null` is a walk that did not run, and never "authored none" — printing the latter for
  // a `git` that failed would publish a claim about a person on the strength of a refusal.
  if (row.harnessAuthorship === null) {
    return 'harness: authorship could not be read'
  }
  if (contributors.harnessPaths === 0) {
    return `harness: this repository's harness set is empty`
  }
  const authored = row.harnessAuthorship.files === 0 ? 'none' : `${row.harnessAuthorship.files}`
  return `harness: authored ${authored} of the ${contributors.harnessPaths} files in this repository's harness set`
}

function formatValue(value: Threshold | ObservedValue): string {
  return Array.isArray(value) ? value.join(', ') : String(value)
}
