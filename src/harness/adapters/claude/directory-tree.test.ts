import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { directoryTree } from './directory-tree.js'

let directories: string[] = []

afterEach(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true })
  directories = []
})

function directoryHolding(files: readonly string[]): string {
  const path = mkdtempSync(join(tmpdir(), 'aidd-claude-tree-'))
  directories.push(path)

  for (const name of files) {
    const absolute = join(path, name)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, `content of ${name}\n`)
  }

  return path
}

const unbounded = new AbortController().signal

describe('the seam over a real directory', () => {
  it('lists every file nested under a directory, with paths relative to the tree root', async () => {
    const root = directoryHolding(['a.md', 'nested/b.md', 'nested/deeper/c.md'])

    const paths = (await directoryTree(root, unbounded).entries('')).map((entry) => entry.path)

    expect(paths.sort()).toEqual(['a.md', 'nested/b.md', 'nested/deeper/c.md'])
  })

  it('lists only the files nested under the directory named, not the whole tree root', async () => {
    const root = directoryHolding(['outside.md', 'inside/a.md', 'inside/b.md'])

    const paths = (await directoryTree(root, unbounded).entries('inside')).map(
      (entry) => entry.path,
    )

    expect(paths.sort()).toEqual(['inside/a.md', 'inside/b.md'])
  })

  it('never lists a directory the tool would never load: node_modules, .git, dotfiles', async () => {
    const root = directoryHolding([
      'kept.md',
      'node_modules/lib/index.js',
      '.git/HEAD',
      '.hidden.md',
    ])

    const paths = (await directoryTree(root, unbounded).entries('')).map((entry) => entry.path)

    expect(paths).toEqual(['kept.md'])
  })

  it('lists nothing for a directory that does not exist, rather than throwing', async () => {
    const root = directoryHolding(['a.md'])

    expect(await directoryTree(root, unbounded).entries('absent')).toEqual([])
  })

  it('reads a file back through the path it reported', async () => {
    const root = directoryHolding(['CLAUDE.md'])

    expect(await directoryTree(root, unbounded).read('CLAUDE.md')).toContain('content of CLAUDE.md')
  })

  it('answers null for a path it cannot read, rather than throwing', async () => {
    const root = directoryHolding(['a.md'])

    expect(await directoryTree(root, unbounded).read('absent.md')).toBeNull()
  })

  it('refuses to read once the budget was already spent before the call', async () => {
    const root = directoryHolding(['a.md'])
    const controller = new AbortController()
    controller.abort(new Error('budget spent before the call'))

    await expect(directoryTree(root, controller.signal).read('a.md')).rejects.toThrow(
      'budget spent before the call',
    )
  })

  it('stops a walk already in flight once the budget is spent, rather than finishing it', async () => {
    const root = directoryHolding(['nested/a.md'])
    const controller = new AbortController()
    const tree = directoryTree(root, controller.signal)

    const reading = tree.entries('')
    queueMicrotask(() => controller.abort(new Error('budget spent mid-walk')))

    await expect(reading).rejects.toThrow('budget spent mid-walk')
  })
})
