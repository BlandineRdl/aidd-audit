import { describe, expect, it } from 'vitest'
import type { HarnessAuditReport } from '../../harness/contracts/harness-audit-report.contract.js'
import { renderHarnessHumanReport } from './harness-human.renderer.js'

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
      {
        path: '.claude/rules/03-testing/3-tests.md',
        byteSize: 200,
        lineCount: 20,
        tokenEstimate: 300,
        tier: 'CONDITIONALLY_LOADED',
        scope: 'SUBJECT',
      },
      {
        path: '~/.claude/CLAUDE.md',
        byteSize: 40,
        lineCount: 5,
        tokenEstimate: 15,
        tier: 'ALWAYS_LOADED',
        scope: 'MACHINE',
      },
    ],
    tierTotals: [
      { tier: 'ALWAYS_LOADED', scope: 'SUBJECT', fileCount: 1, lineCount: 3, tokenEstimate: 12 },
      {
        tier: 'CONDITIONALLY_LOADED',
        scope: 'SUBJECT',
        fileCount: 1,
        lineCount: 20,
        tokenEstimate: 300,
      },
      { tier: 'ALWAYS_LOADED', scope: 'MACHINE', fileCount: 1, lineCount: 5, tokenEstimate: 15 },
    ],
    proseShares: [
      { path: 'CLAUDE.md', countable: true, listLines: 1, proseLines: 2 },
      { path: '.claude/rules/03-testing/3-tests.md', countable: false },
      { path: '~/.claude/CLAUDE.md', countable: true, listLines: 0, proseLines: 5 },
    ],
    duplication: [
      {
        left: 'CLAUDE.md',
        right: 'aidd_docs/memory/architecture.md',
        passages: [{ words: ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy'] }],
      },
    ],
    unread: [],
    findings: [
      {
        guideline: 'ALWAYS_LOADED_FILE_TOKENS',
        subject: '.claude/rules/03-testing/3-tests.md',
        observed: 4200,
        guidelineValue: 4000,
        action:
          'Give .claude/rules/03-testing/3-tests.md a paths: scope so it loads only for the work it concerns.',
        potentialTokensRemoved: 4200,
      },
      {
        guideline: 'PROSE_SHARE',
        subject: '~/.claude/CLAUDE.md',
        observed: 0.75,
        guidelineValue: 0.6,
        action: 'Reformat ~/.claude/CLAUDE.md toward more list structure and less running prose.',
        potentialTokensRemoved: null,
      },
    ],
    ...overrides,
  }
}

describe('the two tiers, printed separately and never summed', () => {
  it('names the always-loaded tier and the conditional tier as their own sections', () => {
    const output = renderHarnessHumanReport(report())

    expect(output).toContain('Context at session opening')
    expect(output).toContain('Conditional context')
  })

  it('prints the conditional tier as a ceiling, in words, never as a cost the session actually pays', () => {
    const output = renderHarnessHumanReport(report())

    expect(output).toContain('ceiling')
    expect(output).toContain('not an opening cost')
  })

  it('never prints a figure summing the two tiers', () => {
    const output = renderHarnessHumanReport(report())

    // 12 (always-loaded total) + 300 (conditional total) = 312: that sum must not appear.
    expect(output).not.toContain('312')
  })

  it('never prints a figure summing the subject scope with the machine scope', () => {
    const output = renderHarnessHumanReport(report())

    // 12 (subject always-loaded) + 15 (machine always-loaded) = 27: that sum must not appear.
    expect(output).not.toContain('27')
  })

  it('keeps a machine conditional tier separate when one exists', () => {
    const output = renderHarnessHumanReport(
      report({
        tierTotals: [
          ...report().tierTotals,
          {
            tier: 'CONDITIONALLY_LOADED',
            scope: 'MACHINE',
            fileCount: 2,
            lineCount: 9,
            tokenEstimate: 31,
          },
        ],
      }),
    )

    expect(output).toContain(
      'Machine (unchanged machine configuration only): 2 files, 9 lines, ~31 tokens',
    )
  })
})

describe('the two scopes, each labelled with what it can be reproduced against', () => {
  it('labels the subject scope as reproducible on any machine', () => {
    const output = renderHarnessHumanReport(report())

    expect(output).toContain('Subject')
    expect(output).toContain('same subject on any machine')
  })

  it('labels the machine scope as reproducible only against an unchanged machine', () => {
    const output = renderHarnessHumanReport(report())

    expect(output).toContain('Machine')
    expect(output).toContain('unchanged machine configuration only')
  })
})

describe('the encoding and the estimate framing', () => {
  it('names the encoding beside the figures', () => {
    const output = renderHarnessHumanReport(report())

    expect(output).toContain('o200k_base')
  })

  it('says the figures are estimates, not the model’s own count', () => {
    const output = renderHarnessHumanReport(report())

    expect(output).toContain('estimates')
  })
})

describe('every measured file, with its own length', () => {
  it('lists each file with its own line count and token estimate', () => {
    const output = renderHarnessHumanReport(report(), { details: true })

    expect(output).toContain('CLAUDE.md: 3 lines, ~12 tokens')
    expect(output).toContain('.claude/rules/03-testing/3-tests.md: 20 lines, ~300 tokens')
    expect(output).toContain('~/.claude/CLAUDE.md: 5 lines, ~15 tokens')
  })
})

