import type { AxisVocabulary } from '../../models/axis.model.js'
import type { HarnessScan } from './harness-scan.js'

type SetVocabulary = Extract<AxisVocabulary, { kind: 'set' }>

// SAFETY: The capability set a collector may publish, or `null` when the axis must stay unobserved.
// A set has no per-member "unknown", so an undecided capability costs the whole axis: publishing
// the set without it would read as a practice gap nobody observed, which is the outcome
// `project-brief.md` forbids outright. It costs only what this model can rank, since an unrankable
// term hides nothing the report could have carried.
export function decidedCapabilities(
  scan: HarnessScan,
  scale: SetVocabulary,
): readonly string[] | null {
  const rankable = (member: string): boolean => scale.members.includes(member)

  // `some`, never a truthiness test — an empty array is truthy.
  if (scan.undecidable.some(rankable)) return null

  // Dropped rather than invented: a term outside the loaded scale is one it cannot rank.
  return scan.capabilities.filter(rankable)
}
