import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { gitEnvironment } from './git-process.js'
import { afterEach, describe, expect, it } from 'vitest'
import { hasAiAttributionTrailer, readGitDerivedMetrics } from './git-history.js'

/** Integration, against real temporary Git repositories: Git is the boundary under test, so
 *  nothing here mocks it. Every commit date is explicit, so the suite carries no timezone or
 *  wall-clock dependency of its own. */

const run = promisify(execFile)

const NEVER_ABORTED = new AbortController().signal
const A_LONG_TIME = 120_000

const workspaces: string[] = []

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function git(cwd: string, args: readonly string[], date?: string): Promise<string> {
  // Never bare `process.env`: a git hook exports GIT_DIR, and an inherited one would send
  // these fixture commits into the repository under test instead of the temporary one.
  const env =
    date === undefined
      ? gitEnvironment()
      : gitEnvironment({ GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date })
  const { stdout } = await run('git', [...args], { cwd, env, maxBuffer: 64 * 1024 * 1024 })
  return stdout
}

/** `os.tmpdir()` is a symlink on macOS, and git reports the resolved path back. */
async function emptyDirectory(): Promise<string> {
  const path = await mkdtemp(join(await realpath(tmpdir()), 'aidd-git-history-'))
  workspaces.push(path)
  return path
}

async function initRepository(): Promise<string> {
  const repository = await emptyDirectory()
  await git(repository, ['-c', 'init.defaultBranch=main', 'init', '-q'])
  await git(repository, ['config', 'user.email', 'dev@example.com'])
  await git(repository, ['config', 'user.name', 'A Developer'])
  await git(repository, ['config', 'commit.gpgsign', 'false'])
  return repository
}

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

/** A branch, its commit, and a `--no-ff` merge back into the mainline. `mergedOn` is separate
 *  because a branch is worked on one day and lands on another. */
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

/** `count` files whose added lines sum to exactly `total`. */
function fileSizesTotalling(count: number, total: number): readonly number[] {
  return [total - (count - 1), ...Array.from({ length: count - 1 }, () => 1)]
}

const DAY = (day: number): string => `2026-01-${String(day).padStart(2, '0')}T12:00:00+00:00`

