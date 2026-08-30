import { harnessFindings } from '../advice/harness-findings.js'
import type {
  DuplicationPair,
  HarnessAuditReport,
  MeasuredFile,
  ProseShareReport,
  TierTotal,
} from '../contracts/harness-audit-report.contract.js'
import { HARNESS_AUDIT_REPORT_SCHEMA_VERSION } from '../contracts/harness-audit-report.contract.js'
import { LOADING_TIERS } from '../models/loading-tier.model.js'
import { READING_SCOPES } from '../models/reading-scope.model.js'
import type { HarnessSourceFile, HarnessSourceUnreadEntry } from '../ports/harness-source.port.js'
import type { TokenEncoderPort } from '../ports/token-encoder.port.js'
import { measureFileLength } from './file-length.js'
import { LIST_LINE_READING, measureProseShare } from './prose-share.js'
import { SHINGLE_LENGTH, sharedPassagesBetween } from './shared-passages.js'

function tierTotalsOf(files: readonly MeasuredFile[]): readonly TierTotal[] {
  const totals: TierTotal[] = []
  for (const tier of LOADING_TIERS) {
    for (const scope of READING_SCOPES) {
      const inBucket = files.filter((file) => file.tier === tier && file.scope === scope)
      // INVARIANT: an empty bucket contributes no entry at all, never one reading zero — a report
      // that named every tier and scope pairing at fileCount: 0 would state a figure of zero for a
      // combination nothing was ever asked to measure.
      if (inBucket.length === 0) continue
      totals.push({
        tier,
        scope,
        fileCount: inBucket.length,
        lineCount: inBucket.reduce((total, file) => total + file.lineCount, 0),
        tokenEstimate: inBucket.reduce((total, file) => total + file.tokenEstimate, 0),
      })
    }
  }
  return totals
}

function proseSharesOf(sourceFiles: readonly HarnessSourceFile[]): readonly ProseShareReport[] {
  return sourceFiles.map((file): ProseShareReport => {
    const share = measureProseShare(file.content)
    return share.countable
      ? {
          path: file.path,
          countable: true,
          listLines: share.listLines,
          proseLines: share.proseLines,
        }
      : { path: file.path, countable: false }
  })
}

function duplicationOf(sourceFiles: readonly HarnessSourceFile[]): readonly DuplicationPair[] {
  const pairs: DuplicationPair[] = []
  for (let left = 0; left < sourceFiles.length; left += 1) {
    for (let right = left + 1; right < sourceFiles.length; right += 1) {
      const leftFile = sourceFiles[left]
      const rightFile = sourceFiles[right]
      if (leftFile === undefined || rightFile === undefined) continue
      const passages = sharedPassagesBetween(leftFile.content, rightFile.content)
      if (passages.length > 0) {
        pairs.push({ left: leftFile.path, right: rightFile.path, passages })
      }
    }
  }
  return pairs
}

// INVARIANT: a projection into the public contract, deciding nothing about which files were loaded
// or how — that is the source's job, behind HarnessSourcePort. This is also where the absence of any
// verdict is enforced: nothing computed here is a ratio against a threshold, and the contract this
// returns has no field to hold one.
export function composeHarnessAudit(
  tool: string,
  sourceFiles: readonly HarnessSourceFile[],
  encoder: TokenEncoderPort,
  unread: readonly HarnessSourceUnreadEntry[] = [],
): HarnessAuditReport {
  const files: readonly MeasuredFile[] = sourceFiles.map((file) => {
    const length = measureFileLength(file.content, encoder)
    return {
      path: file.path,
      byteSize: file.byteSize,
      lineCount: length.lineCount,
      tokenEstimate: length.tokenEstimate,
      tier: file.tier,
      scope: file.scope,
    }
  })

  // INVARIANT: findings are derived from the report itself, so `harnessFindings` never repeats a
  // measurement rule already decided above — it only compares what was already computed against
  // the named guidelines.
  const reportWithoutFindings: HarnessAuditReport = {
    schemaVersion: HARNESS_AUDIT_REPORT_SCHEMA_VERSION,
    tool,
    encoding: encoder.encoding,
    shingleLength: SHINGLE_LENGTH,
    listLineReading: LIST_LINE_READING,
    files,
    tierTotals: tierTotalsOf(files),
    proseShares: proseSharesOf(sourceFiles),
    duplication: duplicationOf(sourceFiles),
    unread,
    findings: [],
  }

  return {
    ...reportWithoutFindings,
    findings: harnessFindings(reportWithoutFindings, encoder),
  }
}
