import type { AxisId, AxisVocabulary } from '../models/axis.model.js'
import type { Demonstration, Observation, ObservedValue } from '../models/observation.model.js'
import type { CollectorContext, EvidenceCollector } from '../ports/evidence-collector.port.js'
import { readForgeDerivedMetrics } from './forge-repository/pull-request-history.js'
import type { RepositorySlug } from './forge-repository/repository-slug.js'
import { mostRecentCommitDate } from './live-repository/git-process.js'

const COLLECTOR_ID = 'forge-repository'

// INVARIANT: Evidence read from the forge that hosts the subject, over the network. It answers the
// three axes a merged pull request records and the merge graph can lose: a squash erases the branch
// but never the pull request. It never answers `harness`, which is a property of the tracked tree
// and needs no forge.
//
// INVARIANT: It is constructed with a slug the composition root already resolved, so it never
// decides for itself whether a subject is its own. That check belongs where the collector set is
// chosen, because a bundle tracked inside a repository would otherwise be handed the surrounding
// repository's pull requests.
export class ForgeRepositoryEvidenceCollector implements EvidenceCollector {
  readonly id = COLLECTOR_ID
  readonly supportedAxes: readonly AxisId[] = ['size', 'intervention', 'parallelism']

  constructor(private readonly slug: RepositorySlug) {}

  async collect(context: CollectorContext): Promise<readonly Observation[]> {
    context.signal.throwIfAborted()

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

    // INVARIANT: the subject's own most recent activity ends the window, not this source's newest
    // merge, so both production collectors measure the same period.
    const metrics = await readForgeDerivedMetrics(
      this.slug,
      await mostRecentCommitDate(context.path, context.signal),
      context.signal,
    )
    const observations: Observation[] = []
    const basis = `merged pull requests of ${this.slug.owner}/${this.slug.name}`

    if (
      metrics.sizeBucket !== null &&
      sizeScale?.kind === 'ordinal' &&
      sizeScale.values.includes(metrics.sizeBucket)
    ) {
      observations.push(
        observation('size', metrics.sizeBucket, `median delivered change over ${basis}`),
      )
    }

    if (
      metrics.demonstratedSize !== null &&
      sizeScale?.kind === 'ordinal' &&
      sizeScale.values.includes(metrics.demonstratedSize.value)
    ) {
      observations.push(
        demonstrated(
          'size',
          metrics.demonstratedSize.value,
          { share: metrics.demonstratedSize.share, unit: 'DELIVERIES' },
          `size reached by at least a third of ${basis}`,
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
          `median corrective commits after opening, over ${basis}`,
        ),
      )
    }

    if (metrics.parallelism !== null && parallelismScale?.kind === 'numeric') {
      observations.push(
        observation(
          'parallelism',
          metrics.parallelism,
          `median, over active days, of distinct ${basis} receiving a commit`,
        ),
      )
    }

    if (metrics.demonstratedParallelism !== null && parallelismScale?.kind === 'numeric') {
      observations.push(
        demonstrated(
          'parallelism',
          metrics.demonstratedParallelism.value,
          { share: metrics.demonstratedParallelism.share, unit: 'ACTIVE_DAYS' },
          `concurrent ${basis} carried on at least a third of active days`,
        ),
      )
    }

    return observations
  }
}

function scaleFor(vocabulary: readonly AxisVocabulary[], axis: AxisId): AxisVocabulary | undefined {
  return vocabulary.find((scale) => scale.axis === axis)
}

function observation(axis: AxisId, value: ObservedValue, basis: string): Observation {
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

// INVARIANT: a demonstrated value never travels without the share that earned it. Intervention has
// no such observation by decision: the forge sees when a pull request was opened, which on a subject
// with no review records a workflow habit rather than whether a human took over from the agent.
function demonstrated(
  axis: AxisId,
  value: ObservedValue,
  demonstration: Demonstration,
  basis: string,
): Observation {
  return {
    axis,
    reading: 'DEMONSTRATED',
    value,
    kind: 'OBSERVED',
    collector: COLLECTOR_ID,
    basis,
    demonstration,
  }
}
