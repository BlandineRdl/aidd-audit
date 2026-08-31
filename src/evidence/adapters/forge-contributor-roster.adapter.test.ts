import { execFile } from 'node:child_process'
import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import type { AxisVocabulary } from '../models/axis.model.js'
import { ForgeContributorRosterAdapter } from './forge-contributor-roster.adapter.js'
import type { ForgeDeliveryReader } from './forge-repository/delivery-reader.js'
import type { MergedPullRequest } from './forge-repository/pull-request-history.js'
import type { HarnessTree, HarnessTreeEntry } from './harness/harness-tree.js'
import { gitEnvironment } from './live-repository/git-process.js'
import { trackedTree } from './live-repository/tracked-tree.js'

// SAFETY: Integration against a real temporary Git repository for every local read — `git` is the
// boundary under test for `mostRecentCommitDate`, the tracked tree and `harness-authorship.ts` — and
// a stub `gh` on PATH for the one forge call this adapter still makes directly, `readCommitHistory`.
// The delivery walk is never spawned at all: `ForgeDeliveryReader` is this phase's own type, so its
// double is a plain in-memory implementation, exactly as `contributor-deliveries.test.ts` never
// spawns `gh` either. What is under test here is this adapter's own assembly and its
// null-to-FAILED classification, not the walks it calls — those are `commit-history.test.ts`,
// `harness-authorship.test.ts` and `harness-scan.test.ts`'s own suites to prove.

const run = promisify(execFile)
const A_LONG_TIME = 60_000
const SLUG = { owner: 'an-owner', name: 'a-repository' }
const DAY = (day: number): string => `2026-06-${String(day).padStart(2, '0')}T12:00:00Z`

const FULL_VOCABULARY: readonly AxisVocabulary[] = [
  { axis: 'size', kind: 'ordinal', values: ['none', 'S', 'M', 'L', 'XL'] },
  {
    axis: 'harness',
    kind: 'set',
    members: ['prompts', 'context-engineering', 'behavior', 'loops'],
  },
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

async function emptyDirectory(prefix: string): Promise<string> {
  const path = await mkdtemp(join(await realpath(tmpdir()), prefix))
  workspaces.push(path)
  return path
}

interface CommitOverrides {
  readonly name?: string
  readonly email?: string
}

async function git(cwd: string, args: readonly string[], date?: string): Promise<string> {
  const env =
    date === undefined
      ? gitEnvironment()
      : gitEnvironment({ GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date })
  const { stdout } = await run('git', [...args], { cwd, env, maxBuffer: 64 * 1024 * 1024 })
  return stdout
}

async function initRepository(): Promise<string> {
  const repository = await emptyDirectory('aidd-contributor-roster-')
  await git(repository, ['-c', 'init.defaultBranch=main', 'init', '-q'])
  await git(repository, ['config', 'user.email', 'dev@example.com'])
  await git(repository, ['config', 'user.name', 'A Developer'])
  await git(repository, ['config', 'commit.gpgsign', 'false'])
  return repository
}

async function commitAs(
  repository: string,
  files: Readonly<Record<string, string>>,
  message: string,
  date: string,
  overrides: CommitOverrides = {},
): Promise<void> {
  for (const [name, content] of Object.entries(files)) {
    const absolute = join(repository, name)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, content)
  }
  await git(repository, ['add', '-A'])
  const authorArgs =
    overrides.name === undefined && overrides.email === undefined
      ? []
      : ['--author', `${overrides.name ?? 'A Developer'} <${overrides.email ?? 'dev@example.com'}>`]
  await git(repository, ['commit', '-q', '-m', message, ...authorArgs], date)
}

interface RecordedCommit {
  readonly authoredDate: string
  readonly email: string
  readonly login: string | null
}

function commitHistoryPayload(commits: readonly RecordedCommit[]): string {
  return JSON.stringify({
    data: {
      repository: {
        defaultBranchRef: {
          target: {
            history: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: commits.map((commit) => ({
                authoredDate: commit.authoredDate,
                author: {
                  name: 'Someone',
                  email: commit.email,
                  user: commit.login === null ? null : { login: commit.login },
                },
              })),
            },
          },
        },
      },
    },
  })
}

