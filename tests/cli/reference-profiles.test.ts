import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AssessmentReport } from '../../src/assessment/contracts/assessment-report.contract.js'
import { type CommandIo, runAssess } from '../../src/cli/commands/assess.command.js'

/** In process rather than through `dist/cli.js`: `process-contract.test.ts` builds that bundle
 *  with `clean: true` while vitest runs files in parallel, and reads it alone. */
const EXPECTED_LEVEL = {
  perceval: 'Red',
  bohort: 'Blue',
  leodagan: 'Green',
  arthur: 'Copper',
} as const

const AXES_IN_THE_MODEL = 4

function capturingIo(): { io: CommandIo; stdout: () => string } {
  const out: string[] = []
  return { io: { stdout: (text) => out.push(text), stderr: () => {} }, stdout: () => out.join('') }
}

async function reportFor(profile: string): Promise<AssessmentReport> {
  const { io, stdout } = capturingIo()
  const exitCode = await runAssess(['assess', `profiles/${profile}`, '--json'], io)

  expect(exitCode).toBe(0)
  return JSON.parse(stdout()) as AssessmentReport
}

describe('every reference profile reaches the level its bundle proves', () => {
  for (const [profile, level] of Object.entries(EXPECTED_LEVEL)) {
    it(`reports ${level} for ${profile}`, async () => {
      const report = await reportFor(profile)

      expect(report.proven?.label).toBe(level)
    })
  }

  it.each(Object.keys(EXPECTED_LEVEL))('confirms every axis from %s alone', async (profile) => {
    const report = await reportFor(profile)

    // Only a confirmed axis can satisfy a requirement, and every level declares all four.
    expect(report.coverage.axesConfirmed).toBe(AXES_IN_THE_MODEL)
    expect(report.provenance.map((entry) => entry.collector)).toContain('fixture-bundle')
  })

  it('explains the same level in prose as it publishes in the contract', async () => {
    const { io, stdout } = capturingIo()

    const exitCode = await runAssess(['assess', 'profiles/arthur'], io)

    expect(exitCode).toBe(0)
    expect(stdout()).toContain(EXPECTED_LEVEL.arthur)
  })
})

describe('the production graph holds no knowledge of any profile', () => {
  const FORBIDDEN = [...Object.keys(EXPECTED_LEVEL), 'profiles/']

  function sourceFiles(directory: string): readonly string[] {
    return readdirSync(directory).flatMap((entry) => {
      const path = join(directory, entry)
      if (statSync(path).isDirectory()) return sourceFiles(path)
      return path.endsWith('.ts') && !path.includes('.test') ? [path] : []
    })
  }

  it.each(FORBIDDEN)('names %s nowhere under src/', (term) => {
    const offenders = sourceFiles('src').filter((path) => readFileSync(path, 'utf8').includes(term))

    expect(offenders).toEqual([])
  })
})
