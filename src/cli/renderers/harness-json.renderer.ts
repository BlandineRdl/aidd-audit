import type {
  DuplicationPair,
  Finding,
  HarnessAuditReport,
  MeasuredFile,
  ProseShareReport,
  TierTotal,
} from '../../harness/contracts/harness-audit-report.contract.js'
import { UnrenderableReportError } from './unrenderable-report.error.js'

export function renderHarnessJsonReport(report: HarnessAuditReport): string {
  const projected = projectReport(report)
  assertEveryNumberFinite(projected, '$')
  return JSON.stringify(projected, null, 2)
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

// INVARIANT: projected field by field rather than stringifying the internal report, so a field the
// contract does not declare never reaches the published output — the same discipline
// `json.renderer.ts` holds for the assessment contract.
function projectReport(report: HarnessAuditReport): HarnessAuditReport {
  return {
    schemaVersion: report.schemaVersion,
    tool: report.tool,
    encoding: report.encoding,
    shingleLength: report.shingleLength,
    listLineReading: report.listLineReading,
    files: report.files.map(projectFile),
    tierTotals: report.tierTotals.map(projectTierTotal),
    proseShares: report.proseShares.map(projectProseShare),
    duplication: report.duplication.map(projectDuplicationPair),
    unread: report.unread.map((entry) => ({
      path: entry.path,
      scope: entry.scope,
      reason: entry.reason,
    })),
    findings: report.findings.map(projectFinding),
  }
}

function projectFile(file: MeasuredFile): MeasuredFile {
  return {
    path: file.path,
    byteSize: file.byteSize,
    lineCount: file.lineCount,
    tokenEstimate: file.tokenEstimate,
    tier: file.tier,
    scope: file.scope,
  }
}

function projectTierTotal(total: TierTotal): TierTotal {
  return {
    tier: total.tier,
    scope: total.scope,
    fileCount: total.fileCount,
    lineCount: total.lineCount,
    tokenEstimate: total.tokenEstimate,
  }
}

// Branching preserves the contract's discriminated union without a cast.
function projectProseShare(share: ProseShareReport): ProseShareReport {
  return share.countable
    ? {
        path: share.path,
        countable: true,
        listLines: share.listLines,
        proseLines: share.proseLines,
      }
    : { path: share.path, countable: false }
}

function projectDuplicationPair(pair: DuplicationPair): DuplicationPair {
  return {
    left: pair.left,
    right: pair.right,
    passages: pair.passages.map((passage) => ({ words: passage.words })),
  }
}

// INVARIANT: `observed` and `guidelineValue` are published as-is — a fraction for `PROSE_SHARE`
// stays between 0 and 1, never rendered as a percentage. That rendering belongs to prose alone.
function projectFinding(finding: Finding): Finding {
  return {
    guideline: finding.guideline,
    subject: finding.subject,
    observed: finding.observed,
    guidelineValue: finding.guidelineValue,
    action: finding.action,
    potentialTokensRemoved: finding.potentialTokensRemoved,
  }
}
