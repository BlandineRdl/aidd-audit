import type { Dirent } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { isBundle } from '../../evidence/adapters/fixture-bundle/bundle-manifest.js'
import { isRepositoryRoot } from '../../evidence/adapters/live-repository/git-process.js'
import { UsageError } from '../usage.error.js'

export interface ResolvedSubjects {
  readonly subjects: readonly string[]
  readonly isWorkTreeRoot: boolean
  readonly isSet: boolean
}

// INVARIANT: the rule order decides arity — file, bundle, work-tree root, set, refusal — and stops
// at the first match. A work-tree root holding bundles must stay one subject even though it
// contains them, and a lone bundle must stay one subject even though it is a directory: ordering
// the checks is what makes both hold without either learning about the other. `isWorkTreeRoot` is
// answered truthfully regardless of which rule matched, so a directory that is both a bundle and a
// work-tree root — bundle wins the arity question — still reports the fact a real one, which is
// what lets it keep the exact collector set, forge included, it got before a set reading existed.
export async function resolveSubjects(
  path: string,
  signal: AbortSignal,
): Promise<ResolvedSubjects> {
  signal.throwIfAborted()

  const stats = await stat(path)
  if (stats.isFile()) {
    return { subjects: [path], isWorkTreeRoot: false, isSet: false }
  }

  if (await isBundle(path)) {
    return { subjects: [path], isWorkTreeRoot: await isRepositoryRoot(path, signal), isSet: false }
  }

  if (await isRepositoryRoot(path, signal)) {
    return { subjects: [path], isWorkTreeRoot: true, isSet: false }
  }

  const children = await childBundles(path, signal)
  if (children.length > 0) {
    return { subjects: children, isWorkTreeRoot: false, isSet: true }
  }

  throw new UsageError(
    `Subject path '${path}' is neither a repository, a recorded bundle, nor a directory with one sitting directly inside it.`,
  )
}

// INVARIANT: sorted by codepoint, so the same directory produces the same order on any machine.
// Exported so its own abort checkpoint can be driven directly — reached through `resolveSubjects`,
// it sits behind `isRepositoryRoot`'s own `git` spawn, which honours a pre-aborted signal first and
// leaves this loop's guard unprovable through that path alone.
export async function childBundles(path: string, signal: AbortSignal): Promise<readonly string[]> {
  const entries = await readEntries(path)
  const names = entries
    .map((entry) => entry.name)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))

  const bundles: string[] = []
  for (const name of names) {
    signal.throwIfAborted()
    const candidate = join(path, name)
    if (await isBundle(candidate)) bundles.push(candidate)
  }
  return bundles
}

// SAFETY: resolution is pre-flight, so a subject the caller cannot read is the caller's fault and
// exits `2`, like the subject that names nothing. Left raw it escaped as an errno and the taxonomy
// called it ours. A failure met later, *during* collection, stays the collector's: FAILED in
// provenance, exit `0`.
//
// INVARIANT: only the codes that describe the caller's path are claimed. `EMFILE` and `ENOMEM` say
// this process ran out of something, not that the path is wrong, and answering `2` would send a
// reader to check permissions that are fine. They stay ours.
const CALLER_FAULT_CODES: ReadonlySet<string> = new Set(['EACCES', 'EPERM', 'ENOENT', 'ENOTDIR'])

async function readEntries(path: string): Promise<readonly Dirent[]> {
  try {
    return await readdir(path, { withFileTypes: true })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === undefined || !CALLER_FAULT_CODES.has(code)) throw error
    throw new UsageError(`Subject path '${path}' could not be read (${code}).`)
  }
}
