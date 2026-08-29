import type { AxisId, AxisVocabulary } from '../models/axis.model.js'
import type { Observation, ObservedValue } from '../models/observation.model.js'
import type { CollectorContext, EvidenceCollector } from '../ports/evidence-collector.port.js'
import { readGitDerivedMetrics, hasAiAttributionTrailer } from './live-repository/git-history.js'
import { scanHarness } from './live-repository/harness-scan.js'
import { isRepositoryRoot } from './live-repository/git-process.js'

const COLLECTOR_ID = 'live-repository'

/**
 * Evidence read from a local working copy, entirely offline.
 *
 * It declares `intervention` and never emits it: `supportedAxes` is what a collector may
 * attempt, never what it delivered. No local history recovers that axis, merge histories
 * included, because a merge records that a branch landed and never what followed review.
 *
 * Every observation is `OBSERVED`. There is no `DECLARED` source by construction — the only
 * declarative artifact in reach is prose, and prose is never parsed.
 */
export class LiveRepositoryEvidenceCollector implements EvidenceCollector {
  readonly id = COLLECTOR_ID
  readonly supportedAxes: readonly AxisId[] = ['size', 'harness', 'intervention', 'parallelism']

  async collect(context: CollectorContext): Promise<readonly Observation[]> {
    context.signal.throwIfAborted()

    // This collector reads one subject kind: a repository. Outside a work tree nothing is
    // readable, and *inside* one the subject must be the repository itself — a directory
    // that merely sits in a checkout is a different subject, and answering for it would
    // publish the surrounding repository's harness as that subject's own evidence. A fixture
    // bundle tracked in this repository is exactly that case. Either way nothing is emitted,
    // which is UNKNOWN, an evidence gap, and never an observation that the subject lacks a
    // practice.
    if (!(await isRepositoryRoot(context.path, context.signal))) return []

    // The two sources fail independently, and one unreadable source must not cost the other.
    const [harness, git] = await Promise.all([collectHarness(context), collectGitDerived(context)])

    return [...harness, ...git]
  }
}

async function collectHarness(context: CollectorContext): Promise<readonly Observation[]> {
  const scale = scaleFor(context.vocabulary, 'harness')
  if (scale?.kind !== 'set') return []

  try {
    const trailer = await hasAiAttributionTrailer(context.path, context.signal)
    const scan = await scanHarness(context.path, trailer, context.signal)

    // A set has no per-member "unknown", so an undecided capability costs the whole axis:
    // publishing the set without it would read as a practice gap nobody observed. It costs
    // only what this model can rank, since an unrankable term hides nothing the report could
    // have carried. `some`, never a truthiness test — an empty array is truthy.
    const rankable = (member: string): boolean => scale.members.includes(member)
    if (scan.undecidable.some(rankable)) return []

    // Dropped rather than invented: a term outside the loaded scale is one it cannot rank.
    const capabilities = scan.capabilities.filter(rankable)

    return [
      observation(
        'harness',
        capabilities,
        `tracked tree of ${context.path}, union of what was seen`,
      ),
    ]
  } catch (error) {
    if (context.signal.aborted) throw error
    return []
  }
}

async function collectGitDerived(context: CollectorContext): Promise<readonly Observation[]> {
  const sizeScale = scaleFor(context.vocabulary, 'size')
  const parallelismScale = scaleFor(context.vocabulary, 'parallelism')
  if (sizeScale === undefined && parallelismScale === undefined) return []

  try {
    const metrics = await readGitDerivedMetrics(context.path, context.signal)
    const observations: Observation[] = []

    if (
      metrics.sizeBucket !== null &&
      sizeScale?.kind === 'ordinal' &&
      sizeScale.values.includes(metrics.sizeBucket)
    ) {
      observations.push(
        observation(
          'size',
          metrics.sizeBucket,
          'median delivered change on the first-parent walk, lower of the lines and files buckets',
        ),
      )
    }

    if (metrics.parallelism !== null && parallelismScale?.kind === 'numeric') {
      observations.push(
        observation(
          'parallelism',
          metrics.parallelism,
          'median, over active days, of distinct branches recovered from merge sides',
        ),
      )
    }

    return observations
  } catch (error) {
    if (context.signal.aborted) throw error
    return []
  }
}

function scaleFor(vocabulary: readonly AxisVocabulary[], axis: AxisId): AxisVocabulary | undefined {
  return vocabulary.find((scale) => scale.axis === axis)
}

function observation(axis: AxisId, value: ObservedValue, basis: string): Observation {
  return { axis, value, kind: 'OBSERVED', collector: COLLECTOR_ID, basis }
}