// INVARIANT: A `gh` that always answers the one payload it was given, and that writes a marker file
// on every invocation — the pre-flight cancellation test asserts the marker was never created,
// which is how it proves `gh` was never spawned rather than merely that its answer was ignored.
async function ghAnswering(stdout: string): Promise<{ readonly marker: string }> {
  const directory = await emptyDirectory('aidd-contributor-roster-gh-')
  const answer = join(directory, 'answer.json')
  const marker = join(directory, 'invoked')
  await writeFile(answer, stdout)
  await writeFile(join(directory, 'gh'), `#!/bin/sh\ntouch "${marker}"\ncat "${answer}"\n`)
  await chmod(join(directory, 'gh'), 0o755)

  restorePath = process.env.PATH
  process.env.PATH = `${directory}:${process.env.PATH ?? ''}`

  return { marker }
}

function pullRequest(
  overrides: Partial<MergedPullRequest> & { readonly openedBy: string | null },
): MergedPullRequest {
  return {
    mergedAt: overrides.mergedAt ?? DAY(10),
    createdAt: overrides.createdAt ?? DAY(10),
    lines: overrides.lines ?? 20,
    files: overrides.files ?? 2,
    commitDays: overrides.commitDays ?? [overrides.mergedAt ?? DAY(10)],
    commitsAfterOpen: overrides.commitsAfterOpen ?? 0,
    openedByABot: overrides.openedByABot ?? false,
    openedBy: overrides.openedBy,
  }
}

function readerFor(deliveries: readonly MergedPullRequest[] | null): ForgeDeliveryReader {
  return { read: () => Promise.resolve(deliveries) }
}

// SAFETY: a fixed HarnessTree, for the one test that needs a proving path this adapter cannot get
// from a real work tree: a path holding a NUL byte, which forces `readHarnessAuthorship`'s own
// `git log` invocation to fail deterministically rather than by chance of platform or Git version.
function fixedTree(entries: readonly HarnessTreeEntry[]): HarnessTree {
  return {
    entries: () => Promise.resolve(entries),
    probe: () => Promise.resolve(null),
    read: () => Promise.resolve(null),
  }
}

