import type { HarnessTree } from './harness-tree.js'
import { basenameOf } from './shell-tokens.js'

// Only shell is reliably recognisable, so only shell is decidable.
const SHELL_INTERPRETERS = ['sh', 'bash', 'zsh']

const SHELL_EXTENSIONS = ['.sh', '.bash', '.zsh']

// Enough to hold any shebang line; a script is only read in full once it is a candidate.
const SHEBANG_PROBE_BYTES = 256

type ScriptCandidate =
  | { readonly outcome: 'not-a-script' }
  | { readonly outcome: 'unreadable' }
  | { readonly outcome: 'script'; readonly content: string; readonly shell: boolean }

// Either read returning null means the file was not read, the same outcome whichever failed.
export async function readScriptCandidate(
  tree: HarnessTree,
  path: string,
  executable: boolean | null,
): Promise<ScriptCandidate> {
  const head = await tree.probe(path, SHEBANG_PROBE_BYTES)
  if (head === null) return { outcome: 'unreadable' }

  const shell = hasShellShebang(head)
  // COMPAT: A tree recording no mode has only the shebang to go on, so any interpreter counts
  // there. Reading such a file as not-a-script would drop `loops` from a published set, a practice
  // gap, where undecidable is the evidence gap the situation actually is.
  if (!shell && !(executable ?? hasShebang(head))) return { outcome: 'not-a-script' }

  const content = await tree.read(path)
  if (content === null) return { outcome: 'unreadable' }

  return { outcome: 'script', content, shell }
}

const hasShebang = (head: string): boolean => head.startsWith('#!')

function hasShellShebang(head: string): boolean {
  const firstLine = head.split('\n', 1)[0] ?? ''
  if (!firstLine.startsWith('#!')) return false

  return firstLine
    .slice(2)
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .some((word) => SHELL_INTERPRETERS.includes(basenameOf(word)))
}

export const hasShellExtension = (file: string): boolean =>
  SHELL_EXTENSIONS.some((extension) => file.endsWith(extension))
