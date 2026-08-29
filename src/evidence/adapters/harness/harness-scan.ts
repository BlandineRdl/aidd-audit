import type { HarnessTree, HarnessTreeEntry } from './harness-tree.js'
import { provesBehavior, provesContextEngineering, provesPrompts } from './capability-signals.js'
import { looksLikeAnAgentInvocation } from './agent-invocation.js'
import type { MemberScan } from './member-scan.js'
import { hasShellExtension, readScriptCandidate } from './script-candidate.js'
import { readShellLoops } from './shell-loop.js'

export interface HarnessScan {
  // A union set, incomplete while `undecidable` names any member.
  readonly capabilities: readonly string[]
  readonly undecidable: readonly string[]
}

type HarnessMember = 'prompts' | 'context-engineering' | 'behavior' | 'loops'

// The vocabulary, and the order both lists are reported in.
const HARNESS_MEMBERS: readonly HarnessMember[] = [
  'prompts',
  'context-engineering',
  'behavior',
  'loops',
]

// INVARIANT: `hasAiAttributionTrailer` comes from the commit walk with three answers: `true` proves
// `prompts` on its own, with no transcript file in the tree; `false` is a history read and holding
// none; `null` is a history unread, which makes `prompts` undecidable unless the tree proves it
// another way.
export async function scanHarness(
  tree: HarnessTree,
  hasAiAttributionTrailer: boolean | null,
  signal: AbortSignal,
): Promise<HarnessScan> {
  signal.throwIfAborted()

  const tracked = await tree.entries()
  const paths = tracked.map((entry) => entry.path)

  const capabilities: string[] = []
  const undecidable = new Set<HarnessMember>()

  if (hasAiAttributionTrailer === true || provesPrompts(paths)) capabilities.push('prompts')
  if (hasAiAttributionTrailer === null) undecidable.add('prompts')

  if (provesContextEngineering(paths)) capabilities.push('context-engineering')

  signal.throwIfAborted()
  const behavior = await provesBehavior(tree, tracked, signal)
  if (behavior.proven) capabilities.push('behavior')
  if (behavior.undecidable) undecidable.add('behavior')

  signal.throwIfAborted()
  const scripts = await scanScripts(tree, tracked, signal)
  if (scripts.proven) capabilities.push('loops')
  if (scripts.undecidable) undecidable.add('loops')

  // INVARIANT: A member already proven by another route suppresses undecidability about it: nothing
  // is hidden once the set is known to contain it.
  return {
    capabilities,
    undecidable: HARNESS_MEMBERS.filter(
      (member) => undecidable.has(member) && !capabilities.includes(member),
    ),
  }
}

// SAFETY: Undecidable rather than absent, on every route out: reporting absence would tell a
// developer who built a loop to go build one.
async function scanScripts(
  tree: HarnessTree,
  tracked: readonly HarnessTreeEntry[],
  signal: AbortSignal,
): Promise<MemberScan> {
  let loops = false
  let undecidable = false

  for (const entry of tracked) {
    signal.throwIfAborted()

    if (!entry.regularFile) continue

    const candidate = await readScriptCandidate(tree, entry.path, entry.executable)
    if (candidate.outcome === 'not-a-script') continue
    if (candidate.outcome === 'unreadable') {
      undecidable = true
      continue
    }

    if (candidate.shell || hasShellExtension(entry.path)) {
      const shell = readShellLoops(candidate.content)
      if (shell.proven) loops = true
      if (shell.undecidable) undecidable = true
    } else if (looksLikeAnAgentInvocation(candidate.content)) {
      undecidable = true
    }
  }

  return { proven: loops, undecidable }
}
