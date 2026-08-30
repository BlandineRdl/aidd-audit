import type { AxisId, AxisVocabulary } from '../../models/axis.model.js'
import type { Demonstration, Observation, ObservedValue } from '../../models/observation.model.js'
import type { ForgeDerivedMetrics } from './pull-request-history.js'

// INVARIANT: One projection of `ForgeDerivedMetrics` onto observations, with two callers —
// `ForgeRepositoryEvidenceCollector`, and the per-contributor roster adapter. `collectorId` is a
// parameter rather than a constant so neither caller's observations claim to have come from the
// other, and `basis` names whose sample earned the reading: the repository's merged pull requests,
// or one account's own.
export function deriveObservations(
  metrics: ForgeDerivedMetrics,
  vocabulary: readonly AxisVocabulary[],
  collectorId: string,
  basis: string,
): readonly Observation[] {
  const sizeScale = scaleFor(vocabulary, 'size')
  const interventionScale = scaleFor(vocabulary, 'intervention')
  const parallelismScale = scaleFor(vocabulary, 'parallelism')

  const observations: Observation[] = []

  if (
    metrics.sizeBucket !== null &&
    sizeScale?.kind === 'ordinal' &&
    sizeScale.values.includes(metrics.sizeBucket)
  ) {
    observations.push(
      observation(collectorId, 'size', metrics.sizeBucket, `median delivered change over ${basis}`),
    )
  }

  if (
    metrics.demonstratedSize !== null &&
    sizeScale?.kind === 'ordinal' &&
    sizeScale.values.includes(metrics.demonstratedSize.value)
  ) {
    observations.push(
      demonstrated(
        collectorId,
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
        collectorId,
        'intervention',
        metrics.intervention,
        `median corrective commits after opening, over ${basis}`,
      ),
    )
  }

  if (
    metrics.demonstratedIntervention !== null &&
    interventionScale?.kind === 'ordinal' &&
    interventionScale.values.includes(metrics.demonstratedIntervention.value)
  ) {
    observations.push(
      demonstrated(
        collectorId,
        'intervention',
        metrics.demonstratedIntervention.value,
        { share: metrics.demonstratedIntervention.share, unit: 'DELIVERIES' },
        `corrective commits after opening, over ${basis}`,
      ),
    )
  }

  if (metrics.parallelism !== null && parallelismScale?.kind === 'numeric') {
    observations.push(
      observation(
        collectorId,
        'parallelism',
        metrics.parallelism,
        `median, over active days, of distinct ${basis} receiving a commit`,
      ),
    )
  }

  if (metrics.demonstratedParallelism !== null && parallelismScale?.kind === 'numeric') {
    observations.push(
      demonstrated(
        collectorId,
        'parallelism',
        metrics.demonstratedParallelism.value,
        { share: metrics.demonstratedParallelism.share, unit: 'ACTIVE_DAYS' },
        `concurrent ${basis} carried on at least a third of active days`,
      ),
    )
  }

  return observations
}

export function scaleFor(
  vocabulary: readonly AxisVocabulary[],
  axis: AxisId,
): AxisVocabulary | undefined {
  return vocabulary.find((scale) => scale.axis === axis)
}

function observation(
  collectorId: string,
  axis: AxisId,
  value: ObservedValue,
  basis: string,
): Observation {
  return {
    axis,
    reading: 'SUSTAINED',
    value,
    kind: 'OBSERVED',
    collector: collectorId,
    basis,
    demonstration: null,
  }
}

// INVARIANT: a demonstrated value never travels without the share that earned it.
function demonstrated(
  collectorId: string,
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
    collector: collectorId,
    basis,
    demonstration,
  }
}