describe('the contributor roster, the happy path and the unattributed bucket', () => {
  it(
    'answers one record per account, each with its own counts and the repository harness observation',
    async () => {
      const repository = await initRepository()
      await commitAs(repository, { 'CLAUDE.md': 'alice\n' }, 'alice writes CLAUDE.md', DAY(1), {
        name: 'Alice',
        email: 'alice@example.com',
      })
      await commitAs(repository, { 'CLAUDE.md': 'alice\nbob\n' }, 'bob edits CLAUDE.md', DAY(5), {
        name: 'Bob',
        email: 'bob@example.com',
      })
      await commitAs(
        repository,
        { 'CLAUDE.md': 'alice\nbob\nghost\n' },
        'ghost edits CLAUDE.md',
        DAY(30),
        { name: 'Ghost', email: 'ghost@example.com' },
      )

      await ghAnswering(
        commitHistoryPayload([
          { authoredDate: DAY(1), email: 'alice@example.com', login: 'alice' },
          { authoredDate: DAY(2), email: 'alice@example.com', login: 'alice' },
          { authoredDate: DAY(3), email: 'alice@example.com', login: 'alice' },
          { authoredDate: DAY(4), email: 'bob@example.com', login: 'bob' },
          { authoredDate: DAY(5), email: 'bob@example.com', login: 'bob' },
          { authoredDate: DAY(6), email: 'ghost@example.com', login: null },
        ]),
      )

      const reader = readerFor([
        pullRequest({ mergedAt: DAY(10), commitDays: [DAY(10)], openedBy: 'alice' }),
        pullRequest({ mergedAt: DAY(11), commitDays: [DAY(11)], openedBy: null }),
      ])

      const adapter = new ForgeContributorRosterAdapter(
        SLUG,
        repository,
        reader,
        await trackedTree(repository, new AbortController().signal),
      )

      const result = await adapter.read({
        path: repository,
        vocabulary: FULL_VOCABULARY,
        signal: new AbortController().signal,
      })

      expect(result.status).toBe('COMPLETED')
      if (result.status !== 'COMPLETED') throw new Error('unreachable')

      expect(result.records).toHaveLength(3)
      expect(result.windowDays).toBe(180)
      expect(result.harnessObserved).toEqual(['context-engineering'])
      expect(result.harnessPaths).toBe(1)

      const alice = result.records.find((record) => record.account === 'alice')
      expect(alice).toMatchObject({
        emailAddresses: 1,
        commits: 3,
        deliveries: 1,
        activeDays: 1,
        harnessAuthorship: { files: 1, commits: 1 },
      })

      // INVARIANT: `bob` is the fixture task 3.15 asks for — a named account with zero deliveries,
      // beside the unattributed bucket, proving the two are never merged into one another.
      const bob = result.records.find((record) => record.account === 'bob')
      expect(bob).toMatchObject({
        emailAddresses: 1,
        commits: 2,
        deliveries: 0,
        activeDays: 0,
        harnessAuthorship: { files: 1, commits: 1 },
      })

      const unattributed = result.records.find((record) => record.account === null)
      expect(unattributed).toMatchObject({
        emailAddresses: 0,
        commits: 1,
        deliveries: 1,
        activeDays: 1,
        harnessAuthorship: { files: 1, commits: 1 },
      })

      for (const record of result.records) {
        const harness = record.observations.find((observation) => observation.axis === 'harness')
        expect(harness).toMatchObject({
          value: ['context-engineering'],
          kind: 'OBSERVED',
          collector: 'forge-contributor-roster',
        })
        for (const observation of record.observations) {
          expect(observation.collector).toBe('forge-contributor-roster')
        }
      }
    },
    A_LONG_TIME,
  )

  it(
    'answers exactly one record when the window holds a single account',
    async () => {
      const repository = await initRepository()
      await commitAs(repository, { 'a.md': 'a\n' }, 'init', DAY(30), {
        name: 'Alice',
        email: 'alice@example.com',
      })

      await ghAnswering(
        commitHistoryPayload([
          { authoredDate: DAY(30), email: 'alice@example.com', login: 'alice' },
        ]),
      )

      const adapter = new ForgeContributorRosterAdapter(
        SLUG,
        repository,
        readerFor([]),
        await trackedTree(repository, new AbortController().signal),
      )

      const result = await adapter.read({
        path: repository,
        vocabulary: FULL_VOCABULARY,
        signal: new AbortController().signal,
      })

      expect(result.status).toBe('COMPLETED')
      if (result.status !== 'COMPLETED') throw new Error('unreachable')
      expect(result.records).toHaveLength(1)
      expect(result.records[0]?.account).toBe('alice')
    },
    A_LONG_TIME,
  )

  it(
    'answers COMPLETED with no records when both walks answer and the window held nobody',
    async () => {
      const repository = await initRepository()
      await commitAs(repository, { 'a.md': 'a\n' }, 'init', DAY(30))

      await ghAnswering(commitHistoryPayload([]))

      const adapter = new ForgeContributorRosterAdapter(
        SLUG,
        repository,
        readerFor([]),
        await trackedTree(repository, new AbortController().signal),
      )

      const result = await adapter.read({
        path: repository,
        vocabulary: FULL_VOCABULARY,
        signal: new AbortController().signal,
      })

      expect(result).toMatchObject({ status: 'COMPLETED', records: [] })
    },
    A_LONG_TIME,
  )
})

