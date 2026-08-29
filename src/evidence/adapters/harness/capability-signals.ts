import type { HarnessTree, HarnessTreeEntry } from './harness-tree.js'
import { DECIDED_PRESENT, type MemberScan } from './member-scan.js'

/** Every table here is closed, and matched by exact name: `prompt-*.md` would let
 *  `prompt-toolkit-notes.md` prove `prompts`. A capability whose artifact sits off a table is
 *  omitted from a set still published `CONFIRMED`, which reads as a practice gap nobody saw. */

/** A named file matches anywhere in the tracked tree: an artifact counts wherever it sits. */
const TRANSCRIPT_FILES = ['session.md', 'prompt-history.md', '.aider.chat.history.md']

/** A named directory matches at the root only. */
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

/** JSON only: a name here promises the recogniser below can read the file, schema and all. */
const SETTINGS_FILES = [
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.cursor/environment.json',
  '.gemini/settings.json',
]

export function provesPrompts(tracked: readonly string[]): boolean {
  return (
    holdsFileNamedAnywhere(tracked, TRANSCRIPT_FILES) ||
    holdsPathUnderRootDirectory(tracked, TRANSCRIPT_DIRECTORIES)
  )
}

export function provesContextEngineering(tracked: readonly string[]): boolean {
  return (
    holdsFileNamedAnywhere(tracked, CONTEXT_FILES) ||
    holdsPathUnderRootDirectory(tracked, CONTEXT_DIRECTORIES)
  )
}

export async function provesBehavior(
  tree: HarnessTree,
  tracked: readonly HarnessTreeEntry[],
  signal: AbortSignal,
): Promise<MemberScan> {
  const paths = tracked.map((entry) => entry.path)
  if (holdsPathUnderRootDirectory(paths, BEHAVIOR_DIRECTORIES)) return DECIDED_PRESENT
  if (holdsFileNamedAnywhere(paths, BEHAVIOR_FILES)) return DECIDED_PRESENT
  return declaresPermissions(tree, paths, signal)
}

/** An empty allow/deny list is an observation; an unreadable or unparseable file is not. */
async function declaresPermissions(
  tree: HarnessTree,
  tracked: readonly string[],
  signal: AbortSignal,
): Promise<MemberScan> {
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

    if (declaresPermissionList(document.value)) return DECIDED_PRESENT
  }

  return { proven: false, undecidable }
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

/** By shape, not by any tool's schema: covering another takes its filename and its shape. */
function declaresPermissionList(settings: unknown): boolean {
  if (typeof settings !== 'object' || settings === null) return false

  const permissions = (settings as { permissions?: unknown }).permissions
  if (typeof permissions !== 'object' || permissions === null) return false

  const { allow, deny } = permissions as { allow?: unknown; deny?: unknown }
  return isNonEmptyArray(allow) || isNonEmptyArray(deny)
}

const isNonEmptyArray = (value: unknown): boolean => Array.isArray(value) && value.length > 0

/** Matched on whole path segments, so `prompt-toolkit-notes.md` is not `prompt-history.md`. */
const holdsFileNamedAnywhere = (tracked: readonly string[], names: readonly string[]): boolean =>
  tracked.some((file) => names.some((name) => file === name || file.endsWith(`/${name}`)))

const holdsPathUnderRootDirectory = (
  tracked: readonly string[],
  directories: readonly string[],
): boolean => tracked.some((file) => directories.some((directory) => file.startsWith(directory)))
