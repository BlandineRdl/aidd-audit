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

describe('a row publishes what it observed, whether or not it reached a level', () => {
  it('publishes every axis of a row that reached no level, with the status each was resolved to', () => {
    // SAFETY: the fixture model declares three axes and this record answers one, so no level can be
    // proven — every level requires all three. That is the case the field exists for: before it,
    // such a row published its blockers and never the value it had actually established.
    const run = completedRun([recordOf({ observations: [observation('size', 'L')] })])

    const roster = composeContributorRoster({ model, run })
    if (roster === null || roster.status !== 'COMPLETED') throw new Error('unreachable')

    const [row] = roster.rows
    if (row === undefined) throw new Error('the row must exist before its contents are asserted')

    expect(row.proven).toBeNull()
    expect(row.observed).toEqual([
      { axis: 'size', value: 'L', evidence: 'CONFIRMED' },
      { axis: 'harness', value: null, evidence: 'UNKNOWN' },
      { axis: 'parallelism', value: null, evidence: 'UNKNOWN' },
    ])
  })

  it('publishes the same list for a row that did reach a level', () => {
    const run = completedRun([recordOf({ observations: highObservations() })])

    const roster = composeContributorRoster({ model, run })
    if (roster === null || roster.status !== 'COMPLETED') throw new Error('unreachable')

    const [row] = roster.rows
    if (row === undefined) throw new Error('the row must exist before its contents are asserted')

    expect(row.proven?.id).toBe('high')
    expect(row.observed).toEqual([
      { axis: 'size', value: 'L', evidence: 'CONFIRMED' },
      { axis: 'harness', value: ['prompts', 'context-engineering'], evidence: 'CONFIRMED' },
      { axis: 'parallelism', value: 3, evidence: 'CONFIRMED' },
    ])
  })

  it('carries the sustained reading alone, never the demonstrated one', () => {
    // INVARIANT: a demonstrated value is a different question with its own share, and letting it
    // into this list would publish a maximum wearing a habit's clothes.
    const run = completedRun([
      recordOf({
        observations: [
          observation('size', 'S'),
          observation('size', 'L', {
            reading: 'DEMONSTRATED',
            demonstration: { share: 0.5, unit: 'DELIVERIES' },
          }),
        ],
      }),
    ])

    const roster = composeContributorRoster({ model, run })
    if (roster === null || roster.status !== 'COMPLETED') throw new Error('unreachable')

    const [row] = roster.rows
    if (row === undefined) throw new Error('the row must exist before its contents are asserted')

    expect(row.observed.filter((entry) => entry.axis === 'size')).toEqual([
      { axis: 'size', value: 'S', evidence: 'CONFIRMED' },
    ])
  })
})

describe('a row names the level it is next in line for', () => {
  it('derives that level from the row own evidence, not from the repository', () => {
    const run = completedRun([recordOf({ observations: lowObservations() })])

    const roster = composeContributorRoster({ model, run })
    if (roster === null || roster.status !== 'COMPLETED') throw new Error('unreachable')

    const [row] = roster.rows
    if (row === undefined) throw new Error('the row must exist before its contents are asserted')

    expect(row.proven?.id).toBe('low')
    expect(row.next?.id).toBe('high')

    // INVARIANT: the row's next level pairs each threshold with what this row observed. Read from
    // the repository's own level report instead, the same axis would carry the repository's value
    // and the row would state a gap it does not have.
    const size = row.next?.axes.find((axis) => axis.axis === 'size')
    expect(size?.requirements.at(0)?.observed).toBe('S')
  })

  it('carries a next level even for a row that proved none, and it is the floor', () => {
    const run = completedRun([recordOf({ observations: [observation('size', 'L')] })])

    const roster = composeContributorRoster({ model, run })
    if (roster === null || roster.status !== 'COMPLETED') throw new Error('unreachable')

    const [row] = roster.rows
    if (row === undefined) throw new Error('the row must exist before its contents are asserted')

    expect(row.proven).toBeNull()
    expect(row.next?.id).toBe('low')
    expect(row.blocking.length).toBeGreaterThan(0)
  })
})

describe('the block-level values travel from the run and are never re-derived', () => {
  it('carries the window, the shared harness value and the harness-set size the run stated', () => {
    // SAFETY: deliberately none of the defaults. `windowDays: 180`, an empty harness set and a
    // count of zero are exactly what a hardcoded composition would emit, so a test built on them
    // stays green with the carry replaced by literals — which is what R7 exists to prevent, since
    // a renderer may not reach into `delivery-sample.ts` for the window nor re-derive the shared
    // axis for itself.
    const run: ContributorRosterRun = {
      status: 'COMPLETED',
      records: [recordOf({ observations: lowObservations() })],
      windowDays: 90,
      harnessObserved: ['prompts', 'behavior'],
      harnessPaths: 7,
    }

    const roster = composeContributorRoster({ model, run })
    if (roster === null || roster.status !== 'COMPLETED') throw new Error('unreachable')

    expect(roster.rows).toHaveLength(1)
    expect(roster.windowDays).toBe(90)
    expect(roster.harnessObserved).toEqual(['prompts', 'behavior'])
    expect(roster.harnessPaths).toBe(7)
  })

  it('carries a withheld harness value as the null the run stated, never as an empty set', () => {
    const run: ContributorRosterRun = {
      status: 'COMPLETED',
      records: [recordOf({ observations: lowObservations() })],
      windowDays: 90,
      harnessObserved: null,
      harnessPaths: 7,
    }

    const roster = composeContributorRoster({ model, run })
    if (roster === null || roster.status !== 'COMPLETED') throw new Error('unreachable')

    expect(roster.harnessObserved).toBeNull()
  })
})
