import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { gitEnvironment } from './git-process.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasAiAttributionTrailer, readGitDerivedMetrics } from './git-history.js'

// Integration, against real temporary Git repositories: Git is the boundary under test.

const run = promisify(execFile)

const NEVER_ABORTED = new AbortController().signal
const A_LONG_TIME = 30_000

const workspaces: string[] = []

afterAll(async () => {
  await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function git(cwd: string, args: readonly string[], date?: string): Promise<string> {
  // SAFETY: never bare `process.env`: a git hook exports GIT_DIR, and an inherited one would send
  // these fixture commits into the repository under test instead of the temporary one.
  const env =
    date === undefined
      ? gitEnvironment()
      : gitEnvironment({ GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date })
  const { stdout } = await run('git', [...args], { cwd, env, maxBuffer: 64 * 1024 * 1024 })
  return stdout
}

// `os.tmpdir()` is a symlink on macOS, and git reports the resolved path back.
async function emptyDirectory(): Promise<string> {
  const path = await mkdtemp(join(await realpath(tmpdir()), 'aidd-git-history-'))
  workspaces.push(path)
  return path
}

// INVARIANT: `git init` and the three configs behind it are four processes, and this file builds
// some seventy repositories out of them. The template pays for them once and every repository after
// it is a copy of a pristine `.git`, which holds no absolute path and is therefore the same
// repository those four commands would have produced.
let template: Promise<string> | undefined

function pristineRepository(): Promise<string> {
  if (template === undefined) template = buildPristineRepository()
  return template
}

async function buildPristineRepository(): Promise<string> {
  const repository = await emptyDirectory()
  await git(repository, ['-c', 'init.defaultBranch=main', 'init', '-q'])
  await git(repository, ['config', 'user.email', 'dev@example.com'])
  await git(repository, ['config', 'user.name', 'A Developer'])
  await git(repository, ['config', 'commit.gpgsign', 'false'])
  return repository
}

async function initRepository(): Promise<string> {
  const repository = await emptyDirectory()
  await cp(await pristineRepository(), repository, { recursive: true })
  return repository
}

// INVARIANT: Every history this file reads is built once, by a named builder, and the builders run
// together instead of one test at a time — building them is `git` process time, and nothing about
// it is serial. A builder's promise is memoised, so two tests naming the same history share the one
// repository. Both functions under test only read, which is what makes sharing safe; a test that
// writes to its fixture takes `aCopyOf` it instead.
const builders: (() => Promise<unknown>)[] = []

function aFixture<T>(build: () => Promise<T>): () => Promise<T> {
  let started: Promise<T> | undefined
  const start = (): Promise<T> => {
    if (started === undefined) started = build()
    return started
  }
  builders.push(start)
  return start
}

// A fixture that is one repository, which is nearly all of them.
function aRepository(build: () => Promise<string>): () => Promise<string> {
  return aFixture(build)
}

async function aCopyOf(fixture: () => Promise<string>): Promise<string> {
  const copy = await emptyDirectory()
  await cp(await fixture(), copy, { recursive: true })
  return copy
}

// SAFETY: bounded. Seventy builders released at once would put seventy `git` processes on the
// machine, and the rejection is swallowed here alone: the memoised promise a test awaits is the
// same one, so the test that needs a repository still fails with the reason it could not be built.
const AT_ONCE = 8

beforeAll(async () => {
  // Every builder copies the template, so it exists before any of them looks for it.
  await pristineRepository()

  const queue = [...builders]
  await Promise.all(
    Array.from({ length: AT_ONCE }, async () => {
      for (let start = queue.shift(); start !== undefined; start = queue.shift()) {
        await start().catch(() => undefined)
      }
    }),
  )
}, A_LONG_TIME)

function linesOf(count: number): string {
  return `${Array.from({ length: count }, (_, index) => `line ${index}`).join('\n')}\n`
}

async function commitOnMainline(
  repository: string,
  files: Readonly<Record<string, string>>,
  message: string,
  date: string,
): Promise<void> {
  for (const [name, content] of Object.entries(files)) {
    const absolute = join(repository, name)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, content)
  }
  await git(repository, ['add', '-A'])
  await git(repository, ['commit', '-q', '-m', message], date)
}

async function repositoryWithABaseCommit(date: string): Promise<string> {
  const repository = await initRepository()
  await commitOnMainline(repository, { 'README.md': 'base\n' }, 'base', date)
  return repository
}

// INVARIANT: A branch, its commit, and a `--no-ff` merge back into the mainline. `mergedOn` is
// separate because a branch is worked on one day and lands on another.
async function deliverChange(
  repository: string,
  branch: string,
  date: string,
  fileSizes: readonly number[],
  mergedOn: string = date,
): Promise<void> {
  await git(repository, ['checkout', '-q', '-b', branch])
  const files: Record<string, string> = {}
  fileSizes.forEach((lines, index) => {
    files[`${branch}/file-${index}.txt`] = linesOf(lines)
  })
  await commitOnMainline(repository, files, `work on ${branch}`, date)
  await git(repository, ['checkout', '-q', 'main'])
  await git(repository, ['merge', '--no-ff', '-q', '-m', `merge ${branch}`, branch], mergedOn)
}

async function deliverDeletion(
  repository: string,
  branch: string,
  date: string,
  paths: readonly string[],
): Promise<void> {
  await git(repository, ['checkout', '-q', '-b', branch])
  await git(repository, ['rm', '-q', ...paths])
  await git(repository, ['commit', '-q', '-m', `remove for ${branch}`], date)
  await git(repository, ['checkout', '-q', 'main'])
  await git(repository, ['merge', '--no-ff', '-q', '-m', `merge ${branch}`, branch], date)
}

const AGENT_TRAILER = 'Co-Authored-By: Claude <noreply@anthropic.com>'

// INVARIANT: A branch and its `--no-ff` merge back, holding one commit per entry of `trailers`. An
// entry is the trailer that commit carries, `null` a commit carrying none.
async function deliverChangeAuthoredBy(
  repository: string,
  branch: string,
  date: string,
  trailers: readonly (string | null)[],
): Promise<void> {
  await git(repository, ['checkout', '-q', '-b', branch])
  for (const [index, trailer] of trailers.entries()) {
    await writeFile(join(repository, `${branch}-${index}.txt`), linesOf(10))
    await git(repository, ['add', '-A'])
    const message = trailer === null ? `work on ${branch}` : `work on ${branch}\n\n${trailer}`
    await git(repository, ['commit', '-q', '-m', message], date)
  }
  await git(repository, ['checkout', '-q', 'main'])
  await git(repository, ['merge', '--no-ff', '-q', '-m', `merge ${branch}`, branch], date)
}

// INVARIANT: A merge whose second parent is already an ancestor of its first, so it absorbs no
// commit at all. `git merge` declines to build one, and a back-merged or rewritten history holds
// them, so it is built here the only way it occurs: by hand, over the mainline's own tree.
async function deliverAlreadyLandedChange(
  repository: string,
  branch: string,
  date: string,
): Promise<void> {
  const tree = (await git(repository, ['rev-parse', 'HEAD^{tree}'])).trim()
  const mainline = (await git(repository, ['rev-parse', 'HEAD'])).trim()
  const side = (await git(repository, ['rev-parse', branch])).trim()
  const merge = (
    await git(
      repository,
      ['commit-tree', tree, '-p', mainline, '-p', side, '-m', `re-merge ${branch}`],
      date,
    )
  ).trim()
  await git(repository, ['update-ref', 'HEAD', merge])
}

// `count` files whose added lines sum to exactly `total`.
function fileSizesTotalling(count: number, total: number): readonly number[] {
  return [total - (count - 1), ...Array.from({ length: count - 1 }, () => 1)]
}

const DAY = (day: number): string => `2026-01-${String(day).padStart(2, '0')}T12:00:00+00:00`

// The two histories both describes below ask for. Everything else is named where it is used.
const NO_COMMIT_YET = aRepository(initRepository)

const ONE_ORDINARY_COMMIT = aRepository(async () => {
  const repository = await initRepository()
  await commitOnMainline(repository, { 'a.txt': 'a\n' }, 'chore: first', DAY(1))
  return repository
})

describe('readGitDerivedMetrics', () => {
  it(
    'recovers nothing from a repository that has no commit yet',
    async () => {
      const repository = await NO_COMMIT_YET()

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toEqual({
        sizeBucket: null,
        intervention: null,
        parallelism: null,
      })
    },
    A_LONG_TIME,
  )

  const A_TRUNCATED_HISTORY = aFixture(async () => {
    const origin = await repositoryWithABaseCommit(DAY(1))
    for (let index = 1; index <= 10; index += 1) {
      await deliverChange(origin, `change-${index}`, DAY(index + 1), [10])
    }
    const truncated = await emptyDirectory()
    await git(truncated, ['clone', '-q', '--depth', '8', `file://${origin}`, '.'])
    return { origin, truncated }
  })

  it(
    'recovers nothing from a truncated history, even one holding enough merges to qualify',
    async () => {
      const { origin, truncated } = await A_TRUNCATED_HISTORY()

      expect((await git(truncated, ['rev-parse', '--is-shallow-repository'])).trim()).toBe('true')
      const visibleMerges = (await git(truncated, ['log', '--first-parent', '--format=%P', 'HEAD']))
        .trim()
        .split('\n')
        .filter((parents) => parents.trim().split(' ').length >= 2)
      expect(visibleMerges.length).toBeGreaterThanOrEqual(5)
      await expect(readGitDerivedMetrics(origin, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'S',
      })

      await expect(readGitDerivedMetrics(truncated, NEVER_ABORTED)).resolves.toEqual({
        sizeBucket: null,
        intervention: null,
        parallelism: null,
      })
    },
    A_LONG_TIME,
  )

  const NO_MERGE_AT_ALL = aRepository(async () => {
    const repository = await repositoryWithABaseCommit(DAY(1))
    for (let index = 1; index <= 12; index += 1) {
      await commitOnMainline(
        repository,
        { [`file-${index}.txt`]: linesOf(200) },
        `commit ${index}`,
        DAY(index + 1),
      )
    }
    return repository
  })

  it(
    'recovers nothing from a history without a merge, however many commits it holds',
    async () => {
      const repository = await NO_MERGE_AT_ALL()

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toEqual({
        sizeBucket: null,
        intervention: null,
        parallelism: null,
      })
    },
    A_LONG_TIME,
  )

  function smallDeliveries(count: number): () => Promise<string> {
    return aRepository(async () => {
      const repository = await repositoryWithABaseCommit(DAY(1))
      for (let index = 1; index <= count; index += 1) {
        await deliverChange(repository, `change-${index}`, DAY(index + 1), [10])
      }
      return repository
    })
  }

  const FOUR_SMALL_DELIVERIES = smallDeliveries(4)
  const FIVE_SMALL_DELIVERIES = smallDeliveries(5)

  it(
    'reports no size from four delivered changes, and a bucket from five',
    async () => {
      const four = await FOUR_SMALL_DELIVERIES()
      const five = await FIVE_SMALL_DELIVERIES()

      await expect(readGitDerivedMetrics(four, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: null,
      })
      await expect(readGitDerivedMetrics(five, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'S',
      })
    },
    A_LONG_TIME,
  )

  const ONE_LONG_FILE_PER_CHANGE = aRepository(async () => {
    const repository = await repositoryWithABaseCommit(DAY(1))
    for (let index = 1; index <= 5; index += 1) {
      // One file of 1200 lines: XL by lines, S by files.
      await deliverChange(repository, `change-${index}`, DAY(index + 1), [1200])
    }
    return repository
  })

  it(
    'reports the lower bucket when lines and files disagree',
    async () => {
      const repository = await ONE_LONG_FILE_PER_CHANGE()

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'S',
      })
    },
    A_LONG_TIME,
  )

  // INVARIANT: six changes of 30 files each: XL by files. Three of 999 lines and three of 1000
  // give a median of 999.5, which the half-open bound puts in L, never XL.
  const A_HALF_INTEGER_MEDIAN = aRepository(async () => {
    const repository = await repositoryWithABaseCommit(DAY(1))
    const lineTotals = [999, 999, 999, 1000, 1000, 1000]
    for (const [index, total] of lineTotals.entries()) {
      await deliverChange(
        repository,
        `change-${index + 1}`,
        DAY(index + 2),
        fileSizesTotalling(30, total),
      )
    }
    return repository
  })

  it(
    'lands a half-integer median in exactly one bucket',
    async () => {
      const repository = await A_HALF_INTEGER_MEDIAN()

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'L',
      })
    },
    A_LONG_TIME,
  )

  // INVARIANT: each bound bracketed to the unit on either side. Since the two readings combine by
  // taking the lower bucket, every row holds the scale it is not measuring at or above the answer.
  const SIZE_TABLE = [
    { files: 4, lines: 100, bucket: 'S' },
    { files: 5, lines: 99, bucket: 'S' },
    { files: 5, lines: 100, bucket: 'M' },
    { files: 9, lines: 400, bucket: 'M' },
    { files: 10, lines: 399, bucket: 'M' },
    { files: 10, lines: 400, bucket: 'L' },
    { files: 24, lines: 1000, bucket: 'L' },
    { files: 25, lines: 999, bucket: 'L' },
    { files: 25, lines: 1000, bucket: 'XL' },
  ] as const

  // One repository per row, built alongside every other fixture rather than nine times in a row.
  const SIZE_ROWS = SIZE_TABLE.map((row) => ({
    ...row,
    repository: aRepository(async () => {
      const repository = await repositoryWithABaseCommit(DAY(1))
      for (let index = 1; index <= 5; index += 1) {
        await deliverChange(
          repository,
          `change-${index}`,
          DAY(index + 1),
          fileSizesTotalling(row.files, row.lines),
        )
      }
      return repository
    }),
  }))

  it.each(SIZE_ROWS)(
    'buckets a median delivered change of $files files and $lines lines as $bucket',
    async ({ bucket, repository }) => {
      await expect(readGitDerivedMetrics(await repository(), NEVER_ABORTED)).resolves.toMatchObject(
        {
          sizeBucket: bucket,
        },
      )
    },
    A_LONG_TIME,
  )

  const DELIVERIES_THAT_ONLY_DELETE = aRepository(async () => {
    const repository = await initRepository()
    const doomed: Record<string, string> = {}
    for (let index = 0; index < 25; index += 1) {
      doomed[`doomed/file-${index}.txt`] = linesOf(30)
    }
    await commitOnMainline(repository, doomed, 'base', DAY(1))

    for (let index = 0; index < 5; index += 1) {
      // Five files of thirty lines: M on both scales. Summing additions alone reads 0, and S.
      await deliverDeletion(
        repository,
        `removal-${index}`,
        DAY(index + 2),
        Array.from({ length: 5 }, (_, file) => `doomed/file-${index * 5 + file}.txt`),
      )
    }
    return repository
  })

  it(
    'counts deleted lines as lines changed, not as an empty change',
    async () => {
      const repository = await DELIVERIES_THAT_ONLY_DELETE()

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'M',
      })
    },
    A_LONG_TIME,
  )

  // The window is the 180 days ending at the most recent commit, and both ends are closed.
  const OLDEST_INSIDE_THE_WINDOW = '2026-01-01T12:00:00+00:00'
  const A_SECOND_TOO_OLD = '2026-01-01T11:59:59+00:00'
  const MOST_RECENT_COMMIT = '2026-06-30T12:00:00+00:00'

  // The same five changes either side of the bound, the oldest one second apart between them.
  function fiveChangesWithTheOldestDated(date: string): () => Promise<string> {
    return aRepository(async () => {
      const repository = await repositoryWithABaseCommit('2025-12-31T12:00:00+00:00')
      await deliverChange(repository, 'oldest', date, [10])
      for (let index = 1; index <= 4; index += 1) {
        await deliverChange(repository, `recent-${index}`, MOST_RECENT_COMMIT, [10])
      }
      return repository
    })
  }

  const THE_OLDEST_ON_THE_BOUND = fiveChangesWithTheOldestDated(OLDEST_INSIDE_THE_WINDOW)
  const THE_OLDEST_A_SECOND_OUT = fiveChangesWithTheOldestDated(A_SECOND_TOO_OLD)

  it(
    'counts a delivered change dated exactly 180 days before the most recent commit',
    async () => {
      const repository = await THE_OLDEST_ON_THE_BOUND()

      // INVARIANT: the fifth change is the one sitting exactly on the bound: a window shorter by a
      // day, or one excluding its own edge, leaves four, and four is not a habit.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'S',
      })
    },
    A_LONG_TIME,
  )

  it(
    'excludes a delivered change dated one second before that bound',
    async () => {
      const repository = await THE_OLDEST_A_SECOND_OUT()

      // The same five changes, the oldest moved back one second. A longer window answers 'S'.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: null,
      })
    },
    A_LONG_TIME,
  )

  const EVERY_COMMIT_YEARS_OLD = aRepository(async () => {
    const repository = await initRepository()
    await commitOnMainline(
      repository,
      { 'README.md': 'base\n' },
      'base',
      '2019-02-28T12:00:00+00:00',
    )
    for (let index = 1; index <= 5; index += 1) {
      await deliverChange(repository, `change-${index}`, `2019-03-0${index}T12:00:00+00:00`, [10])
    }
    return repository
  })

  it(
    'still measures a repository whose every commit is years old',
    async () => {
      const repository = await EVERY_COMMIT_YEARS_OLD()

      const metrics = await readGitDerivedMetrics(repository, NEVER_ABORTED)

      expect(metrics.sizeBucket).toBe('S')
      expect(metrics.parallelism).not.toBeNull()
    },
    A_LONG_TIME,
  )

  const HEAD_IS_NOT_THE_MOST_RECENT_COMMIT = aRepository(async () => {
    const repository = await repositoryWithABaseCommit('2025-06-01T12:00:00+00:00')
    // Outside a window ending on the 20th of January, inside one ending on the 5th.
    for (let index = 1; index <= 5; index += 1) {
      await deliverChange(
        repository,
        `old-${index}`,
        '2025-07-15T12:00:00+00:00',
        fileSizesTotalling(30, 1200),
      )
    }
    for (let index = 1; index <= 4; index += 1) {
      await deliverChange(repository, `recent-${index}`, '2026-01-05T12:00:00+00:00', [10])
    }
    // Worked on the 20th, landed on the 5th: HEAD is not the most recent commit.
    await deliverChange(
      repository,
      'late-branch',
      '2026-01-20T12:00:00+00:00',
      [10],
      '2026-01-05T12:00:00+00:00',
    )
    return repository
  })

  it(
    'ends the window at the most recent commit reachable, not at the one HEAD points to',
    async () => {
      const repository = await HEAD_IS_NOT_THE_MOST_RECENT_COMMIT()

      // INVARIANT: the window then holds the five recent changes alone: S. Ending it at HEAD's own
      // date pulls in the five XL ones and answers L.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'S',
      })
    },
    A_LONG_TIME,
  )

  const ONE_BUSY_DAY_AMONG_QUIET_ONES = aRepository(async () => {
    const repository = await initRepository()
    await commitOnMainline(repository, { 'a.txt': 'a\n' }, 'first', DAY(1))
    await commitOnMainline(repository, { 'b.txt': 'b\n' }, 'second', DAY(2))
    for (const branch of ['spike-1', 'spike-2', 'spike-3', 'spike-4']) {
      await deliverChange(repository, branch, DAY(3), [1])
    }
    await commitOnMainline(repository, { 'c.txt': 'c\n' }, 'fourth', DAY(4))
    await commitOnMainline(repository, { 'd.txt': 'd\n' }, 'fifth', DAY(5))
    return repository
  })

  it(
    'reports the median branches per day rather than the busiest day',
    async () => {
      const repository = await ONE_BUSY_DAY_AMONG_QUIET_ONES()

      // Days hold 1, 1, 4, 1 and 1 branches: the median is 1, the peak is 4.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        parallelism: 1,
      })
    },
    A_LONG_TIME,
  )

  function fiveDeliveriesOnDays(days: readonly number[]): () => Promise<string> {
    return aRepository(async () => {
      const repository = await repositoryWithABaseCommit(DAY(1))
      for (const [index, day] of days.entries()) {
        await deliverChange(repository, `change-${index}`, DAY(day), [10])
      }
      return repository
    })
  }

  const FOUR_ACTIVE_DAYS = fiveDeliveriesOnDays([2, 2, 3, 3, 4])
  const FIVE_ACTIVE_DAYS = fiveDeliveriesOnDays([2, 3, 4, 5, 5])

  it(
    'reports no parallelism from four active days, and a median from five',
    async () => {
      const four = await FOUR_ACTIVE_DAYS()
      const five = await FIVE_ACTIVE_DAYS()

      // Both hold five delivered changes, so the day count alone separates them.
      await expect(readGitDerivedMetrics(four, NEVER_ABORTED)).resolves.toEqual({
        sizeBucket: 'S',
        intervention: null,
        parallelism: null,
      })
      await expect(readGitDerivedMetrics(five, NEVER_ABORTED)).resolves.toEqual({
        sizeBucket: 'S',
        intervention: null,
        parallelism: 1,
      })
    },
    A_LONG_TIME,
  )

  const BUSY_DAYS_OUTSIDE_THE_WINDOW = aRepository(async () => {
    const repository = await repositoryWithABaseCommit(DAY(1))
    for (const day of [1, 2, 3, 4, 5]) {
      await deliverChange(repository, `old-a-${day}`, DAY(day), [1])
      await deliverChange(repository, `old-b-${day}`, DAY(day), [1])
    }
    for (const day of [5, 6, 7, 8, 9]) {
      await deliverChange(repository, `recent-${day}`, `2026-07-0${day}T12:00:00+00:00`, [1])
    }
    return repository
  })

  it(
    'measures parallelism over the same window as size',
    async () => {
      const repository = await BUSY_DAYS_OUTSIDE_THE_WINDOW()

      // INVARIANT: only the quiet days fall in the window: one branch each, median 1. The whole
      // history would find five busier days at two branches and answer 1.5.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toEqual({
        sizeBucket: 'S',
        intervention: null,
        parallelism: 1,
      })
    },
    A_LONG_TIME,
  )

  // INVARIANT: the one fixture where a branch as a *merge side* and a branch as any parent
  // diverge: the mainline advances after the branch point, so the sides see the mainline and one
  // topic each day, while taking every parent re-counts that mainline commit as a branch.
  const A_MAINLINE_ADVANCING_UNDER_ITS_BRANCHES = aRepository(async () => {
    const repository = await repositoryWithABaseCommit('2026-03-01T09:00:00+00:00')

    for (let day = 1; day <= 6; day += 1) {
      const date = `2026-03-0${day + 1}T10:00:00+00:00`
      await git(repository, ['checkout', '-q', '-b', `feat-${day}`])
      await commitOnMainline(repository, { [`feat-${day}.txt`]: linesOf(3) }, `feat ${day}`, date)
      await git(repository, ['checkout', '-q', 'main'])
      await commitOnMainline(repository, { [`main-${day}.txt`]: linesOf(3) }, `main ${day}`, date)
      await git(
        repository,
        ['merge', '--no-ff', '-q', '-m', `merge feat-${day}`, `feat-${day}`],
        date,
      )
    }
    return repository
  })

  it('counts a merge side as one branch, and the mainline it landed on as another', async () => {
    const repository = await A_MAINLINE_ADVANCING_UNDER_ITS_BRANCHES()

    const metrics = await readGitDerivedMetrics(repository, NEVER_ABORTED)

    expect(metrics.parallelism).toBe(2)
  })

  const TWO_DAYS_THAT_SAW_ONLY_A_MERGE = aRepository(async () => {
    const repository = await repositoryWithABaseCommit(DAY(1))
    for (const day of [2, 3, 4]) {
      await commitOnMainline(repository, { [`file-${day}.txt`]: 'x\n' }, `commit ${day}`, DAY(day))
    }
    await deliverChange(repository, 'branch-a', DAY(2), [1], DAY(20))
    await deliverChange(repository, 'branch-b', DAY(3), [1], DAY(21))
    return repository
  })

  it(
    'does not count the day a branch landed as a day of mainline work',
    async () => {
      const repository = await TWO_DAYS_THAT_SAW_ONLY_A_MERGE()

      // The 20th and the 21st saw only a merge. Counting those would make six active days.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        parallelism: null,
      })
    },
    A_LONG_TIME,
  )

  // INVARIANT: each pair opens and closes one calendar day in its author's own offset, and the
  // two offsets are far enough apart that no single reader's timezone leaves both intact.
  const DAYS_OPENED_AND_CLOSED_IN_TWO_OFFSETS = aRepository(async () => {
    const repository = await repositoryWithABaseCommit('2026-03-01T12:00:00+00:00')
    await deliverChange(repository, 'a-branch', '2026-03-01T12:00:00+00:00', [1])
    await commitOnMainline(repository, { 'b.txt': 'b\n' }, 'second', '2026-03-02T12:00:00+00:00')
    for (const [index, date] of [
      '2026-03-10T00:00:00+05:30',
      '2026-03-10T23:59:00+05:30',
      '2026-03-12T00:00:00-03:00',
      '2026-03-12T23:59:00-03:00',
    ].entries()) {
      await commitOnMainline(repository, { [`edge-${index}.txt`]: 'x\n' }, `edge ${index}`, date)
    }
    return repository
  })

  it(
    "reads a calendar day as the author's own, whatever timezone the reader is in",
    async () => {
      const repository = await DAYS_OPENED_AND_CLOSED_IN_TWO_OFFSETS()

      // Four days of work; recomputing them in the reader's timezone finds five or six.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        parallelism: null,
      })
    },
    A_LONG_TIME,
  )

  it(
    'rejects rather than resolving when the signal is already aborted',
    async () => {
      const repository = await ONE_ORDINARY_COMMIT()

      await expect(readGitDerivedMetrics(repository, AbortSignal.abort())).rejects.toThrow(/abort/i)
    },
    A_LONG_TIME,
  )
})

