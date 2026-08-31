import type { HarnessTree, HarnessTreeEntry } from './harness-tree.js'
import { provesBehavior, provesContextEngineering, provesPrompts } from './capability-signals.js'
import { looksLikeAnAgentInvocation } from './agent-invocation.js'
import type { ProvenPaths } from './member-scan.js'
import { hasShellExtension, readScriptCandidate } from './script-candidate.js'
import { readShellLoops } from './shell-loop.js'

export interface HarnessScan {
  // A union set, incomplete while `undecidable` names any member.
  readonly capabilities: readonly string[]
  readonly undecidable: readonly string[]
  // INVARIANT: `kind: 'files'` never holds an empty list — a member proven by no file reports
  // `'commit-trailer'` or `'nothing'` instead, so an empty array can never be misread as "the
  // collector looked and found none". A member carries a proof other than `'nothing'` exactly when
  // it appears in `capabilities`.
  readonly provenBy: Readonly<Record<HarnessMember, HarnessProof>>
}

export type HarnessMember = 'prompts' | 'context-engineering' | 'behavior' | 'loops'

// The vocabulary, and the order both lists are reported in.
const HARNESS_MEMBERS: readonly HarnessMember[] = [
  'prompts',
  'context-engineering',
  'behavior',
  'loops',
]

export type HarnessProof =
  | { readonly kind: 'files'; readonly paths: readonly string[] }
  | { readonly kind: 'commit-trailer' }
  | { readonly kind: 'nothing' }

const NOTHING_PROVEN: HarnessProof = { kind: 'nothing' }

const proofOf = (paths: readonly string[]): HarnessProof =>
  paths.length > 0 ? { kind: 'files', paths } : NOTHING_PROVEN

// INVARIANT: `hasAiAttributionTrailer` comes from the commit walk with three answers: `true` proves
// `prompts` on its own, with no transcript file in the tree; `false` is a history read and holding
// none; `null` is a history unread, which makes `prompts` undecidable unless the tree proves it
// another way. The tree is read first and the trailer only falls back when no file matched, so a
// repository proving `prompts` both ways still names the file — the trailer proves nothing
// attributable and is never reported once a path can be.
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
  const provenBy: Record<HarnessMember, HarnessProof> = {
    prompts: NOTHING_PROVEN,
    'context-engineering': NOTHING_PROVEN,
    behavior: NOTHING_PROVEN,
    loops: NOTHING_PROVEN,
  }

  const promptPaths = provesPrompts(paths)
  if (promptPaths.length > 0) {
    capabilities.push('prompts')
    provenBy.prompts = { kind: 'files', paths: promptPaths }
  } else if (hasAiAttributionTrailer === true) {
    capabilities.push('prompts')
    provenBy.prompts = { kind: 'commit-trailer' }
  } else if (hasAiAttributionTrailer === null) {
    undecidable.add('prompts')
  }

  const contextPaths = provesContextEngineering(paths)
  if (contextPaths.length > 0) {
    capabilities.push('context-engineering')
    provenBy['context-engineering'] = { kind: 'files', paths: contextPaths }
  }

  signal.throwIfAborted()
  const behavior = await provesBehavior(tree, tracked, signal)
  if (behavior.paths.length > 0) capabilities.push('behavior')
  if (behavior.undecidable) undecidable.add('behavior')
  provenBy.behavior = proofOf(behavior.paths)

  signal.throwIfAborted()
  const scripts = await scanScripts(tree, tracked, signal)
  if (scripts.paths.length > 0) capabilities.push('loops')
  if (scripts.undecidable) undecidable.add('loops')
  provenBy.loops = proofOf(scripts.paths)

  // INVARIANT: A member already proven by another route suppresses undecidability about it: nothing
  // is hidden once the set is known to contain it.
  return {
    capabilities,
    undecidable: HARNESS_MEMBERS.filter(
      (member) => undecidable.has(member) && !capabilities.includes(member),
    ),
    provenBy,
  }
}

// SAFETY: Undecidable rather than absent, on every route out: reporting absence would tell a
// developer who built a loop to go build one.

// LIMITATION: Names the first script that proves `loops`, never every one that does. A tree with
// two retry scripts attributes the capability to the first in tree order alone; reading past a
// proven loop to attribute the rest would mean opening every remaining file in the tree, which the
// invariant below refuses. Fix, if ever needed, belongs here — collecting every proving path instead
// of stopping at the first.
async function scanScripts(
  tree: HarnessTree,
  tracked: readonly HarnessTreeEntry[],
  signal: AbortSignal,
): Promise<ProvenPaths> {
  let provingPath: string | null = null
  let undecidable = false

  for (const entry of tracked) {
    // INVARIANT: once `loops` is proven nothing later can change the answer — `scanHarness`
    // suppresses undecidability about a member already in `capabilities`, and this scan reports no
    // other member. Reading on would open every remaining file in the tree for nothing.
    if (provingPath !== null) break

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
      if (shell.proven) provingPath = entry.path
      if (shell.undecidable) undecidable = true
    } else if (looksLikeAnAgentInvocation(candidate.content)) {
      undecidable = true
    }
  }

  return { paths: provingPath === null ? [] : [provingPath], undecidable }
}
