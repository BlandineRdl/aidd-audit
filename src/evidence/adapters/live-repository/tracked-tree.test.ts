import { chmod, mkdir, mkdtemp, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runGit } from './git-process.js'
import { trackedTree } from './tracked-tree.js'

// Integration: this is the one place the Git index becomes a HarnessTree.

const NEVER_ABORTED = new AbortController().signal
const workspaces: string[] = []

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function repository(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'aidd-tracked-tree-')))
  workspaces.push(root)
  await runGit(root, ['-c', 'init.defaultBranch=main', 'init', '-q'], NEVER_ABORTED)
  await runGit(root, ['config', 'user.email', 'fixture@example.test'], NEVER_ABORTED)
  await runGit(root, ['config', 'user.name', 'Tracked Tree Fixture'], NEVER_ABORTED)
  await runGit(root, ['config', 'commit.gpgsign', 'false'], NEVER_ABORTED)
  await runGit(root, ['config', 'core.excludesFile', '/dev/null'], NEVER_ABORTED)
  return root
}

async function tracked(root: string, path: string, content = 'fixture\n'): Promise<void> {
  const absolute = join(root, path)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, content)
  await runGit(root, ['add', '-f', '--', path], NEVER_ABORTED)
}

async function commit(root: string): Promise<void> {
  await runGit(root, ['commit', '--no-verify', '-m', 'chore: fixture tree'], NEVER_ABORTED)
}

describe('trackedTree', () => {
  it('lists entries from the repository root when the subject is one of its subdirectories', async () => {
    const root = await repository()
    await tracked(root, 'CLAUDE.md')
    await tracked(root, 'packages/api/index.ts')
    await commit(root)

    const tree = await trackedTree(join(root, 'packages/api'), NEVER_ABORTED)

    await expect(tree.entries()).resolves.toEqual([
      { path: 'CLAUDE.md', regularFile: true, executable: false },
      { path: 'packages/api/index.ts', regularFile: true, executable: false },
    ])
  })

  it('uses the executable bit Git recorded, even when the working-copy bit differs', async () => {
    const root = await repository()
    await tracked(root, 'scripts/retry.sh', 'until pnpm check; do claude -p fix; done\n')
    await runGit(root, ['update-index', '--chmod=+x', '--', 'scripts/retry.sh'], NEVER_ABORTED)
    await commit(root)
    await chmod(join(root, 'scripts/retry.sh'), 0o644)

    const tree = await trackedTree(root, NEVER_ABORTED)

    await expect(tree.entries()).resolves.toEqual([
      { path: 'scripts/retry.sh', regularFile: true, executable: true },
    ])
  })

  it('lists a tracked file that disappeared from disk and makes its reads unreadable', async () => {
    const root = await repository()
    await tracked(root, 'scripts/gone.sh', '#!/bin/sh\n')
    await commit(root)
    await unlink(join(root, 'scripts/gone.sh'))

    const tree = await trackedTree(root, NEVER_ABORTED)

    await expect(tree.entries()).resolves.toEqual([
      { path: 'scripts/gone.sh', regularFile: true, executable: false },
    ])
    await expect(tree.probe('scripts/gone.sh', 64)).resolves.toBeNull()
    await expect(tree.read('scripts/gone.sh')).resolves.toBeNull()
  })

  it('omits an untracked instruction file while preserving its tracked peer', async () => {
    const root = await repository()
    await tracked(root, 'README.md')
    await writeFile(join(root, 'CLAUDE.md'), 'untracked\n')
    await commit(root)

    const tree = await trackedTree(root, NEVER_ABORTED)

    await expect(tree.entries()).resolves.toEqual([
      { path: 'README.md', regularFile: true, executable: false },
    ])
  })

  it('marks a tracked symlink as non-regular, even when its target is script-shaped', async () => {
    const root = await repository()
    await writeFile(
      join(root, 'target.sh'),
      '#!/bin/sh\nuntil pnpm check; do claude -p fix; done\n',
    )
    await symlink('target.sh', join(root, 'scripts-link.sh'))
    await runGit(root, ['add', '-f', '--', 'scripts-link.sh'], NEVER_ABORTED)
    await commit(root)

    const tree = await trackedTree(root, NEVER_ABORTED)

    await expect(tree.entries()).resolves.toEqual([
      { path: 'scripts-link.sh', regularFile: false, executable: false },
    ])
  })
})