describe('readGitDerivedMetrics, when merges are not the delivery record', () => {
  // INVARIANT: `mainlineCommits` non-merge commits on the first-parent walk, beside `merges`
  // delivered changes. The base commit counts among the non-merge ones, so the caller asks for the
  // total it wants on that side, and the share under test is `merges / (merges + mainlineCommits)`.
  function repositoryMixing(merges: number, mainlineCommits: number): () => Promise<string> {
    return aRepository(async () => {
      const repository = await repositoryWithABaseCommit(DAY(1))
      for (let index = 1; index <= merges; index += 1) {
        await deliverChange(repository, `change-${index}`, DAY(index + 1), [10])
      }
      for (let index = 1; index < mainlineCommits; index += 1) {
        await commitOnMainline(
          repository,
          { [`direct-${index}.txt`]: linesOf(10) },
          `direct ${index}`,
          DAY(index + merges + 1),
        )
      }
      return repository
    })
  }

  const MERGES_EXACTLY_A_QUARTER = repositoryMixing(5, 15)
  const MERGES_JUST_UNDER_A_QUARTER = repositoryMixing(5, 16)

  it(
    'keeps both branch-derived axes when merges are exactly a quarter of what landed',
    async () => {
      const repository = await MERGES_EXACTLY_A_QUARTER()

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'S',
        parallelism: 1,
      })
    },
    A_LONG_TIME,
  )

  it(
    'withholds both branch-derived axes when merges fall just under a quarter',
    async () => {
      const repository = await MERGES_JUST_UNDER_A_QUARTER()

      // INVARIANT: a median drawn from a minority of what was delivered is not a measurement. The
      // axes go unobserved, which is an evidence gap, never a practice gap published low.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: null,
        parallelism: null,
      })
    },
    A_LONG_TIME,
  )

  const AGENT_MERGES_IN_A_MINORITY = aRepository(async () => {
    const repository = await repositoryWithABaseCommit(DAY(1))
    for (let index = 1; index <= 5; index += 1) {
      await deliverChangeAuthoredBy(repository, `change-${index}`, DAY(index + 1), [AGENT_TRAILER])
    }
    for (let index = 1; index <= 15; index += 1) {
      await commitOnMainline(
        repository,
        { [`direct-${index}.txt`]: linesOf(10) },
        `direct ${index}`,
        DAY(index + 7),
      )
    }
    return repository
  })

  it(
    'withholds intervention too from a history whose merges are a minority',
    async () => {
      const repository = await AGENT_MERGES_IN_A_MINORITY()

      // INVARIANT: all five merges here are agent-authored, so the autonomy share is 1.0 and the
      // top rank would be granted — from five deliveries out of twenty-one landings. A squashed
      // delivery leaves no side to read, so it cannot contribute; reading the survivors anyway
      // would grant the scale's top rank from exactly the minority the share guard just rejected.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toEqual({
        sizeBucket: null,
        intervention: null,
        parallelism: null,
      })
    },
    A_LONG_TIME,
  )
})

