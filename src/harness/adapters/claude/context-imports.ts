export interface ResolvedImport {
  readonly path: string
  readonly content: string | null
}

// COMPAT: the tool's own convention — https://code.claude.com/docs/en/context-window.md — is
// recursive to a maximum depth of four, resolved relative to the importing file rather than to
// any working directory. The bound is the tool's, not chosen here.
export const IMPORT_DEPTH_LIMIT = 4

const FENCE = /^```/
const BACKTICK_SPAN = /`[^`\n]*`/g
const MACHINE_IMPORT_PREFIX = '~/.claude/'

// INVARIANT: an import mentioned inside a fenced block or an inline backtick span is not a real
// import — both are masked to blank before the scan, never merely skipped by position, so a token
// that would otherwise match is destroyed before it can be found either way.
function withoutQuotedText(content: string): string {
  const kept: string[] = []
  let inFence = false
  for (const line of content.split('\n')) {
    if (FENCE.test(line.trim())) {
      inFence = !inFence
      kept.push('')
      continue
    }
    if (inFence) {
      kept.push('')
      continue
    }
    kept.push(line.replace(BACKTICK_SPAN, (span) => ' '.repeat(span.length)))
  }
  return kept.join('\n')
}

function importsIn(content: string): readonly string[] {
  const found: string[] = []
  for (const line of withoutQuotedText(content).split('\n')) {
    for (const token of line.split(/\s+/)) {
      if (token.startsWith('@') && token.length > 1) found.push(token.slice(1))
    }
  }
  return found
}

// INVARIANT: resolved relative to the file that names the import, never to a working directory —
// the same import token means a different file depending on which file wrote it.
function resolveRelative(fromPath: string, importPath: string): string {
  if (importPath.startsWith(MACHINE_IMPORT_PREFIX)) return importPath

  const machinePath = fromPath.startsWith(MACHINE_IMPORT_PREFIX)
  const fromDir = machinePath
    ? fromPath.slice(0, fromPath.lastIndexOf('/') + 1)
    : fromPath.includes('/')
      ? fromPath.slice(0, fromPath.lastIndexOf('/'))
      : ''
  const combined = fromDir === '' ? importPath : `${fromDir}/${importPath}`

  if (machinePath) {
    const relative = combined.slice(MACHINE_IMPORT_PREFIX.length)
    return `${MACHINE_IMPORT_PREFIX}${normalisePath(relative)}`
  }

  return normalisePath(combined)
}

function normalisePath(combined: string): string {
  const resolved: string[] = []
  for (const segment of combined.split('/')) {
    if (segment === '.' || segment === '') continue
    if (segment === '..') resolved.pop()
    else resolved.push(segment)
  }
  return resolved.join('/')
}

// INVARIANT: `visited` is seeded with the entry file's own path before anything is followed, so a
// cycle that leads back to the entry — A imports B, B imports A — is recognised as already seen
// rather than re-read and re-expanded. Every other file is counted exactly once, however many
// times it is reached, because it is added to `visited` the moment it is first found rather than
// after it is read.
export async function followImports(
  entryPath: string,
  entryContent: string,
  read: (path: string) => Promise<string | null>,
): Promise<readonly ResolvedImport[]> {
  const visited = new Set<string>([entryPath])
  const found = new Map<string, ResolvedImport>()

  async function collect(path: string, content: string, depth: number): Promise<void> {
    for (const rawImport of importsIn(content)) {
      const resolved = resolveRelative(path, rawImport)
      if (visited.has(resolved)) continue
      visited.add(resolved)

      const importedContent = await read(resolved)
      found.set(resolved, { path: resolved, content: importedContent })

      // LIMITATION: a named but missing import is recorded with `content: null` and never
      // expanded further — there is nothing to follow imports out of. That is what tells it apart
      // from a file that was read and found empty, which would carry `content: ''`.
      if (importedContent !== null && depth < IMPORT_DEPTH_LIMIT) {
        await collect(resolved, importedContent, depth + 1)
      }
    }
  }

  await collect(entryPath, entryContent, 1)
  return [...found.values()]
}