describe('the contributor roster, a null from either walk is FAILED', () => {
  it(
    'answers FAILED naming the commit walk when it answers null rather than an empty roster',
    async () => {
      const repository = await initRepository()
      await commitAs(repository, { 'a.md': 'a\n' }, 'init', DAY(30))

      // Not JSON: `readCommitHistory`'s own `readPage` answers `null` for a page it cannot parse.
      await ghAnswering('not json')

      const adapter = new ForgeContributorRosterAdapter(
        SLUG,
        repository,
        readerFor([]),
        await trackedTree(repository, new AbortController().signal),
      )

      const result = await adapter.read({
        path: repository,
        vocabulary: FULL_VOCABULARY,
        signal: new AbortController().signal,
      })

      expect(result.status).toBe('FAILED')
      if (result.status === 'COMPLETED') throw new Error('unreachable')
      expect(result.records).toEqual([])
      expect(result.reason).toMatch(/commit walk/)
    },
    A_LONG_TIME,
  )

  it(
    'withholds the harness value, and does not fail, when the vocabulary carries no harness scale',
    async () => {
      // SAFETY: nothing failed to be read here, so this is an evidence gap and not a failed run.
      // `LiveRepositoryEvidenceCollector` answers the same condition with no observation at all, and
      // a roster reporting `FAILED` would tell the reader the forge refused when it answered. The
      // rows then carry no harness axis, which under a model declaring one leaves them UNPROVEN on
      // it — the conservative outcome, reached without inventing a value.
      const repository = await initRepository()
      await commitAs(repository, { 'CLAUDE.md': 'a\n' }, 'init', DAY(30))

      // SAFETY: the history must carry an account. An assertion over the observations of zero
      // records holds whatever the adapter does with a missing scale, and pins nothing at all —
      // which is how the first cut of this test stayed green with its own guard neutered.
      await ghAnswering(
        commitHistoryPayload([
          { authoredDate: DAY(1), email: 'alice@example.com', login: 'alice' },
        ]),
      )

      const noHarnessAxis = FULL_VOCABULARY.filter((scale) => scale.axis !== 'harness')

      const adapter = new ForgeContributorRosterAdapter(
        SLUG,
        repository,
        readerFor([]),
        await trackedTree(repository, new AbortController().signal),
      )

      const result = await adapter.read({
        path: repository,
        vocabulary: noHarnessAxis,
        signal: new AbortController().signal,
      })

      expect(result.status).toBe('COMPLETED')
      if (result.status !== 'COMPLETED') throw new Error('unreachable')
      expect(result.harnessObserved).toBeNull()
      expect(result.records.map((record) => record.account)).toEqual(['alice'])
      expect(
        result.records.flatMap((record) =>
          record.observations.filter((observation) => observation.axis === 'harness'),
        ),
      ).toEqual([])
    },
    A_LONG_TIME,
  )

  it(
    'answers FAILED naming the harness authorship walk when it answers null rather than an empty roster',
    async () => {
      const repository = await initRepository()
      await commitAs(repository, { 'a.md': 'a\n' }, 'init', DAY(30))

      await ghAnswering(commitHistoryPayload([]))

      // SAFETY: a proving path carrying a NUL byte makes Node's own `execFile` throw synchronously
      // before a process is even spawned — a deterministic, platform-independent way to make
      // `readHarnessAuthorship`'s `runGit` call refuse, without needing a broken repository (which
      // would also break the commit walk this scenario needs to keep succeeding). This drives this
      // adapter's null-to-FAILED classification; `readHarnessAuthorship`'s own refusal handling is
      // `harness-authorship.test.ts`'s to prove.
      const tree = fixedTree([
        {
          path: `.claude/rules/${String.fromCharCode(0)}evil.md`,
          regularFile: false,
          executable: null,
        },
      ])

      const adapter = new ForgeContributorRosterAdapter(SLUG, repository, readerFor([]), tree)

      const result = await adapter.read({
        path: repository,
        vocabulary: FULL_VOCABULARY,
        signal: new AbortController().signal,
      })

      expect(result.status).toBe('FAILED')
      if (result.status === 'COMPLETED') throw new Error('unreachable')
      expect(result.records).toEqual([])
      expect(result.reason).toMatch(/authorship walk/)
    },
    A_LONG_TIME,
  )
})