describe('readGitDerivedMetrics, on the intervention axis', () => {
  // One entry per delivered change, holding the trailers its commits carry.
  type Trailers = readonly (string | null)[]

  function deliveriesAuthoredBy(perChange: readonly Trailers[]): () => Promise<string> {
    return aRepository(async () => {
      const repository = await repositoryWithABaseCommit(DAY(1))
      for (const [index, trailers] of perChange.entries()) {
        await deliverChangeAuthoredBy(repository, `change-${index + 1}`, DAY(index + 2), trailers)
      }
      return repository
    })
  }

  function repeated(count: number, trailers: Trailers): readonly Trailers[] {
    return Array.from({ length: count }, () => trailers)
  }

  const EVERY_COMMIT_AN_AGENT_S = deliveriesAuthoredBy(repeated(5, [AGENT_TRAILER, AGENT_TRAILER]))
  const NOTHING_ATTRIBUTED = deliveriesAuthoredBy(repeated(8, [null]))
  const ONE_HUMAN_COMMIT_PER_CHANGE = deliveriesAuthoredBy(repeated(5, [AGENT_TRAILER, null]))
  const NINE_CHANGES_IN_TEN = deliveriesAuthoredBy(
    Array.from({ length: 10 }, (_, index) => [index === 0 ? null : AGENT_TRAILER]),
  )
  const EIGHT_CHANGES_IN_TEN = deliveriesAuthoredBy(
    Array.from({ length: 10 }, (_, index) => [index <= 1 ? null : AGENT_TRAILER]),
  )
  const FOUR_AGENT_DELIVERIES = deliveriesAuthoredBy(repeated(4, [AGENT_TRAILER]))
  const FIVE_AGENT_DELIVERIES = deliveriesAuthoredBy(repeated(5, [AGENT_TRAILER]))

  it(
    'grants autonomy to a history whose delivered changes hold no human commit',
    async () => {
      const repository = await EVERY_COMMIT_AN_AGENT_S()

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        intervention: 'never-once-framed',
      })
    },
    A_LONG_TIME,
  )

  it(
    'reports no intervention at all, never a low one, when nothing was authored by an agent',
    async () => {
      const repository = await NOTHING_ATTRIBUTED()

      // INVARIANT: the absence of a trailer is not evidence of a human. A value here would be a
      // practice gap nobody observed; withholding it is the evidence gap the situation is.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        intervention: null,
      })
    },
    A_LONG_TIME,
  )

  it(
    'withholds autonomy from a change carrying one human commit beside its agent ones',
    async () => {
      const repository = await ONE_HUMAN_COMMIT_PER_CHANGE()

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        intervention: null,
      })
    },
    A_LONG_TIME,
  )

  it(
    'grants autonomy at nine changes in ten, and withholds it at eight',
    async () => {
      const nine = await NINE_CHANGES_IN_TEN()
      const eight = await EIGHT_CHANGES_IN_TEN()

      await expect(readGitDerivedMetrics(nine, NEVER_ABORTED)).resolves.toMatchObject({
        intervention: 'never-once-framed',
      })
      await expect(readGitDerivedMetrics(eight, NEVER_ABORTED)).resolves.toMatchObject({
        intervention: null,
      })
    },
    A_LONG_TIME,
  )

  it(
    'reports no autonomy from four agent-authored changes, and grants it from five',
    async () => {
      const four = await FOUR_AGENT_DELIVERIES()
      const five = await FIVE_AGENT_DELIVERIES()

      await expect(readGitDerivedMetrics(four, NEVER_ABORTED)).resolves.toMatchObject({
        intervention: null,
      })
      await expect(readGitDerivedMetrics(five, NEVER_ABORTED)).resolves.toMatchObject({
        intervention: 'never-once-framed',
      })
    },
    A_LONG_TIME,
  )

  it(
    'does not read a merge that absorbed no commit as one an agent authored',
    async () => {
      // A copy, not the shared fixture: this is the one test here that writes to its repository.
      const repository = await aCopyOf(FIVE_AGENT_DELIVERIES)

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        intervention: 'never-once-framed',
      })

      for (let index = 1; index <= 5; index += 1) {
        await deliverAlreadyLandedChange(repository, `change-${index}`, DAY(index + 7))
      }

      // INVARIANT: "every commit carries a trailer" is vacuously true of no commit at all. A
      // change an agent authored is one an agent actually wrote something in.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        intervention: null,
      })
    },
    A_LONG_TIME,
  )

  const AN_ABANDONED_PRACTICE = aRepository(async () => {
    const repository = await repositoryWithABaseCommit('2025-01-01T12:00:00+00:00')
    for (let index = 1; index <= 6; index += 1) {
      await deliverChangeAuthoredBy(
        repository,
        `old-${index}`,
        `2025-01-${String(index + 1).padStart(2, '0')}T12:00:00+00:00`,
        [AGENT_TRAILER],
      )
    }
    for (let index = 1; index <= 6; index += 1) {
      await deliverChangeAuthoredBy(
        repository,
        `recent-${index}`,
        `2026-01-${String(index + 1).padStart(2, '0')}T12:00:00+00:00`,
        [null],
      )
    }
    return repository
  })

  it(
    'reads autonomy over the same window as size, so an abandoned practice stops counting',
    async () => {
      const repository = await AN_ABANDONED_PRACTICE()

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        intervention: null,
      })
    },
    A_LONG_TIME,
  )
})