describe('readGitDerivedMetrics', () => {
  it(
    'recovers nothing from a repository that has no commit yet',
    async () => {
      const repository = await initRepository()

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toEqual({
        sizeBucket: null,
        parallelism: null,
      })
    },
    A_LONG_TIME,
  )

  it(
    'recovers nothing from a truncated history, even one holding enough merges to qualify',
    async () => {
      const origin = await repositoryWithABaseCommit(DAY(1))
      for (let index = 1; index <= 10; index += 1) {
        await deliverChange(origin, `change-${index}`, DAY(index + 1), [10])
      }
      const truncated = await emptyDirectory()
      await git(truncated, ['clone', '-q', '--depth', '8', `file://${origin}`, '.'])

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
        parallelism: null,
      })
    },
    A_LONG_TIME,
  )

  it(
    'recovers nothing from a history without a merge, however many commits it holds',
    async () => {
      const repository = await repositoryWithABaseCommit(DAY(1))
      for (let index = 1; index <= 12; index += 1) {
        await commitOnMainline(
          repository,
          { [`file-${index}.txt`]: linesOf(200) },
          `commit ${index}`,
          DAY(index + 1),
        )
      }

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toEqual({
        sizeBucket: null,
        parallelism: null,
      })
    },
    A_LONG_TIME,
  )

  it(
    'reports no size from four delivered changes, and a bucket from five',
    async () => {
      const four = await repositoryWithABaseCommit(DAY(1))
      for (let index = 1; index <= 4; index += 1) {
        await deliverChange(four, `change-${index}`, DAY(index + 1), [10])
      }
      const five = await repositoryWithABaseCommit(DAY(1))
      for (let index = 1; index <= 5; index += 1) {
        await deliverChange(five, `change-${index}`, DAY(index + 1), [10])
      }

      await expect(readGitDerivedMetrics(four, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: null,
      })
      await expect(readGitDerivedMetrics(five, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'S',
      })
    },
    A_LONG_TIME,
  )

  it(
    'reports the lower bucket when lines and files disagree',
    async () => {
      const repository = await repositoryWithABaseCommit(DAY(1))
      for (let index = 1; index <= 5; index += 1) {
        // One file of 1200 lines: XL by lines, S by files.
        await deliverChange(repository, `change-${index}`, DAY(index + 1), [1200])
      }

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'S',
      })
    },
    A_LONG_TIME,
  )

  it(
    'lands a half-integer median in exactly one bucket',
    async () => {
      const repository = await repositoryWithABaseCommit(DAY(1))
      // Six changes of 30 files each: XL by files. Three of 999 lines and three of 1000
      // give a median of 999.5, which the half-open bound puts in L, never XL.
      const lineTotals = [999, 999, 999, 1000, 1000, 1000]
      for (const [index, total] of lineTotals.entries()) {
        await deliverChange(
          repository,
          `change-${index + 1}`,
          DAY(index + 2),
          fileSizesTotalling(30, total),
        )
      }

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'L',
      })
    },
    A_LONG_TIME,
  )

  /** Each bound bracketed to the unit on either side. Since the two readings combine by taking
   *  the lower bucket, every row holds the scale it is not measuring at or above the answer. */
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

  it.each(SIZE_TABLE)(
    'buckets a median delivered change of $files files and $lines lines as $bucket',
    async ({ files, lines, bucket }) => {
      const repository = await repositoryWithABaseCommit(DAY(1))
      for (let index = 1; index <= 5; index += 1) {
        await deliverChange(
          repository,
          `change-${index}`,
          DAY(index + 1),
          fileSizesTotalling(files, lines),
        )
      }

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: bucket,
      })
    },
    A_LONG_TIME,
  )

  it(
    'counts deleted lines as lines changed, not as an empty change',
    async () => {
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

      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'M',
      })
    },
    A_LONG_TIME,
  )

  /** The window is the 180 days ending at the most recent commit, and both ends are closed. */
  const OLDEST_INSIDE_THE_WINDOW = '2026-01-01T12:00:00+00:00'
  const A_SECOND_TOO_OLD = '2026-01-01T11:59:59+00:00'
  const MOST_RECENT_COMMIT = '2026-06-30T12:00:00+00:00'

  it(
    'counts a delivered change dated exactly 180 days before the most recent commit',
    async () => {
      const repository = await repositoryWithABaseCommit('2025-12-31T12:00:00+00:00')
      await deliverChange(repository, 'oldest', OLDEST_INSIDE_THE_WINDOW, [10])
      for (let index = 1; index <= 4; index += 1) {
        await deliverChange(repository, `recent-${index}`, MOST_RECENT_COMMIT, [10])
      }

      // The fifth change is the one sitting exactly on the bound: a window shorter by a day, or
      // one excluding its own edge, leaves four, and four is not a habit.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'S',
      })
    },
    A_LONG_TIME,
  )

  it(
    'excludes a delivered change dated one second before that bound',
    async () => {
      const repository = await repositoryWithABaseCommit('2025-12-31T12:00:00+00:00')
      await deliverChange(repository, 'oldest', A_SECOND_TOO_OLD, [10])
      for (let index = 1; index <= 4; index += 1) {
        await deliverChange(repository, `recent-${index}`, MOST_RECENT_COMMIT, [10])
      }

      // The same five changes, the oldest moved back one second. A longer window answers 'S'.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: null,
      })
    },
    A_LONG_TIME,
  )

  it(
    'still measures a repository whose every commit is years old',
    async () => {
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

      const metrics = await readGitDerivedMetrics(repository, NEVER_ABORTED)

      expect(metrics.sizeBucket).toBe('S')
      expect(metrics.parallelism).not.toBeNull()
    },
    A_LONG_TIME,
  )

  it(
    'ends the window at the most recent commit reachable, not at the one HEAD points to',
    async () => {
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

      // The window then holds the five recent changes alone: S. Ending it at HEAD's own date
      // pulls in the five XL ones and answers L.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        sizeBucket: 'S',
      })
    },
    A_LONG_TIME,
  )

  it(
    'reports the median branches per day rather than the busiest day',
    async () => {
      const repository = await initRepository()
      await commitOnMainline(repository, { 'a.txt': 'a\n' }, 'first', DAY(1))
      await commitOnMainline(repository, { 'b.txt': 'b\n' }, 'second', DAY(2))
      for (const branch of ['spike-1', 'spike-2', 'spike-3', 'spike-4']) {
        await deliverChange(repository, branch, DAY(3), [1])
      }
      await commitOnMainline(repository, { 'c.txt': 'c\n' }, 'fourth', DAY(4))
      await commitOnMainline(repository, { 'd.txt': 'd\n' }, 'fifth', DAY(5))

      // Days hold 1, 1, 4, 1 and 1 branches: the median is 1, the peak is 4.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        parallelism: 1,
      })
    },
    A_LONG_TIME,
  )

  it(
    'reports no parallelism from four active days, and a median from five',
    async () => {
      const four = await repositoryWithABaseCommit(DAY(1))
      for (const [index, day] of [2, 2, 3, 3, 4].entries()) {
        await deliverChange(four, `change-${index}`, DAY(day), [10])
      }
      const five = await repositoryWithABaseCommit(DAY(1))
      for (const [index, day] of [2, 3, 4, 5, 5].entries()) {
        await deliverChange(five, `change-${index}`, DAY(day), [10])
      }

      // Both hold five delivered changes, so the day count alone separates them.
      await expect(readGitDerivedMetrics(four, NEVER_ABORTED)).resolves.toEqual({
        sizeBucket: 'S',
        parallelism: null,
      })
      await expect(readGitDerivedMetrics(five, NEVER_ABORTED)).resolves.toEqual({
        sizeBucket: 'S',
        parallelism: 1,
      })
    },
    A_LONG_TIME,
  )

  it(
    'measures parallelism over the same window as size',
    async () => {
      const repository = await initRepository()
      await commitOnMainline(repository, { 'README.md': 'base\n' }, 'base', DAY(1))
      for (const day of [1, 2, 3, 4, 5]) {
        await commitOnMainline(repository, { [`old-${day}.txt`]: 'x\n' }, `old ${day}`, DAY(day))
        await deliverChange(repository, `old-branch-${day}`, DAY(day), [1])
      }
      for (const day of [5, 6, 7, 8, 9]) {
        await commitOnMainline(
          repository,
          { [`recent-${day}.txt`]: 'x\n' },
          `recent ${day}`,
          `2026-07-0${day}T12:00:00+00:00`,
        )
      }

      // Only the quiet days fall in the window: one branch each, median 1. The whole history
      // would find five days at two branches and answer 1.5.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toEqual({
        sizeBucket: null,
        parallelism: 1,
      })
    },
    A_LONG_TIME,
  )

  it('counts a merge side as one branch, and the mainline it landed on as another', async () => {
    // The one fixture where a branch as a *merge side* and a branch as any parent diverge:
    // the mainline advances after the branch point, so the sides see the mainline and one
    // topic each day, while taking every parent re-counts that mainline commit as a branch.
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

    const metrics = await readGitDerivedMetrics(repository, NEVER_ABORTED)

    expect(metrics.parallelism).toBe(2)
  })

  it(
    'does not count the day a branch landed as a day of mainline work',
    async () => {
      const repository = await repositoryWithABaseCommit(DAY(1))
      for (const day of [2, 3, 4]) {
        await commitOnMainline(
          repository,
          { [`file-${day}.txt`]: 'x\n' },
          `commit ${day}`,
          DAY(day),
        )
      }
      await deliverChange(repository, 'branch-a', DAY(2), [1], DAY(20))
      await deliverChange(repository, 'branch-b', DAY(3), [1], DAY(21))

      // The 20th and the 21st saw only a merge. Counting those would make six active days.
      await expect(readGitDerivedMetrics(repository, NEVER_ABORTED)).resolves.toMatchObject({
        parallelism: null,
      })
    },
    A_LONG_TIME,
  )

  it(
    "reads a calendar day as the author's own, whatever timezone the reader is in",
    async () => {
      const repository = await repositoryWithABaseCommit('2026-03-01T12:00:00+00:00')
      await deliverChange(repository, 'a-branch', '2026-03-01T12:00:00+00:00', [1])
      await commitOnMainline(repository, { 'b.txt': 'b\n' }, 'second', '2026-03-02T12:00:00+00:00')
      // Each pair opens and closes one calendar day in its author's own offset, and the two
      // offsets are far enough apart that no single reader's timezone leaves both intact.
      for (const [index, date] of [
        '2026-03-10T00:00:00+05:30',
        '2026-03-10T23:59:00+05:30',
        '2026-03-12T00:00:00-03:00',
        '2026-03-12T23:59:00-03:00',
      ].entries()) {
        await commitOnMainline(repository, { [`edge-${index}.txt`]: 'x\n' }, `edge ${index}`, date)
      }

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
      const repository = await repositoryWithABaseCommit(DAY(1))

      await expect(readGitDerivedMetrics(repository, AbortSignal.abort())).rejects.toThrow(/abort/i)
    },
    A_LONG_TIME,
  )
})

