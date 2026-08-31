import type { HarnessTree, HarnessTreeEntry } from './harness-tree.js'
import type { ProvenPaths } from './member-scan.js'

// SAFETY: Every table here is closed, and matched by exact name: `prompt-*.md` would let
// `prompt-toolkit-notes.md` prove `prompts`. A capability whose artifact sits off a table is
// omitted from a set still published `CONFIRMED`, which reads as a practice gap nobody saw.

// A named file matches anywhere in the tracked tree: an artifact counts wherever it sits.
const TRANSCRIPT_FILES = ['session.md', 'prompt-history.md', '.aider.chat.history.md']

// A named directory matches at the root only.
const TRANSCRIPT_DIRECTORIES = ['.specstory/', '.claude/history/']

const CONTEXT_FILES = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.github/copilot-instructions.md']

const CONTEXT_DIRECTORIES = ['aidd_docs/memory/', 'docs/context/', '.ai/']

const BEHAVIOR_DIRECTORIES = [
  '.claude/rules/',
  '.claude/agents/',
  '.claude/hooks/',
  '.claude/skills/',
  '.cursor/rules/',
  '.github/agents/',
]

const BEHAVIOR_FILES = ['.cursorrules', '.windsurfrules']

// JSON only: a name here promises the recogniser below can read the file, schema and all.
const SETTINGS_FILES = [
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.cursor/environment.json',
  '.gemini/settings.json',
]

export function provesPrompts(tracked: readonly string[]): readonly string[] {
  return matchingPaths(tracked, TRANSCRIPT_FILES, TRANSCRIPT_DIRECTORIES)
}

export function provesContextEngineering(tracked: readonly string[]): readonly string[] {
  return matchingPaths(tracked, CONTEXT_FILES, CONTEXT_DIRECTORIES)
}

export async function provesBehavior(
  tree: HarnessTree,
  tracked: readonly HarnessTreeEntry[],
  signal: AbortSignal,
): Promise<ProvenPaths> {
  const paths = tracked.map((entry) => entry.path)
  const matched = matchingPaths(paths, BEHAVIOR_FILES, BEHAVIOR_DIRECTORIES)
  if (matched.length > 0) return { paths: matched, undecidable: false }
  return declaresPermissions(tree, paths, signal)
}

// An empty allow/deny list is an observation; an unreadable or unparseable file is not.
async function declaresPermissions(
  tree: HarnessTree,
  tracked: readonly string[],
  signal: AbortSignal,
): Promise<ProvenPaths> {
  let undecidable = false

  for (const settings of SETTINGS_FILES) {
    if (!tracked.includes(settings)) continue
    signal.throwIfAborted()

    const content = await tree.read(settings)
    if (content === null) {
      undecidable = true
      continue
    }

    const document = parseSettings(content)
    if (!document.parsed) {
      undecidable = true
      continue
    }

    if (declaresPermissionList(document.value)) return { paths: [settings], undecidable: false }
  }

  return { paths: [], undecidable }
}

type ParsedSettings =
  | { readonly parsed: true; readonly value: unknown }
  | { readonly parsed: false }

function parseSettings(content: string): ParsedSettings {
  try {
    return { parsed: true, value: JSON.parse(content) }
  } catch {
    return { parsed: false }
  }
}

// By shape, not by any tool's schema: covering another takes its filename and its shape.
function declaresPermissionList(settings: unknown): boolean {
  if (typeof settings !== 'object' || settings === null) return false

  const permissions = (settings as { permissions?: unknown }).permissions
  if (typeof permissions !== 'object' || permissions === null) return false

  const { allow, deny } = permissions as { allow?: unknown; deny?: unknown }
  return isNonEmptyArray(allow) || isNonEmptyArray(deny)
}

const isNonEmptyArray = (value: unknown): boolean => Array.isArray(value) && value.length > 0

// INVARIANT: One pass over the tracked list, checked against both tables together: the result
// stays in tree order and needs no deduplication, and it agrees with the boolean predicates it
// replaced because `some(p)` and `filter(p).length > 0` decide the same thing.
function matchingPaths(
  tracked: readonly string[],
  names: readonly string[],
  directories: readonly string[],
): readonly string[] {
  return tracked.filter(
    (file) =>
      matchesFileNamedAnywhere(file, names) || matchesPathUnderRootDirectory(file, directories),
  )
}

// Matched on whole path segments, so `prompt-toolkit-notes.md` is not `prompt-history.md`.
const matchesFileNamedAnywhere = (file: string, names: readonly string[]): boolean =>
  names.some((name) => file === name || file.endsWith(`/${name}`))

const matchesPathUnderRootDirectory = (file: string, directories: readonly string[]): boolean =>
  directories.some((directory) => file.startsWith(directory))
