import { chmod, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AxisVocabulary } from '../models/axis.model.js'
import type { Observation } from '../models/observation.model.js'
import { ForgeRepositoryEvidenceCollector } from './forge-repository.adapter.js'

// SAFETY: Integration against a stub `gh` on PATH: the forge is the boundary and the suite never
// reaches it. What is under test here is the collector's own decisions — which reading it tags, what
// it drops, when it stays silent — not the query, which `forge-repository/pull-request-history.test.ts`
// owns.

const NEVER_ABORTED = new AbortController().signal
const A_LONG_TIME = 60_000
const SLUG = { owner: 'an-owner', name: 'a-repository' }

const FULL_VOCABULARY: readonly AxisVocabulary[] = [
  { axis: 'size', kind: 'ordinal', values: ['none', 'S', 'M', 'L', 'XL'] },
  { axis: 'harness', kind: 'set', members: ['prompts', 'context-engineering'] },
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

const workspaces: string[] = []
let restorePath: string | undefined

afterEach(async () => {
  if (restorePath !== undefined) process.env.PATH = restorePath
  restorePath = undefined
  await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

interface RecordedPullRequest {
  readonly mergedAt: string
  readonly lines: number
  readonly files: number
  readonly commitDays: readonly string[]
}

const DAY = (day: number): string => `2026-06-${String(day).padStart(2, '0')}T12:00:00Z`

function payload(nodes: readonly RecordedPullRequest[]): string {
  return JSON.stringify({
    data: {
      repository: {
        pullRequests: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: nodes.map((node) => ({
            createdAt: node.mergedAt,
            mergedAt: node.mergedAt,
            additions: node.lines,
            deletions: 0,
            changedFiles: node.files,
            author: { __typename: 'User' },
            commits: {
              nodes: node.commitDays.map((day) => ({ commit: { committedDate: day } })),
            },
          })),
        },
      },
    },
  })
}

async function ghAnswering(stdout: string): Promise<void> {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'aidd-forge-adapter-'))
  workspaces.push(directory)
  const answer = join(directory, 'answer.json')
  await writeFile(answer, stdout)
  await writeFile(join(directory, 'gh'), `#!/bin/sh\ncat "${answer}"\n`)
  await chmod(join(directory, 'gh'), 0o755)

  restorePath = process.env.PATH
  process.env.PATH = `${directory}:${process.env.PATH ?? ''}`
}

async function ghRefusing(): Promise<void> {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'aidd-forge-adapter-'))
  workspaces.push(directory)
  await writeFile(join(directory, 'gh'), '#!/bin/sh\necho "gh: nope" >&2\nexit 1\n')
  await chmod(join(directory, 'gh'), 0o755)

  restorePath = process.env.PATH
  process.env.PATH = `${directory}:${process.env.PATH ?? ''}`
}

// INVARIANT: twelve deliveries across twelve active days, past both the sample floor of five and the
// demonstrated floor of ten, so a null from either reading is the adapter's doing and not the sample's.
const TWELVE_DELIVERIES: readonly RecordedPullRequest[] = Array.from(
  { length: 12 },
  (_, index) => ({
    mergedAt: DAY(index + 1),
    lines: index < 5 ? 5000 : 50,
    files: index < 5 ? 40 : 2,
    commitDays: [DAY(index + 1)],
  }),
)

function collectFrom(
  vocabulary: readonly AxisVocabulary[] = FULL_VOCABULARY,
  signal: AbortSignal = NEVER_ABORTED,
): Promise<readonly Observation[]> {
  return new ForgeRepositoryEvidenceCollector(SLUG).collect({ path: '.', vocabulary, signal })
}

const on = (observations: readonly Observation[], axis: string, reading: string) =>
  observations.find((observation) => observation.axis === axis && observation.reading === reading)