describe('hasAiAttributionTrailer', () => {
  async function repositoryWithTrailer(trailer: string): Promise<string> {
    const repository = await initRepository()
    await commitOnMainline(
      repository,
      { 'a.txt': 'a\n' },
      `feat: something\n\nCo-Authored-By: ${trailer}\n`,
      DAY(1),
    )
    return repository
  }

  /** Every display name here is an ordinary person's, so the address is what has to decide. */
  const A_KNOWN_AGENT_ADDRESS = [
    { address: 'noreply@anthropic.com', trailer: 'Jane Doe <noreply@anthropic.com>' },
    {
      address: 'devin-ai-integration',
      trailer: 'Jane Doe <devin-ai-integration[bot]@users.noreply.github.com>',
    },
    { address: 'bot@cursor.sh', trailer: 'Jane Doe <bot@cursor.sh>' },
  ] as const

  it.each(A_KNOWN_AGENT_ADDRESS)(
    'reads the published agent address $address as AI attribution',
    async ({ trailer }) => {
      const repository = await repositoryWithTrailer(trailer)

      await expect(hasAiAttributionTrailer(repository, NEVER_ABORTED)).resolves.toBe(true)
    },
    A_LONG_TIME,
  )

  /** Every token and every domain appears once: the pairing holds the rule, it does not claim
   *  that agent uses that domain. */
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

  it.each(AN_AGENT_TOKEN_AT_A_VENDOR_DOMAIN)(
    'reads %s as AI attribution, whoever the trailer says wrote it',
    async (address) => {
      const repository = await repositoryWithTrailer(`Jane Doe <${address}>`)

      await expect(hasAiAttributionTrailer(repository, NEVER_ABORTED)).resolves.toBe(true)
    },
    A_LONG_TIME,
  )

  /** Every address here is an ordinary one at an ordinary domain, so the display name is what
   *  has to decide. */
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

  it.each(AN_AGENT_DISPLAY_NAME)(
    'reads the display name %s as AI attribution, whatever address it carries',
    async (name) => {
      const repository = await repositoryWithTrailer(`${name} <helper@example.com>`)

      await expect(hasAiAttributionTrailer(repository, NEVER_ABORTED)).resolves.toBe(true)
    },
    A_LONG_TIME,
  )

  /** Histories read and holding no AI attribution — `false`, never `null`. One ordinary name
   *  component is enough to make a display name a person's again. */
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

  it.each(NOT_AN_AGENT)(
    'reads $why as no AI attribution',
    async ({ message }) => {
      const repository = await initRepository()
      await commitOnMainline(repository, { 'a.txt': 'a\n' }, `${message}\n`, DAY(1))

      await expect(hasAiAttributionTrailer(repository, NEVER_ABORTED)).resolves.toBe(false)
    },
    A_LONG_TIME,
  )

  it(
    'answers null, not false, for a repository that has no commit yet',
    async () => {
      const repository = await initRepository()

      // Answering false would publish a harness set missing `prompts`: a practice gap.
      await expect(hasAiAttributionTrailer(repository, NEVER_ABORTED)).resolves.toBeNull()
    },
    A_LONG_TIME,
  )

  it(
    'answers null, not false, for a history git refuses to read',
    async () => {
      const repository = await initRepository()
      await commitOnMainline(repository, { 'a.txt': 'a\n' }, 'chore: first', DAY(1))
      await writeFile(join(repository, '.git', 'refs', 'heads', 'main'), `${'0'.repeat(40)}\n`)

      // The fault this fixture has to carry: an ordinary work tree, only the history
      // unreadable — which is what makes a false answer indistinguishable from no trailer.
      await expect(git(repository, ['log', '-1', '--format=%H', 'HEAD'])).rejects.toThrow(
        /bad object/i,
      )
      expect((await git(repository, ['rev-parse', '--is-inside-work-tree'])).trim()).toBe('true')

      await expect(hasAiAttributionTrailer(repository, NEVER_ABORTED)).resolves.toBeNull()
    },
    A_LONG_TIME,
  )

  it(
    'still finds a trailer in a truncated history',
    async () => {
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

      expect((await git(truncated, ['rev-parse', '--is-shallow-repository'])).trim()).toBe('true')
      await expect(hasAiAttributionTrailer(truncated, NEVER_ABORTED)).resolves.toBe(true)
    },
    A_LONG_TIME,
  )

  it(
    'rejects rather than resolving when the signal is already aborted',
    async () => {
      const repository = await initRepository()
      await commitOnMainline(repository, { 'a.txt': 'a\n' }, 'chore: first', DAY(1))

      // Cancellation is not an unreadable history: it costs no axis, it surfaces as TIMED_OUT.
      await expect(hasAiAttributionTrailer(repository, AbortSignal.abort())).rejects.toThrow(
        /abort/i,
      )
    },
    A_LONG_TIME,
  )
})
