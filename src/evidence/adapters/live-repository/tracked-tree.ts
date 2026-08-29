import { open, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { HarnessTree, HarnessTreeEntry } from '../harness/harness-tree.js'
import { runGit } from './git-process.js'

/**
 * The `HarnessTree` over a Git work tree: `git ls-files` for the listing, `join(root, path)`
 * for a read. The root is resolved once and reused, so a subject naming a subdirectory of the
 * tree still opens files relative to the tree it was resolved against.
 */
export async function trackedTree(path: string, signal: AbortSignal): Promise<HarnessTree> {
  let root: Promise<string> | null = null
  const resolvedRoot = (): Promise<string> => {
    root ??= repositoryRoot(path, signal)
    return root
  }

  return {
    async entries(): Promise<readonly HarnessTreeEntry[]> {
      const tracked = await listTrackedEntries(await resolvedRoot(), signal)
      return tracked.map((entry) => ({
        path: entry.path,
        regularFile: isRegularFileMode(entry.mode),
        executable: isExecutableMode(entry.mode),
      }))
    },
    async probe(entryPath: string, bytes: number): Promise<string | null> {
      return probeFile(join(await resolvedRoot(), entryPath), bytes)
    },
    async read(entryPath: string): Promise<string | null> {
      return readTextFile(join(await resolvedRoot(), entryPath))
    },
  }
}

/**
 * The subject may name a subdirectory, and `git ls-files` lists only what sits under its
 * working directory while the Git-derived axes walk the whole history: left to disagree, a
 * root `CLAUDE.md` goes unseen from `packages/api`. Reading from the root keeps listed paths
 * and opened paths in one frame; listing repository-wide would make every root file unread.
 */
async function repositoryRoot(path: string, signal: AbortSignal): Promise<string> {
  return (await runGit(path, ['rev-parse', '--show-toplevel'], signal)).trim()
}

/**
 * The mode is the one Git recorded, never the one the working copy carries: a clone with
 * `core.fileMode=false` reads `0644` off a `100755` file, failing `scanHarness`'s candidate gate.
 */
interface TrackedEntry {
  readonly path: string
  readonly mode: string
}

async function listTrackedEntries(
  root: string,
  signal: AbortSignal,
): Promise<readonly TrackedEntry[]> {
  const listing = await runGit(root, ['ls-files', '-s', '-z'], signal)

  return listing
    .split('\0')
    .filter((entry) => entry.length > 0)
    .flatMap((entry) => {
      // `<mode> <object> <stage>\t<path>`, and `-z` leaves the path unquoted.
      const separator = entry.indexOf('\t')
      const mode = entry.slice(0, entry.indexOf(' '))
      if (separator === -1 || mode.length === 0) return []
      return [{ path: entry.slice(separator + 1), mode }]
    })
}

/** `100644` and `100755` are blobs in this tree; `120000` is a symlink, `160000` a submodule. */
const isRegularFileMode = (mode: string): boolean => mode.startsWith('100')
const isExecutableMode = (mode: string): boolean => mode === '100755'

/**
 * The probe reads only its first `bytes` bytes, so a candidacy check never loads a whole file.
 * One `try` covers open, read and close, so any failure is one unreadable source.
 */
async function probeFile(absolute: string, bytes: number): Promise<string | null> {
  let handle: Awaited<ReturnType<typeof open>> | null = null
  try {
    handle = await open(absolute, 'r')
    const buffer = Buffer.alloc(bytes)
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0)
    return buffer.subarray(0, bytesRead).toString('utf8')
  } catch {
    return null
  } finally {
    try {
      await handle?.close()
    } catch {
      // A file that cannot be closed cleanly still told us what we read.
    }
  }
}

async function readTextFile(absolute: string): Promise<string | null> {
  try {
    return await readFile(absolute, 'utf8')
  } catch {
    return null
  }
}