describe('the forge evidence collector', () => {
  it(
    'tags what the subject sustains apart from what it demonstrated, on the same axis',
    async () => {
      await ghAnswering(payload(TWELVE_DELIVERIES))

      const observations = await collectFrom()

      // INVARIANT: two readings of one axis are two questions, never two opinions. Emitted as two
      // values of one axis they would resolve to CONFLICTING and cost the axis entirely.
      expect(on(observations, 'size', 'SUSTAINED')).toMatchObject({
        value: 'S',
        demonstration: null,
      })
      expect(on(observations, 'size', 'DEMONSTRATED')).toMatchObject({
        value: 'XL',
        demonstration: { unit: 'DELIVERIES' },
      })
    },
    A_LONG_TIME,
  )

  it(
    'never carries a demonstrated value without the share that earned it',
    async () => {
      await ghAnswering(payload(TWELVE_DELIVERIES))

      const demonstrated = (await collectFrom()).filter(
        (observation) => observation.reading === 'DEMONSTRATED',
      )

      expect(demonstrated.length).toBeGreaterThan(0)
      for (const observation of demonstrated) {
        expect(observation.demonstration?.share).toBeGreaterThan(0)
        expect(observation.demonstration?.share).toBeLessThanOrEqual(1)
      }
    },
    A_LONG_TIME,
  )

  it(
    'answers no reading at all on the intervention axis beyond the habitual one',
    async () => {
      await ghAnswering(payload(TWELVE_DELIVERIES))

      const observations = await collectFrom()

      // INVARIANT: by decision, not by omission. The forge sees when a pull request was opened,
      // which on a subject with no review records a workflow habit rather than whether a human took
      // over from the agent, so no rank is granted from it upward.
      expect(on(observations, 'intervention', 'SUSTAINED')).toBeDefined()
      expect(on(observations, 'intervention', 'DEMONSTRATED')).toBeUndefined()
    },
    A_LONG_TIME,
  )

  it(
    'never answers the harness axis, which is a property of the tracked tree',
    async () => {
      await ghAnswering(payload(TWELVE_DELIVERIES))

      const collector = new ForgeRepositoryEvidenceCollector(SLUG)
      const observations = await collector.collect({
        path: '.',
        vocabulary: FULL_VOCABULARY,
        signal: NEVER_ABORTED,
      })

      expect(collector.supportedAxes).not.toContain('harness')
      expect(observations.map((observation) => observation.axis)).not.toContain('harness')
    },
    A_LONG_TIME,
  )

  it(
    'drops a value the loaded model has no name for rather than inventing one',
    async () => {
      await ghAnswering(payload(TWELVE_DELIVERIES))

      // INVARIANT: the demonstrated size here is XL, which this model's scale stops short of. A
      // collector ranks on the loaded model's own scale or stays silent.
      const narrow = FULL_VOCABULARY.map((scale) =>
        scale.axis === 'size'
          ? ({ axis: 'size', kind: 'ordinal', values: ['none', 'S', 'M', 'L'] } as const)
          : scale,
      )

      const observations = await collectFrom(narrow)

      expect(on(observations, 'size', 'SUSTAINED')).toBeDefined()
      expect(on(observations, 'size', 'DEMONSTRATED')).toBeUndefined()
    },
    A_LONG_TIME,
  )

  it(
    'stays silent, and spawns nothing, when the model declares none of its axes',
    async () => {
      await ghRefusing()

      // A refusing `gh` would reject if it were reached; resolving proves it was not.
      await expect(
        collectFrom([{ axis: 'harness', kind: 'set', members: ['prompts'] }]),
      ).resolves.toEqual([])
    },
    A_LONG_TIME,
  )

  it(
    'lets a refusing forge surface as a failure rather than as an absence',
    async () => {
      await ghRefusing()

      // INVARIANT: the use case turns this rejection into FAILED provenance. Returning `[]` here
      // would publish the refusal as an evidence gap on a run still reported COMPLETED.
      await expect(collectFrom()).rejects.toThrow(/gh/)
    },
    A_LONG_TIME,
  )

  it(
    'publishes every observation as its own, and as observed rather than declared',
    async () => {
      await ghAnswering(payload(TWELVE_DELIVERIES))

      const observations = await collectFrom()

      expect(observations.length).toBeGreaterThan(0)
      for (const observation of observations) {
        expect(observation.kind).toBe('OBSERVED')
        expect(observation.collector).toBe('forge-repository')
        expect(observation.basis).toContain('an-owner/a-repository')
      }
    },
    A_LONG_TIME,
  )

  it(
    'refuses to answer at all once its budget is spent',
    async () => {
      await ghAnswering(payload(TWELVE_DELIVERIES))

      await expect(collectFrom(FULL_VOCABULARY, AbortSignal.abort())).rejects.toThrow(/abort/i)
    },
    A_LONG_TIME,
  )
})
