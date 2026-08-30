import type {
  DuplicationPair,
  Finding,
  HarnessAuditReport,
  LoadingTier,
  MeasuredFile,
  ProseShareReport,
  ReadingScope,
} from '../../harness/contracts/harness-audit-report.contract.js'

const SCOPE_LABEL: Record<ReadingScope, string> = {
  SUBJECT:
    'Subject (this repository) — reproduces the same bytes on any machine, on any day, for this subject.',
  MACHINE:
    "Machine (this tool's own configuration) — reproduces only against an unchanged machine, the same claim this tool makes for any source living outside the subject.",
}

// INVARIANT: the conditional tier is printed as a ceiling in words, never as an opening cost — it
// is the most a session *could* add if everything in it triggered, not what a session actually
// paid.
const TIER_LABEL: Record<LoadingTier, string> = {
  ALWAYS_LOADED: 'Always loaded — read at every session opening',
  CONDITIONALLY_LOADED:
    'Conditionally loaded — a ceiling on what could be added if every one of these triggered, never an opening cost',
}

export interface HarnessHumanRenderOptions {
  readonly details?: boolean
}

export function renderHarnessHumanReport(
  report: HarnessAuditReport,
  options: HarnessHumanRenderOptions = {},
): string {
  if (report.files.length === 0) {
    return [
      `Harness audit — loading convention read: ${report.tool}`,
      'Nothing was found to measure: no harness file was read for this subject.',
      renderUnreadSection(report),
    ]
      .filter((section) => section.length > 0)
      .join('\n\n')
  }

  const summarySections = [
    renderHeader(report),
    renderOverviewSection(report),
    renderUnreadSection(report),
  ]

  const sections = options.details
    ? [...summarySections, renderMeasurementsSection(report), renderFindingsSection(report)]
    : [
        ...summarySections,
        renderFindingsSection(report),
        'Details: re-run with --details to list every file, prose shape and shared passage.',
      ]
  return sections.filter((section) => section.length > 0).join('\n\n')
}

function renderHeader(report: HarnessAuditReport): string {
  return [
    `Harness audit — loading convention read: ${report.tool}`,
    `Token figures are estimates under the ${report.encoding} encoding, not the counts the model itself would produce.`,
  ].join('\n')
}

function renderOverviewSection(report: HarnessAuditReport): string {
  const lines = [
    'Context at session opening:',
    ...(['SUBJECT', 'MACHINE'] as const).flatMap((scope) => renderOverviewForScope(report, scope)),
  ]
  const conditional = (['SUBJECT', 'MACHINE'] as const).flatMap((scope) =>
    renderOverviewForScope(report, scope, 'CONDITIONALLY_LOADED'),
  )
  if (conditional.length > 0)
    lines.push('', 'Conditional context — ceiling, not an opening cost:', ...conditional)
  return lines.join('\n')
}

function renderOverviewForScope(
  report: HarnessAuditReport,
  scope: ReadingScope,
  tier: LoadingTier = 'ALWAYS_LOADED',
): readonly string[] {
  const overview = renderTierOverview(report, scope, tier)
  if (overview === '') return []
  const reproducibility =
    scope === 'SUBJECT' ? 'same subject on any machine' : 'unchanged machine configuration only'
  return [`  ${scope === 'SUBJECT' ? 'Subject' : 'Machine'} (${reproducibility}): ${overview}`]
}

function renderTierOverview(
  report: HarnessAuditReport,
  scope: ReadingScope,
  tier: LoadingTier,
): string {
  const total = report.tierTotals.find(
    (candidate) => candidate.scope === scope && candidate.tier === tier,
  )
  if (total === undefined) return ''
  return `${total.fileCount} file${plural(total.fileCount)}, ${total.lineCount} lines, ~${total.tokenEstimate} tokens`
}

function renderMeasurementsSection(report: HarnessAuditReport): string {
  return [
    'Details — every measured file:',
    `List line reading: ${report.listLineReading}`,
    renderScopeSection(report, 'SUBJECT'),
    renderScopeSection(report, 'MACHINE'),
    renderDuplicationSection(report),
  ]
    .filter((section) => section.length > 0)
    .join('\n\n')
}

