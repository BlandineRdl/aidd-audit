import { describe, expect, it } from 'vitest'
import type { HarnessAuditReport } from '../contracts/harness-audit-report.contract.js'
import type { TokenEncoderPort } from '../ports/token-encoder.port.js'
import { harnessFindings } from './harness-findings.js'

const encoder: TokenEncoderPort = {
  encoding: 'test',
  estimate: (text) => ({ tokens: text.split(' ').filter(Boolean).length, encoding: 'test' }),
}

function report(overrides: Partial<HarnessAuditReport> = {}): HarnessAuditReport {
  return {
    schemaVersion: 1,
    tool: 'claude',
    encoding: 'test',
    shingleLength: 8,
    listLineReading: 'test',
    files: [],
    tierTotals: [],
    proseShares: [],
    duplication: [],
    unread: [],
    findings: [],
    ...overrides,
  }
}

describe('harness findings', () => {
  it('uses a strict threshold and exposes a potential removal, never a measured saving', () => {
    const findings = harnessFindings(
      report({
        files: [
          {
            path: 'CLAUDE.md',
            byteSize: 1,
            lineCount: 1,
            tokenEstimate: 10_001,
            tier: 'ALWAYS_LOADED',
            scope: 'SUBJECT',
          },
          {
            path: '~/.claude/CLAUDE.md',
            byteSize: 1,
            lineCount: 1,
            tokenEstimate: 4_000,
            tier: 'ALWAYS_LOADED',
            scope: 'MACHINE',
          },
        ],
        tierTotals: [
          {
            tier: 'ALWAYS_LOADED',
            scope: 'SUBJECT',
            fileCount: 1,
            lineCount: 1,
            tokenEstimate: 10_001,
          },
          {
            tier: 'ALWAYS_LOADED',
            scope: 'MACHINE',
            fileCount: 1,
            lineCount: 1,
            tokenEstimate: 4_000,
          },
        ],
      }),
      encoder,
    )

    expect(findings).toContainEqual(
      expect.objectContaining({
        guideline: 'SESSION_OPENING_TOKEN_BUDGET',
        observed: 14_001,
        guidelineValue: 10_000,
        potentialTokensRemoved: 4_001,
      }),
    )
    expect(findings).toContainEqual(
      expect.objectContaining({
        guideline: 'ALWAYS_LOADED_FILE_TOKENS',
        subject: 'CLAUDE.md',
        potentialTokensRemoved: 10_001,
      }),
    )
    expect(findings.some((finding) => finding.subject === '~/.claude/CLAUDE.md')).toBe(false)
    expect(JSON.stringify(findings)).not.toContain('tokensSaved')
  })

  it('does not apply the prose-share guideline below its chosen applicability guard', () => {
    const findings = harnessFindings(
      report({
        proseShares: [{ path: 'short.md', countable: true, listLines: 0, proseLines: 19 }],
      }),
      encoder,
    )

    expect(findings).toEqual([])
  })

  it('counts one potential removal for each distinct maximal shared passage', () => {
    const findings = harnessFindings(
      report({
        duplication: [
          {
            left: 'left.md',
            right: 'right.md',
            passages: Array.from({ length: 6 }, (_, index) => ({
              words: ['passage', String(index), 'has', 'eight', 'words', 'for', 'this', 'test'],
            })),
          },
        ],
      }),
      encoder,
    )

    expect(findings).toEqual([
      expect.objectContaining({
        guideline: 'SHARED_PASSAGES_PER_PAIR',
        observed: 6,
        potentialTokensRemoved: 48,
      }),
    ])
  })
})
