import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AssessmentReport } from '../../src/assessment/contracts/assessment-report.contract.js'
import { type CommandIo, runAssess } from '../../src/cli/commands/assess.command.js'

// SAFETY: In process rather than through `dist/cli.js`: `process-contract.test.ts` builds that
// bundle with `clean: true` while vitest runs files in parallel, and reads it alone.
const EXPECTED_LEVEL = {
  perceval: 'Red',
  bohort: 'Blue',
  leodagan: 'Green',
  arthur: 'Copper',
  lancelot: 'Red',
} as const

// INVARIANT: Venec has a recorded session, which confirms prompt use, but no historical delivery
// record. An evidence hole is not a low score: the three unknown axes make every level unproven.
const EXPECTED_UNPROVEN = ['venec'] as const

// INVARIANT: What each bundle demonstrates, which is a second specification and not a restatement of
// the first. `leodagan` is the one that differs, and deliberately: his recorded days carry three
// branches often enough to reach Copper on the axis his median leaves at one. Without him no bundle
// would exercise the demonstrated reading end to end, and the path would ship unproven.
const EXPECTED_DEMONSTRATED = {
  perceval: 'Red',
  bohort: 'Blue',
  leodagan: 'Copper',
  arthur: 'Copper',
} as const

const AXES_IN_THE_MODEL = 4

function capturingIo(): { io: CommandIo; stdout: () => string } {
  const out: string[] = []
  const io: CommandIo = { stdout: (text) => out.push(text), stderr: () => {}, colours: false }
  return { io, stdout: () => out.join('') }
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

  for (const [profile, level] of Object.entries(EXPECTED_DEMONSTRATED)) {
    it(`demonstrates ${level} for ${profile}`, async () => {
      const report = await reportFor(profile)

      // INVARIANT: a bundle with no recorded distribution reports null here, so this also proves
      // the four fixtures still carry one.
      expect(report.demonstrated?.level?.label).toBe(level)
    })
  }

  it('never demonstrates less than it proves, and always says how often', async () => {
    for (const profile of Object.keys(EXPECTED_DEMONSTRATED)) {
      const report = await reportFor(profile)

      expect(report.demonstrated?.level?.rank).toBeGreaterThanOrEqual(report.proven?.rank ?? 0)
      for (const axis of report.demonstrated?.axes ?? []) {
        expect(axis.share).toBeGreaterThan(0)
        expect(axis.share).toBeLessThanOrEqual(1)
      }
    }
  })

  it.each(EXPECTED_UNPROVEN)(
    'does not assign a level to %s when evidence leaves axes unknown',
    async (profile) => {
      const report = await reportFor(profile)

      expect(report.proven).toBeNull()
      expect(report.coverage.axesConfirmed).toBeLessThan(AXES_IN_THE_MODEL)
      expect(report.blocking.map((blocker) => blocker.gap)).toContain('EVIDENCE')
    },
  )

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

describe('the reference profiles assessed as one set', () => {
  it('publishes one document per profile, in name order, unchanged from naming each alone', async () => {
    const { io, stdout } = capturingIo()

    const exitCode = await runAssess(['assess', 'profiles', '--json'], io)

    expect(exitCode).toBe(0)
    const set = JSON.parse(stdout()) as readonly AssessmentReport[]
    const names = [...Object.keys(EXPECTED_LEVEL), ...EXPECTED_UNPROVEN].sort()

    expect(set.map((report) => report.subject.path)).toEqual(
      names.map((name) => `profiles/${name}`),
    )

    for (const [index, name] of names.entries()) {
      expect(set[index]).toEqual(await reportFor(name))
    }
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
