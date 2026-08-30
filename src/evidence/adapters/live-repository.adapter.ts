import type { AxisId, AxisVocabulary } from '../models/axis.model.js'
import type { Observation, ObservedValue } from '../models/observation.model.js'
import {
  type CollectorCollection,
  type CollectorContext,
  type EvidenceCollector,
} from '../ports/evidence-collector.port.js'
import { readGitDerivedMetrics, hasAiAttributionTrailer } from './live-repository/git-history.js'
import { decidedCapabilities } from './harness/decided-capabilities.js'
import { scanHarness } from './harness/harness-scan.js'
import { GitCommandFailedError, isRepositoryRoot } from './live-repository/git-process.js'
import { trackedTree } from './live-repository/tracked-tree.js'

const COLLECTOR_ID = 'live-repository'

// INVARIANT: Evidence read from a local working copy, entirely offline. Every observation is
// `OBSERVED`. There is no `DECLARED` source by construction — the only declarative artifact in
// reach is prose, and prose is never parsed.
//
// LIMITATION: `intervention` is emitted upward only, and most histories will see nothing at all on
// it. No local object records *when* a human intervened relative to review, so every rank that
// turns on that stays out of reach here and belongs to a forge collector. What a local history does
// settle is whether a human intervened at all, and that only where an agent is attributed the work.
const EVERY_AXIS_IT_CAN_READ: readonly AxisId[] = ['size', 'harness', 'intervention', 'parallelism']

export class LiveRepositoryEvidenceCollector implements EvidenceCollector {
  readonly id = COLLECTOR_ID
  readonly supportedAxes: readonly AxisId[]

  // INVARIANT: The axes this collector was *built* to answer, which the composition root narrows
  // when a better source owns them. Narrowing here rather than dropping observations later is what
  // keeps `provenance` honest: it records what a collector was asked for, and a collector asked only
  // about the harness must not report having been asked about the rest.
  constructor(supportedAxes: readonly AxisId[] = EVERY_AXIS_IT_CAN_READ) {
    this.supportedAxes = supportedAxes
  }

  async collect(context: CollectorContext): Promise<CollectorCollection> {
    context.signal.throwIfAborted()

    // SAFETY: This collector reads one subject kind: a repository. Outside a work tree nothing is
    // readable, and *inside* one the subject must be the repository itself — a directory that
    // merely sits in a checkout is a different subject, and answering for it would publish the
    // surrounding repository's harness as that subject's own evidence. A fixture bundle tracked in
    // this repository is exactly that case. Either way nothing is emitted, which is UNKNOWN, an
    // evidence gap, and never an observation that the subject lacks a practice.
    if (!(await isRepositoryRoot(context.path, context.signal))) return emptyCollection()

    // INVARIANT: narrowing the vocabulary is the whole of the narrowing, because both sources
    // already return before they spawn anything when the scales they need are absent.
    const asked: CollectorContext = {
      ...context,
      vocabulary: context.vocabulary.filter((scale) => this.supportedAxes.includes(scale.axis)),
    }

    // The two sources fail independently, and one unreadable source must not cost the other.
    const [harness, git] = await Promise.all([collectHarness(asked), collectGitDerived(asked)])

    return { observations: [...harness, ...git], diagnostics: [] }
  }
}

function emptyCollection(): CollectorCollection {
  return { observations: [], diagnostics: [] }
}

async function collectHarness(context: CollectorContext): Promise<readonly Observation[]> {
  const scale = scaleFor(context.vocabulary, 'harness')
  if (scale?.kind !== 'set') return []

  try {
    const trailer = await hasAiAttributionTrailer(context.path, context.signal)
    const tree = await trackedTree(context.path, context.signal)
    const scan = await scanHarness(tree, trailer, context.signal)

    const capabilities = decidedCapabilities(scan, scale)
    if (capabilities === null) return []

    return [
      observation(
        'harness',
        capabilities,
        `tracked tree of ${context.path}, union of what was seen`,
      ),
    ]
  } catch (error) {
    return unobservedUnlessOurs(error, context)
  }
}

async function collectGitDerived(context: CollectorContext): Promise<readonly Observation[]> {
  const sizeScale = scaleFor(context.vocabulary, 'size')
  const interventionScale = scaleFor(context.vocabulary, 'intervention')
  const parallelismScale = scaleFor(context.vocabulary, 'parallelism')
  if (
    sizeScale === undefined &&
    interventionScale === undefined &&
    parallelismScale === undefined
  ) {
    return []
  }

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

    if (
      metrics.intervention !== null &&
      interventionScale?.kind === 'ordinal' &&
      interventionScale.values.includes(metrics.intervention)
    ) {
      observations.push(
        observation(
          'intervention',
          metrics.intervention,
          'delivered changes on the first-parent walk whose every commit is attributed to an agent',
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
    return unobservedUnlessOurs(error, context)
  }
}

// SAFETY: Three outcomes, not two. A spent budget rethrows, so the run is `TIMED_OUT`. A source that
// refused — `git` asked and said no — is an evidence gap: the axis goes unobserved. Anything else is
// a defect in this code, and returning `[]` for it would publish that defect as an absence nobody
// observed, on a run still reported `COMPLETED` with no reason. Rethrowing hands it to
// `runCollector`, which reports `FAILED` and carries the message.
function unobservedUnlessOurs(error: unknown, context: CollectorContext): readonly Observation[] {
  if (context.signal.aborted) throw error
  if (error instanceof GitCommandFailedError) return []
  throw error
}

function scaleFor(vocabulary: readonly AxisVocabulary[], axis: AxisId): AxisVocabulary | undefined {
  return vocabulary.find((scale) => scale.axis === axis)
}

function observation(axis: AxisId, value: ObservedValue, basis: string): Observation {
  // LIMITATION: a work tree carries no distribution. The first-parent walk gives one median per axis
  // and no record of how often the subject reached more, so only a forge answers that question.
  return {
    axis,
    reading: 'SUSTAINED',
    value,
    kind: 'OBSERVED',
    collector: COLLECTOR_ID,
    basis,
    demonstration: null,
  }
}
