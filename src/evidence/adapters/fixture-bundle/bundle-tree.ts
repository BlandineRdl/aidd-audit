import { readdir, readFile, open } from 'node:fs/promises'
import { join } from 'node:path'
import type { HarnessTree, HarnessTreeEntry } from '../harness/harness-tree.js'

// INVARIANT: `repo-context/` is the recorded repository's root, so a path under it is reported
// without the prefix and a root-anchored name — `docs/context/`, `.claude/rules/` — matches there.
// Every other path keeps its bundle-relative form, which is what lets a transcript filed beside the
// record rather than inside the recorded tree still prove what it proves.
const RECORDED_ROOT = 'repo-context/'

export async function bundleTree(bundlePath: string, signal: AbortSignal): Promise<HarnessTree> {
  const files = await walk(bundlePath, signal)

  // SAFETY: A bundle-root file and its namesake under the recorded root claim one recorded path,
  // and only reads are decided by it: name matching cannot tell the two apart either way.
  const sources = new Map<string, string>()
  const entries: HarnessTreeEntry[] = []

  for (const file of files) {
    const path = recordedPath(file)
    if (sources.has(path)) continue
    sources.set(path, join(bundlePath, file))
    entries.push({ path, regularFile: true, executable: null })
  }

  return {
    entries: async () => entries,
    probe: (path, bytes) => probeFile(sources.get(path), bytes),
    read: (path) => readWholeFile(sources.get(path)),
  }
}

function recordedPath(file: string): string {
  return file.startsWith(RECORDED_ROOT) ? file.slice(RECORDED_ROOT.length) : file
}

// INVARIANT: Sorted by codepoint, never by collation, so a bundle reads the same way on any
// machine. Symlinks are skipped: a bundle records files, and following one would read outside what
// it recorded.
async function walk(root: string, signal: AbortSignal, prefix = ''): Promise<readonly string[]> {
  signal.throwIfAborted()

  const listing = await readdir(join(root, prefix), { withFileTypes: true })
  const files: string[] = []

  for (const entry of [...listing].sort((left, right) => (left.name < right.name ? -1 : 1))) {
    const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) files.push(...(await walk(root, signal, path)))
    else if (entry.isFile()) files.push(path)
  }

  return files
}

async function probeFile(absolute: string | undefined, bytes: number): Promise<string | null> {
  if (absolute === undefined) return null

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

async function readWholeFile(absolute: string | undefined): Promise<string | null> {
  if (absolute === undefined) return null
  try {
    return await readFile(absolute, 'utf8')
  } catch {
    return null
  }
}
