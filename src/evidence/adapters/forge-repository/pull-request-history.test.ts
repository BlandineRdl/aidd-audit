import { chmod, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  deriveForgeMetrics,
  type ForgeDerivedMetrics,
  readDeliveredChanges,
} from './pull-request-history.js'

// SAFETY: Integration against a stub `gh` on PATH, so the forge is the boundary under test and the
// suite never reaches it. The payloads are shaped like the GraphQL answer and copied from no real
// repository: a fixture carrying one would put a private repository's pull requests in this tree,
// and would drift the day the schema does without anything saying so.

const NEVER_ABORTED = new AbortController().signal
const A_LONG_TIME = 15_000
const SLUG = { owner: 'an-owner', name: 'a-repository' }

const workspaces: string[] = []
let restorePath: string | undefined

afterEach(async () => {
  if (restorePath !== undefined) process.env.PATH = restorePath
  restorePath = undefined
  await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

interface RecordedPullRequest {
  readonly createdAt: string
  readonly mergedAt: string
  readonly additions: number
  readonly deletions: number
  readonly changedFiles: number
  readonly commitDates: readonly string[]
  readonly authorType?: 'User' | 'Bot' | null
  readonly authorLogin?: string
}

function page(nodes: readonly RecordedPullRequest[], endCursor: string | null): string {
  return JSON.stringify({
    data: {
      repository: {
        pullRequests: {
          pageInfo: { hasNextPage: endCursor !== null, endCursor },
          nodes: nodes.map((node) => ({
            createdAt: node.createdAt,
            mergedAt: node.mergedAt,
            additions: node.additions,
            deletions: node.deletions,
            changedFiles: node.changedFiles,
            author:
              node.authorType === null
                ? null
                : { __typename: node.authorType ?? 'User', login: node.authorLogin ?? 'someone' },
            commits: {
              nodes: node.commitDates.map((committedDate) => ({ commit: { committedDate } })),
            },
          })),
        },
      },
    },
  })
}

// INVARIANT: A `gh` that answers the nth invocation with the nth payload, and records each argument
// list in its own file. Invocations are counted by bytes in a tally file and never by lines in a
// shared log: the query itself spans eighteen lines, so a line count reads one call as eighteen.
async function ghAnswering(
  payloads: readonly string[],
): Promise<{ calls: () => Promise<string[]> }> {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'aidd-gh-stub-'))
  workspaces.push(directory)

  const tally = join(directory, 'tally')
  for (const [index, payload] of payloads.entries()) {
    await writeFile(join(directory, `payload-${index}`), payload)
  }

  const script = [
    '#!/bin/sh',
    `printf 'x' >> "${tally}"`,
    `n=$(wc -c < "${tally}" | tr -d " ")`,
    `printf '%s' "$*" > "${directory}/call-$n"`,
    `file="${directory}/payload-$((n - 1))"`,
    'if [ -f "$file" ]; then cat "$file"; else echo "no payload" >&2; exit 1; fi',
    '',
  ].join('\n')

  await writeFile(join(directory, 'gh'), script)
  await chmod(join(directory, 'gh'), 0o755)

  restorePath = process.env.PATH
  process.env.PATH = `${directory}:${process.env.PATH ?? ''}`

  return {
    async calls(): Promise<string[]> {
      const recorded: string[] = []
      for (let call = 1; ; call += 1) {
        try {
          recorded.push(await readFile(join(directory, `call-${call}`), 'utf8'))
        } catch {
          return recorded
        }
      }
    },
  }
}

function delivered(
  mergedAt: string,
  lines: number,
  files: number,
  commitDates: readonly string[] = [mergedAt],
): RecordedPullRequest {
  return {
    createdAt: mergedAt,
    mergedAt,
    additions: lines,
    deletions: 0,
    changedFiles: files,
    commitDates,
  }
}

const DAY = (day: number): string => `2026-06-${String(day).padStart(2, '0')}T12:00:00Z`

// INVARIANT: the composition the collector performs, spelled out here rather than exported from
// the module. A wrapper existed for it and lost its last production caller when the delivery reader
// took over; keeping an export nothing ships would have left the suite proving a path `dist/cli.js`
// never runs.
async function derivedFrom(
  slug: Parameters<typeof readDeliveredChanges>[0],
  subjectActivityEnd: Parameters<typeof readDeliveredChanges>[1],
  signal: Parameters<typeof readDeliveredChanges>[2],
): Promise<ForgeDerivedMetrics> {
  return deriveForgeMetrics(await readDeliveredChanges(slug, subjectActivityEnd, signal))
}

