import { beforeAll, describe, expect, it } from 'vitest'
import type { HarnessAuditReport } from '../../src/harness/contracts/harness-audit-report.contract.js'
import { runCli } from './spawn-cli.test-fixture.js'

// INVARIANT: this repository auditing itself tests the capability and its invariants, never the
// state of this checkout — no line count, no token figure, no file list is pinned here.
// `aidd_docs/memory/testing.md` records that an earlier self-assessment suite pinned exactly that
// and had to be corrected for the same reason; this suite is written not to repeat it. A file gained
// or lost, a rule reworded, a memory file split — none of that may turn this suite red.

const MATURITY_LEVEL_WORDS = ['White', 'Red', 'Blue', 'Green', 'Copper', 'Silver', 'Gold']
const GRADING_WORDS = [
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
  'proven',
  'demonstrated',
]

function reportFor(...args: readonly string[]): HarnessAuditReport {
  const run = runCli(...args, '--json')
  expect(run.status).toBe(0)
  expect(run.stderr).toBe('')
  return JSON.parse(run.stdout) as HarnessAuditReport
}

let report: HarnessAuditReport
let prose: string

beforeAll(() => {
  report = reportFor('harness', '.')
  prose = runCli('harness', '.').stdout
})

describe('1. the shipped CLI audits the harness it ships from', () => {
  it('runs through the production pipeline to a published report', () => {
    const run = runCli('harness', '.')

    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
    expect(run.stdout).not.toBe('')
  })

  it('names the loading convention it read', () => {
    expect(report.tool).toBe('claude')
    expect(report.schemaVersion).toBe(1)
  })

  it('found something to measure', () => {
    // INVARIANT: this repository carries a CLAUDE.md and rules, so an empty report here would be a
    // defect in the reading, not a fact about this checkout worth pinning further than "not nothing".
    expect(report.files.length).toBeGreaterThan(0)
  })
})

describe('2. the report names no maturity level and confines advice to Findings', () => {
  it('names no level word from the maturity scale, in prose or in the contract', () => {
    for (const word of MATURITY_LEVEL_WORDS) {
      expect(prose).not.toContain(word)
    }
    expect(JSON.stringify(report)).not.toMatch(
      new RegExp(`\\b(${MATURITY_LEVEL_WORDS.join('|')})\\b`),
    )
  })

  // INVARIANT: scoped to everything above the Findings section, not deleted. The human who owns
  // this repository deliberately reversed the audit's original "measure only, never judge"
  // constraint — see `harness/contracts/harness-audit-report.contract.ts` — so the Findings
  // section is now expected to grade, threshold and recommend. What must still hold, and is still
  // asserted here: every measurement section printed above it stays free of that vocabulary.
  it('never grades, ranks, warns or recommends above the Findings section, in prose', () => {
    const findingsIndex = prose.indexOf('Findings — measured against named guidelines:')
    expect(findingsIndex).toBeGreaterThan(-1)
    const lowered = prose.slice(0, findingsIndex).toLowerCase()
    for (const word of GRADING_WORDS) {
      expect(lowered).not.toContain(word)
    }
  })

  it('carries no field the assessment contract would call a verdict', () => {
    expect(report).not.toHaveProperty('proven')
    expect(report).not.toHaveProperty('demonstrated')
    expect(report).not.toHaveProperty('blocking')
  })
})

describe('3. prose and the contract carry the same figures', () => {
  it('states the same encoding in both renderings', () => {
    expect(prose).toContain(report.encoding)
  })

  it('states the same list-line reading in both renderings', () => {
    expect(prose).toContain(report.listLineReading)
  })

  it('prints every tier total the contract publishes', () => {
    for (const total of report.tierTotals) {
      expect(prose).toContain(`${total.fileCount} file`)
      expect(prose).toContain(`${total.lineCount} lines`)
      expect(prose).toContain(`~${total.tokenEstimate} tokens`)
    }
  })

  it('prints every measured file the contract lists', () => {
    for (const file of report.files) {
      expect(prose).toContain(file.path)
      expect(prose).toContain(`${file.lineCount} lines`)
    }
  })

  it('names every shared passage the contract lists', () => {
    for (const pair of report.duplication) {
      expect(prose).toContain(pair.left)
      expect(prose).toContain(pair.right)
      for (const passage of pair.passages) {
        expect(prose).toContain(passage.words.join(' '))
      }
    }
  })

  it('names every unread entry and every finding the contract lists', () => {
    for (const unread of report.unread) {
      expect(prose).toContain(unread.path)
      expect(prose).toContain(unread.reason)
    }
    for (const finding of report.findings) {
      expect(prose).toContain(`[${finding.guideline}]`)
      expect(prose).toContain(finding.subject)
      const observed =
        finding.guideline === 'PROSE_SHARE'
          ? `${Math.round(finding.observed * 100)}% prose`
          : `${finding.observed}`
      expect(prose).toContain(observed)
    }
  })
})

describe('4. nothing about this repository is special-cased', () => {
  it('produces byte-identical output on a second run of the same subject', () => {
    expect(runCli('harness', '.').stdout).toBe(runCli('harness', '.').stdout)
    expect(runCli('harness', '.', '--json').stdout).toBe(runCli('harness', '.', '--json').stdout)
  })
})

describe('5. the existing maturity assessment of this repository is unchanged by this work', () => {
  it('still runs assess against this repository, exit 0, with its usual evidence-gap language', () => {
    const run = runCli('assess', '.')

    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
    // LIMITATION: not a level — this repository's `intervention` axis is unobservable on any local
    // history, and the forge is refused by this suite's own PATH, the same result
    // `self-assessment.test.ts` pins. Pinned here only as "harness landing did not change it", never
    // as a fact this suite owns.
    expect(run.stdout).toContain('[écart de preuve]')
  })
})
