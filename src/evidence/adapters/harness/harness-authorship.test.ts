import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { gitEnvironment } from '../live-repository/git-process.js'
import { readHarnessAuthorship } from './harness-authorship.js'

// Integration, against real temporary Git repositories: Git is the boundary under test.

const run = promisify(execFile)
const A_LONG_TIME = 60_000

const workspaces: string[] = []

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

interface CommitOverrides {
  readonly name?: string
  readonly email?: string
}

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
async function emptyDirectory(prefix: string): Promise<string> {
  const path = await mkdtemp(join(await realpath(tmpdir()), prefix))
  workspaces.push(path)
  return path
}

async function initRepository(): Promise<string> {
  const repository = await emptyDirectory('aidd-harness-authorship-')
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

const DAY = (day: number): string => `2026-06-${String(day).padStart(2, '0')}T12:00:00Z`
const WINDOW_START = Date.parse(DAY(0))
const NEVER = (): string | null => null

describe('readHarnessAuthorship, the happy path', () => {
  it(
    'answers one entry per account, with the files and commits it authored',
    async () => {
      const repository = await initRepository()
      await commitAs(repository, { 'a.md': 'a\n' }, 'add a', DAY(1), {
        name: 'Alice',
        email: 'alice@example.com',
      })
      await commitAs(repository, { 'b.md': 'b\n' }, 'add b', DAY(2), {
        name: 'Bob',
        email: 'bob@example.com',
      })

      const accountForEmail = (email: string): string | null =>
        email === 'alice@example.com' ? 'alice' : email === 'bob@example.com' ? 'bob' : null

      const authorship = await readHarnessAuthorship(
        repository,
        ['a.md', 'b.md'],
        accountForEmail,
        WINDOW_START,
        new AbortController().signal,
      )

      expect(authorship).toEqual(
        new Map([
          ['alice', { files: 1, commits: 1 }],
          ['bob', { files: 1, commits: 1 }],
        ]),
      )
    },
    A_LONG_TIME,
  )
})

describe('readHarnessAuthorship, the identity collapse', () => {
  it(
    'counts two addresses the lookup resolves to one login as a single entry, its files counted once',
    async () => {
      const repository = await initRepository()
      await commitAs(repository, { 'a.md': 'a\n' }, 'add a', DAY(1), {
        name: 'Alice A',
        email: 'alice1@example.com',
      })
      await commitAs(repository, { 'a.md': 'a\na\n' }, 'edit a', DAY(2), {
        name: 'Alice B',
        email: 'alice2@example.com',
      })

      const accountForEmail = (email: string): string | null =>
        email === 'alice1@example.com' || email === 'alice2@example.com' ? 'alice' : null

      const authorship = await readHarnessAuthorship(
        repository,
        ['a.md'],
        accountForEmail,
        WINDOW_START,
        new AbortController().signal,
      )

      expect(authorship).toEqual(new Map([['alice', { files: 1, commits: 2 }]]))
    },
    A_LONG_TIME,
  )

  it(
    'lands a commit whose address the lookup maps to nothing under the null key, on no login',
    async () => {
      const repository = await initRepository()
      await commitAs(repository, { 'a.md': 'a\n' }, 'add a', DAY(1), {
        name: 'Nobody Known',
        email: 'unknown@example.com',
      })

      const authorship = await readHarnessAuthorship(
        repository,
        ['a.md'],
        NEVER,
        WINDOW_START,
        new AbortController().signal,
      )

      expect(authorship).toEqual(new Map([[null, { files: 1, commits: 1 }]]))
    },
    A_LONG_TIME,
  )
})

describe('readHarnessAuthorship, a file more than one account touched', () => {
  it(
    'counts it for both accounts, so the totals do not partition the proving set',
    async () => {
      const repository = await initRepository()
      await commitAs(repository, { 'shared.md': 'a\n' }, 'add shared', DAY(1), {
        name: 'Alice',
        email: 'alice@example.com',
      })
      await commitAs(repository, { 'shared.md': 'a\nb\n' }, 'edit shared', DAY(2), {
        name: 'Bob',
        email: 'bob@example.com',
      })

      const accountForEmail = (email: string): string | null =>
        email === 'alice@example.com' ? 'alice' : email === 'bob@example.com' ? 'bob' : null

      const authorship = await readHarnessAuthorship(
        repository,
        ['shared.md'],
        accountForEmail,
        WINDOW_START,
        new AbortController().signal,
      )

      expect(authorship).toEqual(
        new Map([
          ['alice', { files: 1, commits: 1 }],
          ['bob', { files: 1, commits: 1 }],
        ]),
      )
    },
    A_LONG_TIME,
  )
})

describe('readHarnessAuthorship, a proving path with no commit in the window', () => {
  it(
    'contributes nothing, and the answer is a complete map rather than an unread walk',
    async () => {
      const repository = await initRepository()
      await commitAs(repository, { 'a.md': 'a\n' }, 'add a', DAY(1), {
        name: 'Alice',
        email: 'alice@example.com',
      })

      const authorship = await readHarnessAuthorship(
        repository,
        ['a.md'],
        () => 'alice',
        Date.parse(DAY(10)),
        new AbortController().signal,
      )

      expect(authorship).not.toBeNull()
      expect(authorship?.size).toBe(0)
    },
    A_LONG_TIME,
  )
})

describe('readHarnessAuthorship, an empty proving set', () => {
  it('returns an empty map and spawns no git at all', async () => {
    const authorship = await readHarnessAuthorship(
      '/aidd-audit-path-that-does-not-exist',
      [],
      NEVER,
      WINDOW_START,
      new AbortController().signal,
    )

    expect(authorship).toEqual(new Map())
  })
})

describe('readHarnessAuthorship, a git that refuses', () => {
  it(
    'answers null for the whole read, never a map of zeros',
    async () => {
      const notARepository = await emptyDirectory('aidd-harness-authorship-not-a-repo-')

      const authorship = await readHarnessAuthorship(
        notARepository,
        ['a.md'],
        NEVER,
        WINDOW_START,
        new AbortController().signal,
      )

      expect(authorship).toBeNull()
    },
    A_LONG_TIME,
  )
})

describe('readHarnessAuthorship, the budget', () => {
  // INVARIANT: the walk checks the budget before each piece of work, so an abort raised at any
  // point surfaces as a rejection rather than a completed walk on a partial count. The count below
  // is what pins each check: drop one and the highest checkpoint stops existing.

  // A real signal exhausted on its `nth` check, so a checkpoint is addressable by position.
  function signalExhaustedAt(
    nth: number,
    reason: Error,
  ): { signal: AbortSignal; checks: () => number } {
    const controller = new AbortController()
    const signal = controller.signal
    const original = signal.throwIfAborted.bind(signal)
    let checks = 0

    Object.defineProperty(signal, 'throwIfAborted', {
      value: () => {
        original()
        if (checks++ === nth) controller.abort(reason)
        original()
      },
    })

    return { signal, checks: () => checks }
  }

  async function repositoryWithOneProvingPath(): Promise<{
    repository: string
    provingPaths: readonly string[]
  }> {
    const repository = await initRepository()
    await commitAs(repository, { 'a.md': 'a\n' }, 'add a', DAY(1), {
      name: 'Alice',
      email: 'alice@example.com',
    })
    return { repository, provingPaths: ['a.md'] }
  }

  // One entry check ahead of the loop, then two per chunk — the loop's own check and the one `runGit` performs on entry — for the single chunk a lone proving path fits in.
  const EXPECTED_CHECKS = 3

  const countChecks = async (
    repository: string,
    provingPaths: readonly string[],
  ): Promise<number> => {
    const counted = signalExhaustedAt(Number.POSITIVE_INFINITY, new Error('never'))
    await readHarnessAuthorship(repository, provingPaths, NEVER, WINDOW_START, counted.signal)
    return counted.checks()
  }

  it(
    'checks the budget the expected number of times for one chunk',
    async () => {
      const { repository, provingPaths } = await repositoryWithOneProvingPath()

      await expect(countChecks(repository, provingPaths)).resolves.toBe(EXPECTED_CHECKS)
    },
    A_LONG_TIME,
  )

  it.each(Array.from({ length: EXPECTED_CHECKS }, (_value, index) => index))(
    'rejects with the abort reason when the budget runs out at checkpoint %i, never on a partial count',
    async (checkpoint) => {
      const { repository, provingPaths } = await repositoryWithOneProvingPath()
      const exhausted = signalExhaustedAt(checkpoint, new Error('authorship budget exhausted'))

      const authorship = readHarnessAuthorship(
        repository,
        provingPaths,
        NEVER,
        WINDOW_START,
        exhausted.signal,
      )

      await expect(authorship).rejects.toThrow(Error)
      await expect(authorship).rejects.toThrow(/authorship budget exhausted/)
    },
    A_LONG_TIME,
  )
})

describe('harness-authorship.ts stays mechanically a fact', () => {
  it('imports nothing from harness-scan.ts, and only its own model from evidence/models', () => {
    const source = readFileSync('src/evidence/adapters/harness/harness-authorship.ts', 'utf8')
    const importLines = source.split('\n').filter((line) => line.trim().startsWith('import '))

    // Nothing else stops a later hand from emitting an `Observation` out of this module and turning a count into an axis — `HarnessScan` reaching this file is exactly what would let that happen unnoticed.
    expect(importLines.some((line) => line.includes('harness-scan'))).toBe(false)

    const modelImports = importLines.filter((line) => line.includes('/models/'))
    expect(modelImports).toHaveLength(1)
    expect(modelImports[0]).toContain('harness-authorship.model.js')
  })
})