describe('the contributor roster, the signal', () => {
  it(
    'answers TIMED_OUT and spawns no gh at all when the signal is already spent',
    async () => {
      const repository = await initRepository()
      await commitAs(repository, { 'a.md': 'a\n' }, 'init', DAY(30))

      const { marker } = await ghAnswering(commitHistoryPayload([]))

      const adapter = new ForgeContributorRosterAdapter(
        SLUG,
        repository,
        readerFor([]),
        await trackedTree(repository, new AbortController().signal),
      )

      const result = await adapter.read({
        path: repository,
        vocabulary: FULL_VOCABULARY,
        signal: AbortSignal.abort(),
      })

      expect(result.status).toBe('TIMED_OUT')
      await expect(rm(marker)).rejects.toThrow()
    },
    A_LONG_TIME,
  )

  it(
    'answers TIMED_OUT when the budget is spent between the delivery walk and the harness scan',
    async () => {
      const repository = await initRepository()
      await commitAs(repository, { 'a.md': 'a\n' }, 'init', DAY(30))

      await ghAnswering(commitHistoryPayload([]))

      const controller = new AbortController()
      const abortingReader: ForgeDeliveryReader = {
        read: () => {
          controller.abort()
          return Promise.resolve([])
        },
      }

      const adapter = new ForgeContributorRosterAdapter(
        SLUG,
        repository,
        abortingReader,
        await trackedTree(repository, controller.signal),
      )

      const result = await adapter.read({
        path: repository,
        vocabulary: FULL_VOCABULARY,
        signal: controller.signal,
      })

      expect(result.status).toBe('TIMED_OUT')
    },
    A_LONG_TIME,
  )

  it(
    'gives an account that delivered without committing in the window a row of its own',
    async () => {
      // SAFETY: the two walks filter on different things — the commit walk drops a bot by its
      // `[bot]` login suffix while the delivery walk drops one by `__typename` — and a delivery can
      // be merged inside the window from commits authored before it. Either way an account can be
      // known to the delivery walk and unknown to the commit walk, and its row must exist with the
      // counts that reading actually supports rather than be dropped.
      const repository = await initRepository()
      await commitAs(repository, { 'CLAUDE.md': 'a\n' }, 'init', DAY(30))

      await ghAnswering(
        commitHistoryPayload([
          { authoredDate: DAY(1), email: 'alice@example.com', login: 'alice' },
        ]),
      )

      const reader = readerFor([
        pullRequest({ mergedAt: DAY(10), commitDays: [DAY(10)], openedBy: 'carol' }),
      ])

      const adapter = new ForgeContributorRosterAdapter(
        SLUG,
        repository,
        reader,
        await trackedTree(repository, new AbortController().signal),
      )

      const result = await adapter.read({
        path: repository,
        vocabulary: FULL_VOCABULARY,
        signal: new AbortController().signal,
      })

      if (result.status !== 'COMPLETED') throw new Error('unreachable')

      const carol = result.records.find((record) => record.account === 'carol')
      expect(carol).toBeDefined()
      expect(carol?.deliveries).toBe(1)
      expect(carol?.commits).toBe(0)
      // INVARIANT: zero addresses accompanies zero commits, and states that nothing was collapsed
      // rather than that a mapping was read and found empty.
      expect(carol?.emailAddresses).toBe(0)
    },
    A_LONG_TIME,
  )

  it(
    'withholds the harness value, and does not fail, when the scan leaves a rankable member undecidable',
    async () => {
      // SAFETY: the other half of the rule the previous case covers, and the branch an adapter is
      // most likely to misread as a failure. A tracked `.claude/settings.json` that cannot be parsed
      // leaves `behavior` undecidable, `decidedCapabilities` answers null for the whole axis, and
      // nothing failed to be read — the walk ran to completion and the scan simply could not decide.
      // Calling that `FAILED` would tell the reader the forge refused when it answered.
      const repository = await initRepository()
      await commitAs(
        repository,
        { '.claude/settings.json': '{ this is not json', 'CLAUDE.md': 'memory\n' },
        'init',
        DAY(30),
      )

      await ghAnswering(
        commitHistoryPayload([
          { authoredDate: DAY(1), email: 'alice@example.com', login: 'alice' },
        ]),
      )

      const adapter = new ForgeContributorRosterAdapter(
        SLUG,
        repository,
        readerFor([]),
        await trackedTree(repository, new AbortController().signal),
      )

      const result = await adapter.read({
        path: repository,
        vocabulary: FULL_VOCABULARY,
        signal: new AbortController().signal,
      })

      expect(result.status).toBe('COMPLETED')
      if (result.status !== 'COMPLETED') throw new Error('unreachable')

      expect(result.harnessObserved).toBeNull()
      expect(result.records.map((record) => record.account)).toEqual(['alice'])
      expect(
        result.records.flatMap((record) =>
          record.observations.filter((observation) => observation.axis === 'harness'),
        ),
      ).toEqual([])
    },
    A_LONG_TIME,
  )
})