function renderScopeSection(report: HarnessAuditReport, scope: ReadingScope): string {
  const files = report.files.filter((file) => file.scope === scope)
  if (files.length === 0) return ''

  const tierSections = (['ALWAYS_LOADED', 'CONDITIONALLY_LOADED'] as const)
    .map((tier) => renderTierSection(report, scope, tier))
    .filter((section) => section.length > 0)

  return [SCOPE_LABEL[scope], ...tierSections].join('\n')
}

function renderTierSection(
  report: HarnessAuditReport,
  scope: ReadingScope,
  tier: LoadingTier,
): string {
  const files = report.files.filter((file) => file.scope === scope && file.tier === tier)
  if (files.length === 0) return ''

  const total = report.tierTotals.find(
    (candidate) => candidate.scope === scope && candidate.tier === tier,
  )
  const totalLine =
    total === undefined
      ? ''
      : `    total: ${total.fileCount} file${plural(total.fileCount)}, ${total.lineCount} lines, ~${total.tokenEstimate} tokens (${report.encoding} estimate)`

  return [`  ${TIER_LABEL[tier]}`, totalLine, ...files.map((file) => renderFileLine(file, report))]
    .filter((line) => line.length > 0)
    .join('\n')
}

function renderFileLine(file: MeasuredFile, report: HarnessAuditReport): string {
  const share = report.proseShares.find((candidate) => candidate.path === file.path)
  const shareText = share === undefined ? '' : ` · ${renderProseShare(share)}`
  return `    ${file.path}: ${file.lineCount} lines, ~${file.tokenEstimate} tokens${shareText}`
}

function renderProseShare(share: ProseShareReport): string {
  if (!share.countable) return 'no countable line (blank or fenced content only)'
  return `${share.listLines} list line${plural(share.listLines)}, ${share.proseLines} prose line${plural(share.proseLines)}`
}

function renderDuplicationSection(report: HarnessAuditReport): string {
  if (report.duplication.length === 0) return ''
  const lines = report.duplication.map((pair) => renderDuplicationPair(pair, report))
  return ['Shared passages — exact repeated word sequences:', ...lines].join('\n')
}

function renderDuplicationPair(pair: DuplicationPair, report: HarnessAuditReport): string {
  const header = `  ${pair.left} <-> ${pair.right}: ${pair.passages.length} shared passage${plural(pair.passages.length)}, at least ${report.shingleLength} words each`
  const passageLines = pair.passages.map((passage) => `    "${passage.words.join(' ')}"`)
  return [header, ...passageLines].join('\n')
}

function renderUnreadSection(report: HarnessAuditReport): string {
  if (report.unread.length === 0) return ''
  return [
    'Unread entries — excluded from measurements:',
    ...report.unread.map((entry) => `  ${entry.path} (${entry.scope}): ${entry.reason}`),
  ].join('\n')
}

function plural(count: number): string {
  return count === 1 ? '' : 's'
}

// INVARIANT: the sole section where a threshold, a comparison against one, and a recommendation
// are allowed to appear. The concise rendering places it after the overview; `--details` keeps it
// after every measurement, so a reader chooses whether to act first or inspect first.
// `renderFindingsSection` is the only function in this file that may say any of that.
function renderFindingsSection(report: HarnessAuditReport): string {
  const header = `Findings — ${report.findings.length} action${plural(report.findings.length)}, measured against chosen guidelines:`
  if (report.findings.length === 0) {
    return [header, '  nothing observed is over any stated guideline.'].join('\n')
  }
  return [header, ...report.findings.map(renderFinding)].join('\n\n')
}

// INVARIANT: observed and guidelineValue print as-is, a fraction between 0 and 1 for PROSE_SHARE
// included — never as a percentage. That keeps this renderer free of a form the duplication
// section is separately asserted never to print, and keeps prose and `--json` stating the same
// figure rather than two different-looking ones for the same finding.
function renderFinding(finding: Finding): string {
  const savingText =
    finding.potentialTokensRemoved === null
      ? ''
      : ` · potential removal: up to ~${finding.potentialTokensRemoved} tokens`

  const shown = (value: number): string =>
    finding.guideline === 'PROSE_SHARE' ? `${Math.round(value * 100)}% prose` : `${value}`

  return [
    `  [${finding.guideline}] ${finding.subject}`,
    `    observed: ${shown(finding.observed)} · guideline: ${shown(finding.guidelineValue)}${savingText}`,
    `    action: ${finding.action}`,
  ].join('\n')
}
