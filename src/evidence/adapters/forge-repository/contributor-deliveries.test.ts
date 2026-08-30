import { describe, expect, it } from 'vitest'
import type { AxisVocabulary } from '../../models/axis.model.js'
import { MINIMUM_DELIVERED_CHANGES, MINIMUM_DEMONSTRATED_SAMPLE } from '../delivery-sample.js'
import { readContributorDeliveries } from './contributor-deliveries.js'
import type { MergedPullRequest } from './pull-request-history.js'

// SAFETY: driven entirely on a hand-built, in-window sample — no `gh`, no child process, no fixture
// on disk, and therefore nothing to tear down.

const FULL_VOCABULARY: readonly AxisVocabulary[] = [
  { axis: 'size', kind: 'ordinal', values: ['none', 'S', 'M', 'L', 'XL'] },
  {
    axis: 'intervention',
    kind: 'ordinal',
    values: [
      'not-applicable',
      'after-the-fact-most',
      'after-the-fact-some',
      'key-steps',
      'never-once-framed',
    ],
  },
  { axis: 'parallelism', kind: 'numeric' },
]

const DAY = (day: number): string => `2026-06-${String(day).padStart(2, '0')}T12:00:00Z`

interface DeliveryOverrides {
  readonly account?: string | null
  readonly bot?: boolean
  readonly lines?: number
  readonly files?: number
  readonly commitsAfterOpen?: number
  readonly commitDays?: readonly string[]
}

function delivery(day: number, overrides: DeliveryOverrides = {}): MergedPullRequest {
  const mergedAt = DAY(day)
  return {
    mergedAt,
    createdAt: mergedAt,
    lines: overrides.lines ?? 50,
    files: overrides.files ?? 2,
    commitDays: overrides.commitDays ?? [mergedAt.slice(0, 10)],
    commitsAfterOpen: overrides.commitsAfterOpen ?? 0,
    openedByABot: overrides.bot ?? false,
    openedBy: overrides.account === undefined ? 'alice' : overrides.account,
  }
}

// INVARIANT: twelve deliveries across twelve active days for one account, past both the sample floor
// of five and the demonstrated floor of ten — a small share sized L/XL and the rest S, so a null on
// any of the three axes is this file's own doing and not the sample's.
function twelveDeliveries(account: string): readonly MergedPullRequest[] {
  return Array.from({ length: 12 }, (_, index) =>
    delivery(index + 1, {
      account,
      lines: index < 5 ? 5000 : 50,
      files: index < 5 ? 40 : 2,
    }),
  )
}

function rowFor(rows: ReturnType<typeof readContributorDeliveries>, account: string | null) {
  return rows.find((row) => row.account === account)
}

describe('readContributorDeliveries', () => {
  it('reads three axes, both readings, and a share on each demonstrated one, for an account past every floor', () => {
    const rows = readContributorDeliveries(twelveDeliveries('alice'), FULL_VOCABULARY)

    expect(rows).toHaveLength(1)
    const alice = rowFor(rows, 'alice')
    expect(alice?.metrics).toMatchObject({
      sizeBucket: 'S',
      demonstratedSize: { value: 'XL' },
      intervention: 'key-steps',
      demonstratedIntervention: { value: 'key-steps' },
      parallelism: 1,
      demonstratedParallelism: { value: 1 },
    })
    for (const observation of alice?.observations ?? []) {
      if (observation.reading === 'DEMONSTRATED') {
        expect(observation.demonstration?.share).toBeGreaterThan(0)
      }
    }
  })

  it('carries no axis below the delivery floor, and still states the raw delivery count', () => {
    const below = Array.from({ length: MINIMUM_DELIVERED_CHANGES - 1 }, (_, index) =>
      delivery(index + 1, { account: 'bob' }),
    )

    const rows = readContributorDeliveries(below, FULL_VOCABULARY)

    const bob = rowFor(rows, 'bob')
    expect(bob).toMatchObject({
      deliveryCount: MINIMUM_DELIVERED_CHANGES - 1,
      activeDays: MINIMUM_DELIVERED_CHANGES - 1,
      metrics: {
        sizeBucket: null,
        demonstratedSize: null,
        intervention: null,
        demonstratedIntervention: null,
        parallelism: null,
        demonstratedParallelism: null,
      },
    })
    expect(bob?.observations).toEqual([])
  })

  it('carries the sustained reading below the demonstrated floor, and no demonstrated reading anywhere', () => {
    const below = Array.from({ length: MINIMUM_DEMONSTRATED_SAMPLE - 1 }, (_, index) =>
      delivery(index + 1, { account: 'carole' }),
    )

    const rows = readContributorDeliveries(below, FULL_VOCABULARY)

    const carole = rowFor(rows, 'carole')
    expect(carole?.metrics.sizeBucket).not.toBeNull()
    expect(carole?.metrics.intervention).not.toBeNull()
    expect(carole?.metrics.parallelism).not.toBeNull()
    expect(carole?.metrics.demonstratedSize).toBeNull()
    expect(carole?.metrics.demonstratedIntervention).toBeNull()
    expect(carole?.metrics.demonstratedParallelism).toBeNull()
    expect(
      carole?.observations.filter((observation) => observation.reading === 'DEMONSTRATED'),
    ).toEqual([])
  })

  it("keeps each account's own parallelism its own, never the other's, on the same shared days", () => {
    const sharedDays = [1, 2, 3, 4, 5]
    const deliveries = sharedDays.flatMap((day) => [
      delivery(day, { account: 'dave' }),
      delivery(day, { account: 'erin' }),
    ])

    const rows = readContributorDeliveries(deliveries, FULL_VOCABULARY)

    expect(rowFor(rows, 'dave')?.metrics.parallelism).toBe(1)
    expect(rowFor(rows, 'erin')?.metrics.parallelism).toBe(1)
  })

  it("drops a bot's deliveries entirely, and never moves another account's median", () => {
    const withoutBot = twelveDeliveries('frank')
    const withBot = [
      ...withoutBot,
      delivery(1, { account: 'a-bot[bot]', bot: true, lines: 900_000, files: 900 }),
    ]

    const rows = readContributorDeliveries(withBot, FULL_VOCABULARY)

    expect(rows).toHaveLength(1)
    expect(rowFor(rows, 'a-bot[bot]')).toBeUndefined()
    expect(rowFor(rows, 'frank')?.metrics.sizeBucket).toBe(
      rowFor(readContributorDeliveries(withoutBot, FULL_VOCABULARY), 'frank')?.metrics.sizeBucket,
    )
  })

  it('counts a delivery with no named author in the unattributed row, rather than dropping it', () => {
    const deliveries = [delivery(1, { account: null }), delivery(2, { account: null })]

    const rows = readContributorDeliveries(deliveries, FULL_VOCABULARY)

    const unattributed = rowFor(rows, null)
    expect(unattributed).toBeDefined()
    expect(unattributed?.deliveryCount).toBe(2)
  })
})
