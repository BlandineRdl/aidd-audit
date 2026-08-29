import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { GitCommandFailedError } from './git-command-failed.error.js'
import { gitEnvironment, isRepositoryRoot, runGit } from './git-process.js'

/**
 * Integration, against real temporary Git repositories: the subprocess is the boundary under
 * test, and a fake one would prove nothing about the duty the port names.
 */

const run = promisify(execFile)

const NEVER_ABORTED = new AbortController().signal

const workspaces: string[] = []

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

/** `os.tmpdir()` is a symlink on macOS, and git reports the resolved path back. */
async function emptyDirectory(): Promise<string> {
  const path = await mkdtemp(join(await realpath(tmpdir()), 'aidd-git-process-'))
  workspaces.push(path)
  return path
}

async function initRepository(): Promise<string> {
  const repository = await emptyDirectory()
  await run('git', ['-c', 'init.defaultBranch=main', 'init', '-q'], {
    cwd: repository,
    env: gitEnvironment(),
  })
  return repository
}

/**
 * A `git` invocation that takes `seconds` and then leaves a file behind.
 *
 * The marker is what separates "the promise stopped waiting" from "the command stopped
 * running": a subprocess merely abandoned still creates it.
 */
function lingeringCommand(seconds: number, marker: string): readonly string[] {
  return ['-c', `alias.linger=!sh -c 'sleep ${seconds}; : > ${marker}'`, 'linger']
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

describe('running git', () => {
  it('resolves what the command wrote to stdout', async () => {
    const repository = await initRepository()

    await expect(
      runGit(repository, ['rev-parse', '--is-inside-work-tree'], NEVER_ABORTED),
    ).resolves.toBe('true\n')
  })

  it('rejects with the failed command and git’s own complaint when git exits non-zero', async () => {
    const repository = await initRepository()

    const running = runGit(
      repository,
      ['rev-parse', '--verify', 'refs/heads/absent'],
      NEVER_ABORTED,
    )

    // Naming the invocation is what lets a caller tell an answer of "no" from a source it
    // never managed to ask.
    await expect(running).rejects.toThrow(GitCommandFailedError)
    await expect(running).rejects.toThrow(/git rev-parse --verify refs\/heads\/absent failed/)
  })

  it('rejects with the reason it was given when the budget is already spent', async () => {
    const repository = await initRepository()
    const spent = AbortSignal.abort(new Error('git budget exhausted before the call'))

    const running = runGit(repository, ['rev-parse', '--is-inside-work-tree'], spent)

    await expect(running).rejects.toThrow(Error)
    await expect(running).rejects.toThrow(/git budget exhausted before the call/)
  })

  it('kills the command when the budget is spent mid-flight, instead of leaving it running behind the answer', async () => {
    const repository = await initRepository()
    const proof = join(repository, 'the-alias-can-write')
    const marker = join(repository, 'the-command-ran-to-its-end')
    const LINGER_SECONDS = 2

    // The negative assertion below is worth nothing unless this command can create a file at
    // all, so prove the mechanism first and only then deny it the chance.
    await runGit(repository, lingeringCommand(0, proof), NEVER_ABORTED)
    expect(existsSync(proof)).toBe(true)

    const budget = new AbortController()
    const started = Date.now()
    // `execFile` spawns before it returns, so the child is already running here: no clock
    // decides when this abort lands, and none has to.
    const running = runGit(repository, lingeringCommand(LINGER_SECONDS, marker), budget.signal)
    budget.abort(new Error('git budget exhausted mid-command'))

    await expect(running).rejects.toThrow(Error)
    await expect(running).rejects.toThrow(/git budget exhausted mid-command/)
    // A promise that settles only once the command it gave up on has finished is a silent
    // hang wearing a rejection.
    expect(Date.now() - started).toBeLessThan(LINGER_SECONDS * 1000)

    // And gone, not merely abandoned: the side effect never lands, even after the full
    // window has passed.
    await delay((LINGER_SECONDS + 1) * 1000)
    expect(existsSync(marker)).toBe(false)
  }, 30_000)
})

describe('choosing which repository to act on', () => {
  it('obeys its working directory even when the environment names another repository', async () => {
    const subject = await initRepository()
    const decoy = await initRepository()

    // Exactly what a git hook exports. Inherited, it wins over `cwd`, and every command
    // below would act on the decoy — which is how running `pnpm check` from `pre-commit`
    // once built fixture commits inside the repository being committed to.
    process.env.GIT_DIR = join(decoy, '.git')
    process.env.GIT_WORK_TREE = decoy
    try {
      const toplevel = (
        await runGit(subject, ['rev-parse', '--show-toplevel'], NEVER_ABORTED)
      ).trim()

      expect(await realpath(toplevel)).toBe(await realpath(subject))
    } finally {
      delete process.env.GIT_DIR
      delete process.env.GIT_WORK_TREE
    }
  })
})

describe('recognising the root of a repository', () => {
  it('answers true for the repository itself', async () => {
    const repository = await initRepository()

    await expect(isRepositoryRoot(repository, NEVER_ABORTED)).resolves.toBe(true)
  })

  it('answers false for a directory inside a repository', async () => {
    const repository = await initRepository()
    const inside = join(repository, 'packages/api')
    await mkdir(inside, { recursive: true })

    // A directory of a repository is not the repository. Answering true here would let the
    // enclosing checkout's harness be published as this subject's own evidence — which is
    // what a fixture bundle tracked inside this repository would otherwise get.
    await expect(isRepositoryRoot(inside, NEVER_ABORTED)).resolves.toBe(false)
  })

  it('answers false for a directory git refuses to call a work tree', async () => {
    const notARepository = await emptyDirectory()

    // git was reached and said no. That is an answer, and the collector may act on it.
    await expect(isRepositoryRoot(notARepository, NEVER_ABORTED)).resolves.toBe(false)
  })

  it('rejects rather than answering false when the budget is spent', async () => {
    const repository = await initRepository()
    const spent = AbortSignal.abort(new Error('root probe budget exhausted'))

    const probing = isRepositoryRoot(repository, spent)

    // Only a refusal git itself issued means "not a repository". Swallowing a spent budget
    // here would turn every axis below into an observation that there is no harness.
    await expect(probing).rejects.toThrow(Error)
    await expect(probing).rejects.toThrow(/root probe budget exhausted/)
  })
})
