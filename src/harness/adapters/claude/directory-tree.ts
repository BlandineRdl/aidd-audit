import type { Dirent } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { HarnessTree, HarnessTreeEntry } from './harness-tree.js'

// INVARIANT: skipped by name rather than by content — these are never files the loading
// convention itself would read: version-control internals, a stray dependency tree, editor and
// OS artefacts, and any dotfile or dot-directory nested under a scanned directory. A file the
// convention would actually load is never excluded here.
const NEVER_LOADED = new Set(['node_modules', '.git', '.DS_Store'])

function isSkipped(name: string): boolean {
  return NEVER_LOADED.has(name) || name.startsWith('.')
}

// INVARIANT: the audit reads a directory rather than a tracked tree, unlike
// evidence/adapters/live-repository — an unstaged context file still costs a session its tokens,
// so what Git has or has not staged must not decide what is measured.
export function directoryTree(root: string, signal: AbortSignal): HarnessTree {
  return {
    entries: (directory: string) => walk(root, directory, signal),
    read: async (path: string): Promise<string | null> => {
      signal.throwIfAborted()
      try {
        return await readFile(join(root, path), 'utf8')
      } catch {
        return null
      }
    },
  }
}

// SAFETY: the signal is checked at the start of every recursive call, not only before the walk
// begins — a check placed solely in `directoryTree` above would let a walk already in flight run
// to completion once started, which is exactly the shallow guard this project has been caught by
// before (see aidd_docs/memory/testing.md).
async function walk(
  root: string,
  directory: string,
  signal: AbortSignal,
): Promise<readonly HarnessTreeEntry[]> {
  signal.throwIfAborted()

  let listing: readonly Dirent[]
  try {
    listing = await readdir(join(root, directory), { withFileTypes: true })
  } catch {
    return []
  }

  const entries: HarnessTreeEntry[] = []
  for (const entry of listing) {
    if (isSkipped(entry.name)) continue
    const path = directory === '' ? entry.name : `${directory}/${entry.name}`
    if (entry.isDirectory()) {
      entries.push(...(await walk(root, path, signal)))
    } else if (entry.isFile()) {
      entries.push({ path })
    }
  }
  return entries
}
