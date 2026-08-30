import type {
  DuplicationPair,
  Finding,
  HarnessAuditReport,
  MeasuredFile,
  ProseShareReport,
} from '../contracts/harness-audit-report.contract.js'
import type { TokenEncoderPort } from '../ports/token-encoder.port.js'
import {
  ALWAYS_LOADED_FILE_LINES,
  ALWAYS_LOADED_FILE_TOKENS,
  PROSE_SHARE,
  PROSE_SHARE_MINIMUM_LINES,
  SESSION_OPENING_TOKEN_BUDGET,
  SHARED_PASSAGES_PER_PAIR,
} from './guidelines.js'

// INVARIANT: the subject of a session-wide finding, distinct from any file path or file pair a
// reader could otherwise mistake it for.
const SESSION_SUBJECT = 'session opening (always-loaded, subject and machine combined)'

function sessionBudgetFinding(report: HarnessAuditReport): Finding | null {
  const alwaysLoadedTotal = report.tierTotals
    .filter((total) => total.tier === 'ALWAYS_LOADED')
    .reduce((sum, total) => sum + total.tokenEstimate, 0)

  if (alwaysLoadedTotal <= SESSION_OPENING_TOKEN_BUDGET) return null

  return {
    guideline: 'SESSION_OPENING_TOKEN_BUDGET',
    subject: SESSION_SUBJECT,
    observed: alwaysLoadedTotal,
    guidelineValue: SESSION_OPENING_TOKEN_BUDGET,
    action:
      'Move some always-loaded content behind a path-scoped rule or an on-demand declaration ' +
      'so it is read only for the work that needs it.',
    potentialTokensRemoved: alwaysLoadedTotal - SESSION_OPENING_TOKEN_BUDGET,
  }
}

// INVARIANT: both the token and the line guideline, when either fires, credit the same saving —
// the file's own tokenEstimate — because the one action either finding recommends, giving the
// file a `paths:` scope, moves it out of every session opening regardless of which guideline
// named the file.
function alwaysLoadedFileFindings(files: readonly MeasuredFile[]): readonly Finding[] {
  const findings: Finding[] = []

  for (const file of files) {
    if (file.tier !== 'ALWAYS_LOADED') continue

    if (file.tokenEstimate > ALWAYS_LOADED_FILE_TOKENS) {
      findings.push({
        guideline: 'ALWAYS_LOADED_FILE_TOKENS',
        subject: file.path,
        observed: file.tokenEstimate,
        guidelineValue: ALWAYS_LOADED_FILE_TOKENS,
        action: `Give ${file.path} a paths: scope so it loads only for the work it concerns.`,
        potentialTokensRemoved: file.tokenEstimate,
      })
    }

    if (file.lineCount > ALWAYS_LOADED_FILE_LINES) {
      findings.push({
        guideline: 'ALWAYS_LOADED_FILE_LINES',
        subject: file.path,
        observed: file.lineCount,
        guidelineValue: ALWAYS_LOADED_FILE_LINES,
        action: `Split ${file.path} so a reader is not faced with the whole file at once.`,
        potentialTokensRemoved: file.tokenEstimate,
      })
    }
  }

  return findings
}

function proseShareFindings(proseShares: readonly ProseShareReport[]): readonly Finding[] {
  const findings: Finding[] = []

  for (const share of proseShares) {
    if (!share.countable) continue
    const countable = share.listLines + share.proseLines
    if (countable < PROSE_SHARE_MINIMUM_LINES) continue

    const observed = share.proseLines / countable
    if (observed > PROSE_SHARE) {
      findings.push({
        guideline: 'PROSE_SHARE',
        subject: share.path,
        observed,
        guidelineValue: PROSE_SHARE,
        action: `Reformat ${share.path} toward more list structure and less running prose.`,
        potentialTokensRemoved: null,
      })
    }
  }

  return findings
}

function duplicationFindings(
  pairs: readonly DuplicationPair[],
  encoder: TokenEncoderPort,
): readonly Finding[] {
  const findings: Finding[] = []

  for (const pair of pairs) {
    if (pair.passages.length <= SHARED_PASSAGES_PER_PAIR) continue

    const potentialTokensRemoved = pair.passages.reduce(
      (sum, passage) => sum + encoder.estimate(passage.words.join(' ')).tokens,
      0,
    )

    findings.push({
      guideline: 'SHARED_PASSAGES_PER_PAIR',
      subject: `${pair.left} <-> ${pair.right}`,
      observed: pair.passages.length,
      guidelineValue: SHARED_PASSAGES_PER_PAIR,
      action: `Extract what ${pair.left} and ${pair.right} share into one file both can reference.`,
      potentialTokensRemoved,
    })
  }

  return findings
}

function byPotentialTokensRemovedDescendingNullsLast(left: Finding, right: Finding): number {
  if (left.potentialTokensRemoved === null && right.potentialTokensRemoved === null) return 0
  if (left.potentialTokensRemoved === null) return 1
  if (right.potentialTokensRemoved === null) return -1
  return right.potentialTokensRemoved - left.potentialTokensRemoved
}

// INVARIANT: pure over the composed report — no filesystem, no npm package, no vendor SDK. The
// encoder is a port, injected by the caller that already built one to measure the files
// themselves; it is never imported here as a concrete adapter.
export function harnessFindings(
  report: HarnessAuditReport,
  encoder: TokenEncoderPort,
): readonly Finding[] {
  const findings: readonly Finding[] = [
    ...alwaysLoadedFileFindings(report.files),
    ...proseShareFindings(report.proseShares),
    ...duplicationFindings(report.duplication, encoder),
    sessionBudgetFinding(report),
  ].filter((finding): finding is Finding => finding !== null)

  return [...findings].sort(byPotentialTokensRemovedDescendingNullsLast)
}
