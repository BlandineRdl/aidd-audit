import { describe, expect, it } from 'vitest'
import type { HarnessAuditReport } from '../../harness/contracts/harness-audit-report.contract.js'
import { renderHarnessJsonReport } from './harness-json.renderer.js'
import { UnrenderableReportError } from './unrenderable-report.error.js'

function report(overrides: Partial<HarnessAuditReport> = {}): HarnessAuditReport {
  return {
    schemaVersion: 1,
    tool: 'claude',
    encoding: 'o200k_base',
    shingleLength: 8,
    listLineReading:
      'a line beginning with -, *, or +; a digit followed by . or ); or | for a table row',
    files: [
      {
        path: 'CLAUDE.md',
        byteSize: 42,
        lineCount: 3,
        tokenEstimate: 12,
        tier: 'ALWAYS_LOADED',
        scope: 'SUBJECT',
      },
    ],
    tierTotals: [
      { tier: 'ALWAYS_LOADED', scope: 'SUBJECT', fileCount: 1, lineCount: 3, tokenEstimate: 12 },
    ],
    proseShares: [{ path: 'CLAUDE.md', countable: true, listLines: 1, proseLines: 2 }],
    duplication: [],
    unread: [],
    findings: [],
    ...overrides,
  }
}

describe('1. the output is valid JSON', () => {
  it('parses without throwing', () => {
    const output = renderHarnessJsonReport(report())
    expect(() => JSON.parse(output)).not.toThrow()
  })

  it('has no trailing newline', () => {
    const output = renderHarnessJsonReport(report())
    expect(output.endsWith('\n')).toBe(false)
  })
})

describe('2. the projection carries only what the contract declares', () => {
  it('round-trips every field, including a shared passage', () => {
    const withDuplication = report({
      duplication: [
        {
          left: 'CLAUDE.md',
          right: 'aidd_docs/memory/architecture.md',
          passages: [{ words: ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy'] }],
        },
      ],
    })

    const parsed = JSON.parse(renderHarnessJsonReport(withDuplication))

    expect(parsed).toEqual(withDuplication)
  })

  it('round-trips an uncountable prose share as false, not as zero counts', () => {
    const withUncountable = report({
      proseShares: [{ path: 'fenced.md', countable: false }],
    })

    const parsed = JSON.parse(renderHarnessJsonReport(withUncountable))

    expect(parsed.proseShares).toEqual([{ path: 'fenced.md', countable: false }])
  })

  it('publishes an empty harness as empty arrays, never a zeroed total', () => {
    const empty = report({
      files: [],
      tierTotals: [],
      proseShares: [],
      duplication: [],
      findings: [],
    })

    const parsed = JSON.parse(renderHarnessJsonReport(empty))

    expect(parsed.files).toEqual([])
    expect(parsed.tierTotals).toEqual([])
    expect(parsed.findings).toEqual([])
  })

  it('round-trips a finding, including a null potentialTokensRemoved and a fraction observed value', () => {
    const withFindings = report({
      findings: [
        {
          guideline: 'PROSE_SHARE',
          subject: 'CLAUDE.md',
          observed: 0.75,
          guidelineValue: 0.6,
          action: 'Reformat CLAUDE.md toward more list structure and less running prose.',
          potentialTokensRemoved: null,
        },
      ],
    })

    const parsed = JSON.parse(renderHarnessJsonReport(withFindings))

    expect(parsed.findings).toEqual(withFindings.findings)
    expect(parsed.findings[0].observed).toBe(0.75)
  })

  it('round-trips an unread entry instead of hiding it as a zero measurement', () => {
    const withUnread = report({
      unread: [
        {
          path: 'memory/missing.md',
          scope: 'SUBJECT',
          reason: 'MISSING_IMPORT',
        },
      ],
    })

    expect(JSON.parse(renderHarnessJsonReport(withUnread)).unread).toEqual(withUnread.unread)
  })
})

describe('3. a non-finite figure is refused rather than published', () => {
  it('throws UnrenderableReportError naming the field, for a token estimate that overflowed', () => {
    const broken = report({
      files: [
        {
          path: 'CLAUDE.md',
          byteSize: 42,
          lineCount: 3,
          tokenEstimate: Number.POSITIVE_INFINITY,
          tier: 'ALWAYS_LOADED',
          scope: 'SUBJECT',
        },
      ],
    })

    expect(() => renderHarnessJsonReport(broken)).toThrow(UnrenderableReportError)
    expect(() => renderHarnessJsonReport(broken)).toThrow('$.files[0].tokenEstimate')
  })

  it('throws for a NaN figure inside a tier total', () => {
    const broken = report({
      tierTotals: [
        {
          tier: 'ALWAYS_LOADED',
          scope: 'SUBJECT',
          fileCount: 1,
          lineCount: 3,
          tokenEstimate: Number.NaN,
        },
      ],
    })

    expect(() => renderHarnessJsonReport(broken)).toThrow(UnrenderableReportError)
    expect(() => renderHarnessJsonReport(broken)).toThrow('$.tierTotals[0].tokenEstimate')
  })
})
