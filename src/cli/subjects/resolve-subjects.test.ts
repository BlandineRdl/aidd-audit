import { execFile } from 'node:child_process'
import { chmod, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { gitEnvironment } from '../../evidence/adapters/live-repository/git-process.js'
import { UsageError } from '../usage.error.js'
import { childBundles, resolveSubjects } from './resolve-subjects.js'

const run = promisify(execFile)
const UNBOUNDED = new AbortController().signal

const workspaces: string[] = []

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

// COMPAT: `os.tmpdir()` is a symlink on macOS, and git reports the resolved path back.
async function emptyDirectory(): Promise<string> {
  const path = await mkdtemp(join(await realpath(tmpdir()), 'aidd-resolve-subjects-'))
  workspaces.push(path)
  return path
}

async function bundleAt(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'profile.json'), '{}')
}

async function repositoryRoot(): Promise<string> {
  const path = await emptyDirectory()
  await run('git', ['-c', 'init.defaultBranch=main', 'init', '-q'], {
    cwd: path,
    env: gitEnvironment(),
  })
  return path
}

describe('resolving one operand into the subjects to assess', () => {
  it('resolves a file to itself', async () => {
    const directory = await emptyDirectory()
    const file = join(directory, 'note.txt')
    await writeFile(file, 'content')

    const resolved = await resolveSubjects(file, UNBOUNDED)

    expect(resolved).toEqual({ subjects: [file], isWorkTreeRoot: false, isSet: false })
  })

  it('resolves a recorded bundle to itself', async () => {
    const bundle = await emptyDirectory()
    await bundleAt(bundle)

    const resolved = await resolveSubjects(bundle, UNBOUNDED)

    expect(resolved).toEqual({ subjects: [bundle], isWorkTreeRoot: false, isSet: false })
  })

  it('resolves a work-tree root to itself, naming it a work-tree root', async () => {
    const repository = await repositoryRoot()

    const resolved = await resolveSubjects(repository, UNBOUNDED)

    expect(resolved).toEqual({ subjects: [repository], isWorkTreeRoot: true, isSet: false })
  })

  it('resolves a work-tree root holding bundles to itself, never to its bundles', async () => {
    const repository = await repositoryRoot()
    await bundleAt(join(repository, 'first'))
    await bundleAt(join(repository, 'second'))

    const resolved = await resolveSubjects(repository, UNBOUNDED)

    // INVARIANT: the bundles sit directly inside the root, where the set rule would see them. That
    // is what makes the order load-bearing here: filed a level deeper they are out of the set's
    // reach anyway, and the rule that ran first would decide nothing.
    expect(resolved).toEqual({ subjects: [repository], isWorkTreeRoot: true, isSet: false })
  })

  it('refuses a directory whose only bundles sit deeper than its own children', async () => {
    const nested = await emptyDirectory()
    await bundleAt(join(nested, 'team', 'first'))

    await expect(resolveSubjects(nested, UNBOUNDED)).rejects.toThrow(UsageError)
  })

  it('resolves a directory that is both a recorded bundle and a work-tree root to itself, naming it a work-tree root', async () => {
    const repository = await repositoryRoot()
    await bundleAt(repository)

    const resolved = await resolveSubjects(repository, UNBOUNDED)

    // INVARIANT: the bundle rule still decides arity — one subject, not the set reading — but
    // `isWorkTreeRoot` names the real fact regardless, which is what keeps this subject's forge.
    expect(resolved).toEqual({ subjects: [repository], isWorkTreeRoot: true, isSet: false })
  })

  it('resolves a directory holding child bundles to those children, sorted by name', async () => {
    const set = await emptyDirectory()
    await bundleAt(join(set, 'zeta'))
    await bundleAt(join(set, 'alpha'))
    await mkdir(join(set, 'not-a-bundle'), { recursive: true })

    const resolved = await resolveSubjects(set, UNBOUNDED)

    expect(resolved).toEqual({
      subjects: [join(set, 'alpha'), join(set, 'zeta')],
      isWorkTreeRoot: false,
      isSet: true,
    })
  })

  it('resolves a directory of symlinks to bundles the same as a directory of bundles', async () => {
    const target = await emptyDirectory()
    await bundleAt(join(target, 'real'))
    const set = await emptyDirectory()
    await symlink(join(target, 'real'), join(set, 'linked'), 'dir')

    const resolved = await resolveSubjects(set, UNBOUNDED)

    expect(resolved.subjects).toEqual([join(set, 'linked')])
  })

  it('refuses a directory holding neither a bundle nor a work tree, naming the path', async () => {
    const directory = await emptyDirectory()
    await mkdir(join(directory, 'empty-child'), { recursive: true })

    await expect(resolveSubjects(directory, UNBOUNDED)).rejects.toThrow(directory)
  })

  it('refuses a directory whose bundles sit deeper without claiming it holds none', async () => {
    const nested = await emptyDirectory()
    await bundleAt(join(nested, 'team', 'first'))

    // INVARIANT: the refusal is true of what was looked at. Saying this directory holds no bundle
    // would be false — it holds one, a level below where a set is read.
    await expect(resolveSubjects(nested, UNBOUNDED)).rejects.toThrow(/directly inside/)
  })

  it('refuses a directory it cannot read as the caller`s fault, not as ours', async () => {
    const unreadable = await emptyDirectory()
    await chmod(unreadable, 0o000)

    try {
      // INVARIANT: resolution is pre-flight, so an unreadable subject is a UsageError and exits 2,
      // like a subject path naming nothing. Raw, the errno escaped and the taxonomy called it ours.
      await expect(resolveSubjects(unreadable, UNBOUNDED)).rejects.toThrow(UsageError)
    } finally {
      await chmod(unreadable, 0o755)
    }
  })

  it('refuses a spent budget before ever touching the filesystem', async () => {
    const directory = await emptyDirectory()
    const file = join(directory, 'note.txt')
    await writeFile(file, 'content')
    const controller = new AbortController()
    controller.abort()

    // SAFETY: a file resolves without calling `isBundle` or `isRepositoryRoot`, so this proves the
    // pre-flight check itself refuses — not a downstream `git` spawn honouring the same signal.
    await expect(resolveSubjects(file, controller.signal)).rejects.toThrow()
  })
})

describe('resolving the set of bundles inside a directory', () => {
  it('refuses a spent budget before checking any of several waiting bundles', async () => {
    const set = await emptyDirectory()
    await bundleAt(join(set, 'alpha'))
    await bundleAt(join(set, 'beta'))
    const controller = new AbortController()
    controller.abort()

    // SAFETY: driven directly, past `isRepositoryRoot`'s own spawn — this is the loop's own guard,
    // proven with more than one bundle still to check.
    await expect(childBundles(set, controller.signal)).rejects.toThrow()
  })
})
