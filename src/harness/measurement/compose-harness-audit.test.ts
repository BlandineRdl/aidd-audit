import { describe, expect, it } from 'vitest'
import { GptTokenizerEncoderAdapter } from '../adapters/token-encoder.adapter.js'
import type { HarnessSourceFile } from '../ports/harness-source.port.js'
import { composeHarnessAudit } from './compose-harness-audit.js'

const encoder = new GptTokenizerEncoderAdapter()

const SHARED_LEFT =
  'Preamble text goes here. the quick brown fox jumps over the lazy dog, and stops.'
const SHARED_RIGHT =
  'Different opening sentence entirely! The Quick Brown Fox jumps over the lazy tail wagged happily.'

function sourceFiles(): readonly HarnessSourceFile[] {
  return [
    {
      path: 'CLAUDE.md',
      byteSize: SHARED_LEFT.length,
      content: SHARED_LEFT,
      tier: 'ALWAYS_LOADED',
      scope: 'SUBJECT',
    },
    {
      path: 'aidd_docs/memory/architecture.md',
      byteSize: SHARED_RIGHT.length,
      content: SHARED_RIGHT,
      tier: 'ALWAYS_LOADED',
      scope: 'SUBJECT',
    },
    {
      path: '.claude/rules/03-testing/3-tests.md',
      byteSize: 60,
      content: '- run tests\n- keep them green\n1. write red\n2. write green',
      tier: 'CONDITIONALLY_LOADED',
      scope: 'SUBJECT',
    },
    {
      path: '~/.claude/CLAUDE.md',
      byteSize: 40,
      content: 'global prose only, no lists at all here',
      tier: 'ALWAYS_LOADED',
      scope: 'MACHINE',
    },
  ]
}

describe('composing the harness audit report', () => {
  it('carries each file with its own line count and token estimate', () => {
    const report = composeHarnessAudit('claude', sourceFiles(), encoder)

    expect(report.files).toHaveLength(4)
    for (const file of report.files) {
      expect(file.lineCount).toBeGreaterThan(0)
      expect(file.tokenEstimate).toBeGreaterThan(0)
    }
  })

  it('totals each tier and scope over its own files only, and never a combination nothing measured', () => {
    const report = composeHarnessAudit('claude', sourceFiles(), encoder)

    const alwaysSubject = report.tierTotals.find(
      (total) => total.tier === 'ALWAYS_LOADED' && total.scope === 'SUBJECT',
    )
    const conditionalSubject = report.tierTotals.find(
      (total) => total.tier === 'CONDITIONALLY_LOADED' && total.scope === 'SUBJECT',
    )
    const alwaysMachine = report.tierTotals.find(
      (total) => total.tier === 'ALWAYS_LOADED' && total.scope === 'MACHINE',
    )
    const conditionalMachine = report.tierTotals.find(
      (total) => total.tier === 'CONDITIONALLY_LOADED' && total.scope === 'MACHINE',
    )

    expect(alwaysSubject?.fileCount).toBe(2)
    expect(conditionalSubject?.fileCount).toBe(1)
    expect(alwaysMachine?.fileCount).toBe(1)
    expect(conditionalMachine).toBeUndefined()
  })

  it('sums each tier total from exactly the files it lists', () => {
    const report = composeHarnessAudit('claude', sourceFiles(), encoder)

    for (const total of report.tierTotals) {
      const matching = report.files.filter(
        (file) => file.tier === total.tier && file.scope === total.scope,
      )

      expect(total.fileCount).toBe(matching.length)
      expect(total.lineCount).toBe(matching.reduce((sum, file) => sum + file.lineCount, 0))
      expect(total.tokenEstimate).toBe(matching.reduce((sum, file) => sum + file.tokenEstimate, 0))
    }
  })

  it('names the encoding and the shingle length beside the figures', () => {
    const report = composeHarnessAudit('claude', sourceFiles(), encoder)

    expect(report.encoding).toBe('o200k_base')
    expect(report.shingleLength).toBe(8)
  })

  it('names the tool whose loading convention was read', () => {
    const report = composeHarnessAudit('claude', sourceFiles(), encoder)

    expect(report.tool).toBe('claude')
  })

  it('names a pair sharing a reworded passage together with the passage itself', () => {
    const report = composeHarnessAudit('claude', sourceFiles(), encoder)

    expect(report.duplication).toEqual([
      {
        left: 'CLAUDE.md',
        right: 'aidd_docs/memory/architecture.md',
        passages: [{ words: ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy'] }],
      },
    ])
  })

  it('reports no countable line for a file that is entirely a code fence, not a share of zero', () => {
    const files: readonly HarnessSourceFile[] = [
      {
        path: 'fenced.md',
        byteSize: 20,
        content: ['```', 'const x = 1', '```'].join('\n'),
        tier: 'ALWAYS_LOADED',
        scope: 'SUBJECT',
      },
    ]

    const report = composeHarnessAudit('claude', files, encoder)

    expect(report.proseShares).toEqual([{ path: 'fenced.md', countable: false }])
  })

  it('reports nothing was found to measure for an empty harness, with no figure of zero', () => {
    const report = composeHarnessAudit('claude', [], encoder)

    expect(report.files).toEqual([])
    expect(report.tierTotals).toEqual([])
    expect(report.proseShares).toEqual([])
    expect(report.duplication).toEqual([])
  })

  it('returns identical figures for the same content composed twice', () => {
    const files = sourceFiles()

    expect(composeHarnessAudit('claude', files, encoder)).toEqual(
      composeHarnessAudit('claude', files, encoder),
    )
  })

  it('emits no field that grades, ranks, scores, warns or recommends', () => {
    const report = composeHarnessAudit('claude', sourceFiles(), encoder)
    const serialized = JSON.stringify(report).toLowerCase()

    const bannedWords = [
      'warn',
      'score',
      'grade',
      'rank',
      'threshold',
      'recommend',
      'good',
      'bad',
      'excessive',
      'insufficient',
      'verdict',
      'budget',
      'too long',
    ]
    for (const word of bannedWords) {
      expect(serialized).not.toContain(word)
    }
  })
})