describe('the prose-versus-list reading', () => {
  it('states the reading that produced the figure', () => {
    const output = renderHarnessHumanReport(report(), { details: true })

    expect(output).toContain('List line reading:')
    expect(output).toContain('a line beginning with')
  })

  it('carries the count of list and prose lines per file', () => {
    const output = renderHarnessHumanReport(report(), { details: true })

    expect(output).toContain('1 list line, 2 prose lines')
  })

  it('never renders an uncountable file as a share of zero', () => {
    const output = renderHarnessHumanReport(report(), { details: true })

    expect(output).toContain('no countable line')
    expect(output).not.toMatch(/3-tests\.md.*0 list line/)
  })
})

describe('shared passages, named without a similarity score', () => {
  it('names the pair and the passage itself', () => {
    const output = renderHarnessHumanReport(report(), { details: true })

    expect(output).toContain('CLAUDE.md <-> aidd_docs/memory/architecture.md')
    expect(output).toContain('the quick brown fox jumps over the lazy')
  })

  it('never prints a ratio or a percentage for duplication', () => {
    const output = renderHarnessHumanReport(report(), { details: true })
    const start = output.indexOf('Shared passages')
    const duplicationSection = output.slice(start, output.indexOf('Findings', start))

    expect(duplicationSection).not.toMatch(/\d+%/)
  })
})

describe('an empty harness', () => {
  it('says nothing was found to measure, and names no figure of zero', () => {
    const output = renderHarnessHumanReport(
      report({ files: [], tierTotals: [], proseShares: [], duplication: [], findings: [] }),
    )

    expect(output).toContain('Nothing was found to measure')
    expect(output).not.toMatch(/\b0\b/)
  })
})

describe('unread harness entries', () => {
  it('names each excluded entry and why it could not be measured', () => {
    const output = renderHarnessHumanReport(
      report({
        unread: [
          {
            path: '.claude/rules/broken.md',
            scope: 'SUBJECT',
            reason: 'INVALID_RULE_FRONT_MATTER',
          },
        ],
      }),
    )

    expect(output).toContain('Unread entries — excluded from measurements:')
    expect(output).toContain('.claude/rules/broken.md (SUBJECT): INVALID_RULE_FRONT_MATTER')
  })
})

describe('the Findings section', () => {
  it('names the guideline, observed value, guideline value, action and saving in a scannable block', () => {
    const output = renderHarnessHumanReport(report())

    expect(output).toContain('Findings — 2 actions, measured against chosen guidelines:')
    expect(output).toContain('[ALWAYS_LOADED_FILE_TOKENS] .claude/rules/03-testing/3-tests.md')
    expect(output).toContain('observed: 4200 · guideline: 4000')
    expect(output).toContain('action: Give .claude/rules/03-testing/3-tests.md a paths: scope')
    expect(output).toContain('potential removal: up to ~4200 tokens')
  })

  // INVARIANT: a share is a fraction in the contract and a percentage in prose, the same split
  // `assess` already publishes. Prose once printed 0.6744186046511628 verbatim, which is the
  // contract's value shown to a reader who has no use for it.
  it('renders a prose-share finding as a percentage, with no saving figure since none is derivable', () => {
    const output = renderHarnessHumanReport(report())

    expect(output).toContain(
      '[PROSE_SHARE] ~/.claude/CLAUDE.md\n    observed: 75% prose · guideline: 60% prose',
    )
    expect(output).not.toMatch(/\[PROSE_SHARE\][\s\S]*potential removal[\s\S]*Reformat/)
  })

  it('keeps Findings after the full measurement section in detailed prose', () => {
    const output = renderHarnessHumanReport(report(), { details: true })

    expect(output.indexOf('Shared passages')).toBeLessThan(
      output.indexOf('Findings — 2 actions, measured against chosen guidelines:'),
    )
  })

  it('keeps the exhaustive measurements opt-in in the concise rendering', () => {
    const output = renderHarnessHumanReport(report())

    expect(output).toContain('Details: re-run with --details')
    expect(output).not.toContain('Shared passages')
    expect(output).not.toContain('List line reading:')
  })
})

// INVARIANT: replaces the old blanket ban on grading words. That property no longer holds — the
// human who owns this project deliberately reversed the audit's "measure only, never judge"
// constraint, and the Findings section is now the one place a threshold, a comparison against one,
// and a recommendation are expected to appear. What must still hold, and is asserted here instead:
// every finding names a guideline from the closed set the contract declares, no finding exists
// without one, the measurement sections above the Findings section still carry no grading word, and
// a report with nothing over the guidelines still renders the section rather than omitting it.
describe('the verdict is confined to the Findings section', () => {
  const GUIDELINE_IDS = [
    'SESSION_OPENING_TOKEN_BUDGET',
    'ALWAYS_LOADED_FILE_TOKENS',
    'ALWAYS_LOADED_FILE_LINES',
    'PROSE_SHARE',
    'SHARED_PASSAGES_PER_PAIR',
  ]

  it('names a guideline from the declared closed set for every finding, and no finding without one', () => {
    for (const finding of report().findings) {
      expect(GUIDELINE_IDS).toContain(finding.guideline)
    }
  })

  it('never carries a grading word above the Findings section', () => {
    const output = renderHarnessHumanReport(report())
    const aboveFindings = output.slice(0, output.indexOf('Findings —'))
    const lowered = aboveFindings.toLowerCase()

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
      expect(lowered).not.toContain(word)
    }
  })

  it('renders a Findings section that says so when a report has nothing over the guidelines', () => {
    const output = renderHarnessHumanReport(report({ findings: [] }))

    expect(output).toContain('Findings — 0 actions, measured against chosen guidelines:')
    expect(output).toContain('nothing observed is over any stated guideline')
  })
})
