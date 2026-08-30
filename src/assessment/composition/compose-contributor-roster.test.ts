import { describe, expect, it } from 'vitest'
import type {
  ContributorRecord,
  ContributorRosterRun,
} from '../../evidence/ports/contributor-roster.port.js'
import type { Observation, ObservedValue } from '../../evidence/models/observation.model.js'
import { validModel as model } from '../../maturity/engine/maturity-model.test-fixture.js'
import { composeContributorRoster } from './compose-contributor-roster.js'

const COLLECTOR = 'test-roster'

function observation(
  axis: string,
  value: ObservedValue,
  overrides: Partial<Observation> = {},
): Observation {
  return {
    axis,
    reading: 'SUSTAINED',
    value,
    kind: 'OBSERVED',
    collector: COLLECTOR,
    basis: 'fixture',
    demonstration: null,
    ...overrides,
  }
}

function highObservations(): readonly Observation[] {
  return [
    observation('size', 'L'),
    observation('harness', ['prompts', 'context-engineering']),
    observation('parallelism', 3),
  ]
}

function lowObservations(): readonly Observation[] {
  return [
    observation('size', 'S'),
    observation('harness', ['prompts']),
    observation('parallelism', 1),
  ]
}

function recordOf(overrides: Partial<ContributorRecord> = {}): ContributorRecord {
  return {
    account: 'alice',
    emailAddresses: 1,
    commits: 5,
    deliveries: 5,
    activeDays: 5,
    harnessAuthorship: { files: 2, commits: 3 },
    observations: [],
    ...overrides,
  }
}

function completedRun(records: readonly ContributorRecord[]): ContributorRosterRun {
  return {
    status: 'COMPLETED',
    records,
    windowDays: 180,
    harnessObserved: ['prompts', 'context-engineering'],
    harnessPaths: 4,
  }
}

describe('a roster with no run', () => {
  it('composes to null when no run was ever read', () => {
    expect(composeContributorRoster({ model, run: null })).toBeNull()
  })
})

describe('a roster that failed', () => {
  it.each<'FAILED' | 'TIMED_OUT'>(['FAILED', 'TIMED_OUT'])(
    'projects its status and reason with no rows, for %s',
    (status) => {
      const run: ContributorRosterRun = {
        status,
        records: [recordOf()],
        reason: 'the commit walk did not complete',
      }

      expect(composeContributorRoster({ model, run })).toEqual({
        status,
        rows: [],
        reason: 'the commit walk did not complete',
      })
    },
  )
})

describe('each record is resolved alone', () => {
  it('gives three records each the level their own sample proves', () => {
    const records = [
      recordOf({ account: 'alice', observations: highObservations() }),
      recordOf({ account: 'bob', observations: lowObservations() }),
      recordOf({ account: 'carol', observations: [] }),
    ]

    const report = composeContributorRoster({ model, run: completedRun(records) })
    // INVARIANT: the rows exist before anything they hold is asserted — an assertion made over an
    // empty collection would hold vacuously and pin nothing.
    expect(report?.rows).toHaveLength(3)

    const byAccount = new Map(report?.rows.map((row) => [row.account, row]))
    expect(byAccount.get('alice')?.proven?.id).toBe('high')
    expect(byAccount.get('bob')?.proven?.id).toBe('low')
    expect(byAccount.get('carol')?.proven).toBeNull()
  })

  it('reports two conflicting-looking values as two CONFIRMED readings, never CONFLICTING', () => {
    const records = [
      recordOf({
        account: 'dave',
        observations: [
          observation('size', 'S'),
          observation('harness', ['prompts']),
          observation('parallelism', 1),
        ],
      }),
      recordOf({
        account: 'erin',
        observations: [
          observation('size', 'M'),
          observation('harness', ['prompts']),
          observation('parallelism', 1),
        ],
      }),
    ]

    const report = composeContributorRoster({ model, run: completedRun(records) })
    const byAccount = new Map(report?.rows.map((row) => [row.account, row]))

    const sizeRequirement = (account: string) =>
      byAccount
        .get(account)
        ?.proven?.axes.find((axis) => axis.axis === 'size')
        ?.requirements.find((requirement) => requirement.axis === 'size')

    // INVARIANT: neither record's evidence ever meets the other's — each resolves alone, over its
    // own observations only, so 'S' and 'M' never collide into CONFLICTING and each row keeps its
    // own confirmed value.
    expect(sizeRequirement('dave')).toMatchObject({ evidence: 'CONFIRMED', observed: 'S' })
    expect(sizeRequirement('erin')).toMatchObject({ evidence: 'CONFIRMED', observed: 'M' })
  })

  it('reports proven null with a non-empty blocking when a record answers no axis at all', () => {
    const records = [recordOf({ account: 'carol', observations: [] })]
    const report = composeContributorRoster({ model, run: completedRun(records) })
    const row = report?.rows.find((entry) => entry.account === 'carol')

    expect(row?.proven).toBeNull()
    expect(row?.blocking.length).toBeGreaterThan(0)
  })

  it('keeps a null harnessAuthorship null rather than substituting zeros', () => {
    const records = [
      recordOf({ account: 'frank', harnessAuthorship: null, observations: highObservations() }),
    ]
    const report = composeContributorRoster({ model, run: completedRun(records) })
    expect(report?.rows.find((row) => row.account === 'frank')?.harnessAuthorship).toBeNull()
  })

  it('composes proven and demonstrated apart, with the share on the demonstrated axis', () => {
    const demonstratedParallelism: Observation = {
      axis: 'parallelism',
      reading: 'DEMONSTRATED',
      value: 3,
      kind: 'OBSERVED',
      collector: COLLECTOR,
      basis: 'fixture',
      demonstration: { share: 0.42, unit: 'ACTIVE_DAYS' },
    }

    const records = [
      recordOf({
        account: 'gina',
        // INVARIANT: size and harness already sit at the 'high' threshold, so only the demonstrated
        // parallelism reading — 3 rather than the sustained 1 — is what a level the sustained
        // reading does not reach is reached from.
        observations: [
          observation('size', 'L'),
          observation('harness', ['prompts', 'context-engineering']),
          observation('parallelism', 1),
          demonstratedParallelism,
        ],
      }),
    ]

    const report = composeContributorRoster({ model, run: completedRun(records) })
    const row = report?.rows.find((entry) => entry.account === 'gina')

    expect(row?.proven?.id).toBe('low')
    expect(row?.demonstrated?.level?.id).toBe('high')
    expect(row?.demonstrated?.axes).toEqual([
      { axis: 'parallelism', observed: 3, share: 0.42, unit: 'ACTIVE_DAYS' },
    ])
  })
})

describe('ordering', () => {
  it('sorts by deliveries descending, then account ascending, the unattributed bucket last', () => {
    const records = [
      recordOf({ account: 'zack', deliveries: 2, observations: [] }),
      recordOf({ account: null, deliveries: 100, observations: [] }),
      recordOf({ account: 'amy2', deliveries: 5, observations: [] }),
      recordOf({ account: 'amy', deliveries: 5, observations: [] }),
    ]

    const report = composeContributorRoster({ model, run: completedRun(records) })
    expect(report?.rows.map((row) => row.account)).toEqual(['amy', 'amy2', 'zack', null])
  })
})
