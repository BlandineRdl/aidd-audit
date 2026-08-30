import { execFile } from 'node:child_process'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { gitEnvironment } from '../live-repository/git-process.js'
import { repositorySlug } from './repository-slug.js'

// Integration, against real temporary Git repositories: the remote is what git reports.

const run = promisify(execFile)
const NEVER_ABORTED = new AbortController().signal
const A_LONG_TIME = 60_000

const workspaces: string[] = []

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function repositoryWithOrigin(url: string | null): Promise<string> {
  const path = await mkdtemp(join(await realpath(tmpdir()), 'aidd-slug-'))
  workspaces.push(path)
  const env = gitEnvironment()
  await run('git', ['-c', 'init.defaultBranch=main', 'init', '-q'], { cwd: path, env })
  if (url !== null) await run('git', ['remote', 'add', 'origin', url], { cwd: path, env })
  return path
}

describe('repositorySlug', () => {
  it.each([
    ['https://github.com/mc-tracker-fr/McTracker.git', 'mc-tracker-fr', 'McTracker'],
    ['https://github.com/owner/name', 'owner', 'name'],
    ['git@github.com:owner/name.git', 'owner', 'name'],
    ['ssh://git@github.com/owner/name.git', 'owner', 'name'],
    ['https://token@github.com/owner/name.git', 'owner', 'name'],
  ])('reads %s as %s/%s', async (url, owner, name) => {
    const repository = await repositoryWithOrigin(url)

    await expect(repositorySlug(repository, NEVER_ABORTED)).resolves.toEqual({ owner, name })
  })

  it.each([
    ['git@gitlab.com:owner/name.git'],
    ['https://bitbucket.org/owner/name.git'],
    ['https://github.example.com/owner/name.git'],
    ['/srv/git/name.git'],
  ])(
    'declines %s rather than guessing a forge',
    async (url) => {
      const repository = await repositoryWithOrigin(url)

      await expect(repositorySlug(repository, NEVER_ABORTED)).resolves.toBeNull()
    },
    A_LONG_TIME,
  )

  it('declines a repository with no origin at all', async () => {
    const repository = await repositoryWithOrigin(null)

    // INVARIANT: no remote is not a failure, it is a subject this collector has nothing to say
    // about. `vcs.md` keeps the MVP working from a clone with no remote.
    await expect(repositorySlug(repository, NEVER_ABORTED)).resolves.toBeNull()
  })

  it('rejects rather than resolving when the signal is already aborted', async () => {
    const repository = await repositoryWithOrigin('https://github.com/owner/name.git')

    await expect(repositorySlug(repository, AbortSignal.abort())).rejects.toThrow(/abort/i)
  })
})