describe('the walk and the derivation it feeds', () => {
  it(
    'reads a median size over every merged pull request in the window',
    async () => {
      await ghAnswering([
        page(
          [1, 2, 3, 4, 5].map((day) => delivered(DAY(day), 500, 12)),
          null,
        ),
      ])

      await expect(derivedFrom(SLUG, null, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'L',
      })
    },
    A_LONG_TIME,
  )

  it(
    'follows the cursor rather than reading the first page alone',
    async () => {
      const stub = await ghAnswering([
        page(
          [1, 2, 3].map((day) => delivered(DAY(day), 50, 2)),
          'CURSOR',
        ),
        page(
          [4, 5, 6].map((day) => delivered(DAY(day), 50, 2)),
          null,
        ),
      ])

      // INVARIANT: six deliveries clear the sample floor, three do not. A collector that stopped at
      // page one would report nothing here, which is exactly how a cursor bug hides.
      await expect(derivedFrom(SLUG, null, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'S',
      })
      const calls = await stub.calls()
      expect(calls).toHaveLength(2)
      expect(calls[1]).toContain('after=CURSOR')
    },
    A_LONG_TIME,
  )

  it(
    'reports nothing at all from a window holding fewer deliveries than the floor',
    async () => {
      await ghAnswering([
        page(
          [1, 2, 3, 4].map((day) => delivered(DAY(day), 500, 12)),
          null,
        ),
      ])

      await expect(derivedFrom(SLUG, null, NEVER_ABORTED)).resolves.toEqual({
        sizeBucket: null,
        demonstratedSize: null,
        intervention: null,
        demonstratedIntervention: null,
        parallelism: null,
        demonstratedParallelism: null,
        activeDays: 4,
      })
    },
    A_LONG_TIME,
  )

  it(
    'leaves a delivery merged before the window out of every median',
    async () => {
      await ghAnswering([
        page(
          [
            ...[1, 2, 3, 4, 5].map((day) => delivered(DAY(day), 50, 2)),
            delivered('2024-01-01T12:00:00Z', 40_000, 900),
          ],
          null,
        ),
      ])

      // The ancient delivery would carry the median to XL if the window were not applied.
      await expect(derivedFrom(SLUG, null, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'S',
      })
    },
    A_LONG_TIME,
  )

  it(
    'ends the window at the subject last commit, not at its own last merge',
    async () => {
      const payload = page(
        [
          ...[1, 2, 3, 4, 5].map((day) => delivered(DAY(day), 50, 2)),
          // Six enormous deliveries four months earlier: a majority, so they carry the median.
          ...[1, 2, 3, 4, 5, 6].map((day) => delivered(`2026-02-0${day}T12:00:00Z`, 40_000, 900)),
        ],
        null,
      )
      await ghAnswering([payload, payload])

      // INVARIANT: with no subject activity to go on, the window ends at the newest merge, June 5,
      // and reaches back past February — the six old deliveries count and own the median.
      await expect(derivedFrom(SLUG, null, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'XL',
      })

      // INVARIANT: told the subject was still committing in late November, the same 180 days end
      // there and start in late May, so only the recent five remain. A stretch of direct commits
      // after the last merge must not drag the window backwards and change the level.
      await expect(
        derivedFrom(SLUG, Date.parse('2026-11-20T12:00:00Z'), NEVER_ABORTED),
      ).resolves.toMatchObject({ sizeBucket: 'S' })
    },
    A_LONG_TIME,
  )

  it(
    'leaves out a pull request merged after the subject stopped committing',
    async () => {
      await ghAnswering([
        page(
          [
            ...[1, 2, 3, 4, 5].map((day) => delivered(DAY(day), 50, 2)),
            delivered('2026-06-28T12:00:00Z', 40_000, 900),
          ],
          null,
        ),
      ])

      // INVARIANT: merged into another branch after the subject's last commit, so it sits outside
      // the period rather than being the newest thing in it.
      await expect(
        derivedFrom(SLUG, Date.parse('2026-06-10T12:00:00Z'), NEVER_ABORTED),
      ).resolves.toMatchObject({ sizeBucket: 'S' })
    },
    A_LONG_TIME,
  )

  it(
    'leaves a delivery a bot opened out of every median',
    async () => {
      const payload = page(
        [
          ...[1, 2, 3, 4, 5].map((day) => delivered(DAY(day), 900, 20)),
          // Six tiny dependency bumps: a majority, so they own the median if they are counted.
          ...[6, 7, 8, 9, 10, 11].map((day) => ({
            ...delivered(DAY(day), 4, 1),
            authorType: 'Bot' as const,
            authorLogin: 'dependabot',
          })),
        ],
        null,
      )
      await ghAnswering([payload, payload])

      // INVARIANT: the axis measures features delivered with an agent, and a scheduled bump is
      // neither. Counting them here would report S where the subject's own work is L.
      await expect(derivedFrom(SLUG, null, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'L',
      })

      // INVARIANT: a bot-opened delivery is dropped whatever login it carries — the exclusion is
      // keyed on the forge's typing of the author, never on the login's suffix.
      const deliveries = await readDeliveredChanges(SLUG, null, NEVER_ABORTED)
      expect(deliveries?.some((delivery) => delivery.openedBy === 'dependabot')).toBe(false)
    },
    A_LONG_TIME,
  )

  it(
    'keeps a delivery whose author the forge could not type',
    async () => {
      const payload = page(
        [1, 2, 3, 4, 5].map((day) => ({
          ...delivered(DAY(day), 900, 20),
          authorType: null,
        })),
        null,
      )
      await ghAnswering([payload, payload])

      // INVARIANT: a deleted account leaves no author at all. Absence of proof that it is a bot is
      // not proof that it is one, and dropping a person's work is the worse mistake.
      await expect(derivedFrom(SLUG, null, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'L',
      })

      // INVARIANT: nobody GitHub can name reads as `null`, not as a dropped delivery.
      const deliveries = await readDeliveredChanges(SLUG, null, NEVER_ABORTED)
      expect(deliveries?.every((delivery) => delivery.openedBy === null)).toBe(true)
    },
    A_LONG_TIME,
  )

  it(
    'carries the account that opened each delivery',
    async () => {
      await ghAnswering([
        page(
          [
            { ...delivered(DAY(1), 50, 2), authorLogin: 'perceval' },
            { ...delivered(DAY(2), 50, 2), authorLogin: 'karadoc' },
          ],
          null,
        ),
      ])

      const deliveries = await readDeliveredChanges(SLUG, null, NEVER_ABORTED)
      expect(deliveries?.map((delivery) => delivery.openedBy)).toEqual(['perceval', 'karadoc'])
    },
    A_LONG_TIME,
  )

  it(
    'asks the forge for the login behind each delivery',
    async () => {
      const stub = await ghAnswering([page([delivered(DAY(1), 50, 2)], null)])

      await readDeliveredChanges(SLUG, null, NEVER_ABORTED)

      const calls = await stub.calls()
      expect(calls[0]).toContain('login')
    },
    A_LONG_TIME,
  )

  it(
    'derives the same metrics through the split as through the composition',
    async () => {
      const payload = page(
        [1, 2, 3, 4, 5].map((day) => delivered(DAY(day), 500, 12)),
        null,
      )
      await ghAnswering([payload, payload])

      const split = deriveForgeMetrics(await readDeliveredChanges(SLUG, null, NEVER_ABORTED))
      const composed = await derivedFrom(SLUG, null, NEVER_ABORTED)

      expect(split).toEqual(composed)
    },
    A_LONG_TIME,
  )

  it(
    'answers an empty array, not null, for a walk that completed over an empty window',
    async () => {
      await ghAnswering([page([delivered('2024-01-01T12:00:00Z', 40_000, 900)], null)])

      // INVARIANT: the one delivery on this page is real, and sits outside the window given by
      // `subjectActivityEnd` — a completed walk that found nothing, not a walk that failed.
      await expect(
        readDeliveredChanges(SLUG, Date.parse('2026-06-10T12:00:00Z'), NEVER_ABORTED),
      ).resolves.toEqual([])
    },
    A_LONG_TIME,
  )

  it(
    'answers null rather than an empty walk when the forge answers something it cannot read',
    async () => {
      await ghAnswering(['{"data":{"repository":null},"errors":[{"type":"NOT_FOUND"}]}'])

      await expect(readDeliveredChanges(SLUG, null, NEVER_ABORTED)).resolves.toBeNull()
    },
    A_LONG_TIME,
  )

  it(
    'places intervention from the median of the commits that followed the opening',
    async () => {
      await ghAnswering([
        page(
          [1, 2, 3, 4, 5].map((day) => ({
            ...delivered(DAY(day), 50, 2),
            createdAt: DAY(day),
            commitDates: [DAY(day), DAY(day + 10), DAY(day + 11)],
          })),
          null,
        ),
      ])

      // Two commits after opening on every delivery: past `after-the-fact-some`, short of `most`.
      await expect(derivedFrom(SLUG, null, NEVER_ABORTED)).resolves.toMatchObject({
        intervention: 'after-the-fact-some',
      })
    },
    A_LONG_TIME,
  )

  it(
    'never grants autonomy, however many deliveries took no commit after opening',
    async () => {
      await ghAnswering([
        page(
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((day) => delivered(DAY(day), 50, 2)),
          null,
        ),
      ])

      // INVARIANT: every one of these ten is zero-touch, which is what pushing a branch and then
      // opening the pull request looks like — a workflow habit, present in repositories with no
      // agent at all. Granting `never-once-framed` from it would hand the scale's top observable
      // rank to an absence. This source reads no authorship, so it answers the corrective ranks
      // only, and `key-steps` is the highest it can reach.
      await expect(derivedFrom(SLUG, null, NEVER_ABORTED)).resolves.toMatchObject({
        intervention: 'key-steps',
      })
    },
    A_LONG_TIME,
  )

  it(
    'demonstrates the rank a third of deliveries reached, where the median names a lower one',
    async () => {
      await ghAnswering([
        page(
          [
            // INVARIANT: seven reworked heavily, five clean — the median lands on the reworked
            // side while more than a third of the sample needed at most one correction.
            ...[1, 2, 3, 4, 5, 6, 7].map((day) => ({
              ...delivered(DAY(day), 50, 2),
              commitDates: [DAY(day), DAY(day + 10), DAY(day + 11), DAY(day + 12)],
            })),
            ...[8, 9, 10, 11, 12].map((day) => delivered(DAY(day), 50, 2)),
          ],
          null,
        ),
      ])

      // INVARIANT: this is the whole reason the axis gained a second reading. A bimodal history —
      // often clean, sometimes reworked hard — is described by neither number alone, and the median
      // reports only the half it lands in.
      await expect(derivedFrom(SLUG, null, NEVER_ABORTED)).resolves.toMatchObject({
        intervention: 'after-the-fact-most',
        demonstratedIntervention: { value: 'key-steps' },
      })
    },
    A_LONG_TIME,
  )

  it(
    'counts distinct pull requests touched on a day, not the busiest day',
    async () => {
      await ghAnswering([
        page(
          [
            delivered(DAY(20), 50, 2, [DAY(1), DAY(2), DAY(3), DAY(4), DAY(5)]),
            delivered(DAY(21), 50, 2, [DAY(1), DAY(2), DAY(3), DAY(4), DAY(5)]),
            delivered(DAY(22), 50, 2, [DAY(1)]),
            delivered(DAY(23), 50, 2, [DAY(1)]),
            delivered(DAY(24), 50, 2, [DAY(1)]),
          ],
          null,
        ),
      ])

      // Five requests touched on day 1, two on days 2 to 5: the median of the five active days is 2.
      await expect(derivedFrom(SLUG, null, NEVER_ABORTED)).resolves.toMatchObject({
        parallelism: 2,
      })
    },
    A_LONG_TIME,
  )

  it(
    'reports nothing at all when the forge refuses',
    async () => {
      await ghAnswering([])

      await expect(derivedFrom(SLUG, null, NEVER_ABORTED)).rejects.toThrow(/gh api graphql/)
    },
    A_LONG_TIME,
  )

  it(
    'reports nothing at all when the forge answers something it cannot read',
    async () => {
      await ghAnswering(['{"data":{"repository":null},"errors":[{"type":"NOT_FOUND"}]}'])

      await expect(derivedFrom(SLUG, null, NEVER_ABORTED)).resolves.toEqual({
        sizeBucket: null,
        demonstratedSize: null,
        intervention: null,
        demonstratedIntervention: null,
        parallelism: null,
        demonstratedParallelism: null,
        activeDays: null,
      })
    },
    A_LONG_TIME,
  )

  it(
    'rejects rather than resolving when the signal is already aborted',
    async () => {
      await ghAnswering([page([], null)])

      await expect(derivedFrom(SLUG, null, AbortSignal.abort())).rejects.toThrow(/abort/i)
    },
    A_LONG_TIME,
  )
})

describe('deriveForgeMetrics', () => {
  // INVARIANT: every derived value, and there is one more than the name says since `activeDays`
  // joined them — asserted whole with `toEqual` so a field added to `ForgeDerivedMetrics` and left
  // unset by the unrecoverable path fails here rather than reaching a report as `undefined`.
  const NOTHING_DERIVED = {
    sizeBucket: null,
    demonstratedSize: null,
    intervention: null,
    demonstratedIntervention: null,
    parallelism: null,
    demonstratedParallelism: null,
    activeDays: null,
  }

  it('derives nothing at all for a walk that could not complete', () => {
    expect(deriveForgeMetrics(null)).toEqual(NOTHING_DERIVED)
  })

  // INVARIANT: an empty window counted zero active days; an unreadable walk counted none. The two
  // are the `[]`-versus-`null` distinction this module draws on purpose, and collapsing them onto
  // one expectation is what hid `activeDays` when it was added.
  it('derives nothing at all for a window with too few deliveries to clear the floor', () => {
    expect(deriveForgeMetrics([])).toEqual({ ...NOTHING_DERIVED, activeDays: 0 })
  })
})