describe('hasAiAttributionTrailer', () => {
  function repositoryWithTrailer(trailer: string): () => Promise<string> {
    return repositoryWithMessage(`feat: something\n\nCo-Authored-By: ${trailer}\n`)
  }

  function repositoryWithMessage(message: string): () => Promise<string> {
    return aRepository(async () => {
      const repository = await initRepository()
      await commitOnMainline(repository, { 'a.txt': 'a\n' }, message, DAY(1))
      return repository
    })
  }

  // Every display name here is an ordinary person's, so the address is what has to decide.
  const A_KNOWN_AGENT_ADDRESS = [
    { address: 'noreply@anthropic.com', trailer: 'Jane Doe <noreply@anthropic.com>' },
    {
      address: 'devin-ai-integration',
      trailer: 'Jane Doe <devin-ai-integration[bot]@users.noreply.github.com>',
    },
    { address: 'bot@cursor.sh', trailer: 'Jane Doe <bot@cursor.sh>' },
  ] as const

  it.each(
    A_KNOWN_AGENT_ADDRESS.map((row) => ({
      ...row,
      repository: repositoryWithTrailer(row.trailer),
    })),
  )(
    'reads the published agent address $address as AI attribution',
    async ({ repository }) => {
      await expect(hasAiAttributionTrailer(await repository(), NEVER_ABORTED)).resolves.toBe(true)
    },
    A_LONG_TIME,
  )

  // INVARIANT: every token and every domain appears once: the pairing holds the rule, it does not
  // claim that agent uses that domain.
  const AN_AGENT_TOKEN_AT_A_VENDOR_DOMAIN = [
    'claude@anthropic.com',
    'codex@google.com',
    'aider@cognition.ai',
    'copilot@users.noreply.github.com',
    'cursor-agent@cursor.sh',
    'cursoragent@cursor.com',
    'gemini-code-assist@google.com',
    'gemini@google.com',
    'devin@cognition.ai',
    'cursor@cursor.sh',
  ] as const

  it.each(
    AN_AGENT_TOKEN_AT_A_VENDOR_DOMAIN.map(
      (address) => [address, repositoryWithTrailer(`Jane Doe <${address}>`)] as const,
    ),
  )(
    'reads %s as AI attribution, whoever the trailer says wrote it',
    async (_address, repository) => {
      await expect(hasAiAttributionTrailer(await repository(), NEVER_ABORTED)).resolves.toBe(true)
    },
    A_LONG_TIME,
  )

  // INVARIANT: every address here is an ordinary one at an ordinary domain, so the display name is
  // what has to decide.
  const AN_AGENT_DISPLAY_NAME = [
    'Claude',
    'Claude Code',
    'GitHub Copilot',
    'Gemini Code Assist',
    'Copilot[bot]',
    'Claude Bot',
    'Devin AI',
    'Cursor Agent',
    'Assistant',
    'Google Gemini',
  ] as const

  it.each(
    AN_AGENT_DISPLAY_NAME.map(
      (name) => [name, repositoryWithTrailer(`${name} <helper@example.com>`)] as const,
    ),
  )(
    'reads the display name %s as AI attribution, whatever address it carries',
    async (_name, repository) => {
      await expect(hasAiAttributionTrailer(await repository(), NEVER_ABORTED)).resolves.toBe(true)
    },
    A_LONG_TIME,
  )

  // INVARIANT: histories read and holding no AI attribution — `false`, never `null`. One ordinary
  // name component is enough to make a display name a person's again.
  const NOT_AN_AGENT = [
    { why: 'no trailer at all', message: 'feat: something' },
    {
      why: 'a co-author outside the closed list',
      message: 'feat: something\n\nCo-Authored-By: Jane Doe <jane@example.com>',
    },
    {
      why: 'a person whose given name is an agent',
      message: 'feat: something\n\nCo-Authored-By: Claude Dupont <claude.dupont@example.com>',
    },
    {
      why: 'a company whose name is an agent',
      message: 'feat: something\n\nCo-Authored-By: Codex Ltd <hr@example.com>',
    },
    {
      why: 'a person whose surname is an agent',
      message: 'feat: something\n\nCo-Authored-By: Jan Copilot <jan@example.com>',
    },
    {
      why: 'a person who happens to be called Devin',
      message: 'feat: something\n\nCo-Authored-By: Devin Marsh <devin@example.com>',
    },
    {
      why: 'a person who happens to be called Gemini',
      message: 'feat: something\n\nCo-Authored-By: Gemini Rossi <gemini@example.com>',
    },
    {
      why: 'a person who happens to be called Cursor',
      message: 'feat: something\n\nCo-Authored-By: Cursor Jones <cursor@example.com>',
    },
    {
      why: 'an identity buried inside a longer word',
      message: 'feat: something\n\nCo-Authored-By: Sam Raider <sam@raiders.example>',
    },
    {
      why: 'an agent named in the body rather than on a trailer',
      message:
        'feat: pair with claude\n\nGenerated with claude, reviewed by hand.\n\nCo-Authored-By: Jane Doe <jane@example.com>',
    },
    {
      why: 'an agent address in the body rather than on a trailer',
      message:
        'feat: something\n\nSuggested by gemini@google.com in the chat.\n\nCo-Authored-By: Jane Doe <jane@example.com>',
    },
    {
      why: 'an agent named on some other trailer',
      message: 'feat: something\n\nReviewed-By: Claude <noreply@anthropic.com>',
    },
    {
      why: 'a vendor domain whose local part is not an agent token',
      message: 'feat: something\n\nCo-Authored-By: Jane Doe <assistant@google.com>',
    },
    {
      why: 'an agent token that is only part of the local part',
      message: 'feat: something\n\nCo-Authored-By: Notgemini <notgemini@google.com>',
    },
    {
      why: 'a vendor domain that is only the head of a longer one',
      message: 'feat: something\n\nCo-Authored-By: Jane Doe <gemini@google.com.example.net>',
    },
  ] as const

  it.each(
    NOT_AN_AGENT.map((row) => ({ ...row, repository: repositoryWithMessage(`${row.message}\n`) })),
  )(
    'reads $why as no AI attribution',
    async ({ repository }) => {
      await expect(hasAiAttributionTrailer(await repository(), NEVER_ABORTED)).resolves.toBe(false)
    },
    A_LONG_TIME,
  )

  it(
    'answers null, not false, for a repository that has no commit yet',
    async () => {
      const repository = await NO_COMMIT_YET()

      // Answering false would publish a harness set missing `prompts`: a practice gap.
      await expect(hasAiAttributionTrailer(repository, NEVER_ABORTED)).resolves.toBeNull()
    },
    A_LONG_TIME,
  )

  it(
    'answers null, not false, for a history git refuses to read',
    async () => {
      // A copy: breaking the ref below is a write, and the fixture is shared with the test after it.
      const repository = await aCopyOf(ONE_ORDINARY_COMMIT)
      await writeFile(join(repository, '.git', 'refs', 'heads', 'main'), `${'0'.repeat(40)}\n`)

      // INVARIANT: the fault this fixture has to carry: an ordinary work tree, only the history
      // unreadable — which is what makes a false answer indistinguishable from no trailer.
      await expect(git(repository, ['log', '-1', '--format=%H', 'HEAD'])).rejects.toThrow(
        /bad object/i,
      )
      expect((await git(repository, ['rev-parse', '--is-inside-work-tree'])).trim()).toBe('true')

      await expect(hasAiAttributionTrailer(repository, NEVER_ABORTED)).resolves.toBeNull()
    },
    A_LONG_TIME,
  )

  const A_TRUNCATED_HISTORY_HOLDING_A_TRAILER = aRepository(async () => {
    const origin = await initRepository()
    await commitOnMainline(origin, { 'a.txt': 'a\n' }, 'chore: first', DAY(1))
    await commitOnMainline(
      origin,
      { 'b.txt': 'b\n' },
      'feat: something\n\nCo-Authored-By: Codex <codex@example.com>\n',
      DAY(2),
    )
    const truncated = await emptyDirectory()
    await git(truncated, ['clone', '-q', '--depth', '1', `file://${origin}`, '.'])
    return truncated
  })

  it(
    'still finds a trailer in a truncated history',
    async () => {
      const truncated = await A_TRUNCATED_HISTORY_HOLDING_A_TRAILER()

      expect((await git(truncated, ['rev-parse', '--is-shallow-repository'])).trim()).toBe('true')
      await expect(hasAiAttributionTrailer(truncated, NEVER_ABORTED)).resolves.toBe(true)
    },
    A_LONG_TIME,
  )

  it(
    'rejects rather than resolving when the signal is already aborted',
    async () => {
      const repository = await ONE_ORDINARY_COMMIT()

      // Cancellation is not an unreadable history: it costs no axis, it surfaces as TIMED_OUT.
      await expect(hasAiAttributionTrailer(repository, AbortSignal.abort())).rejects.toThrow(
        /abort/i,
      )
    },
    A_LONG_TIME,
  )
})
