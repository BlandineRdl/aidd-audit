import type { AxisId, AxisVocabulary } from '../models/axis.model.js'
import type { CollectorProvenance } from '../models/collector-provenance.model.js'
import type { Evidence } from '../models/observation.model.js'
import type {
  CollectorContext,
  CollectorRun,
  EvidenceCollector,
} from '../ports/evidence-collector.port.js'
import { resolveEvidence } from '../resolution/resolve-evidence.js'

export interface EvidenceCollectionRequest {
  readonly path: string
  readonly vocabulary: readonly AxisVocabulary[]
  readonly collectors: readonly EvidenceCollector[]
  readonly signal: AbortSignal
}

export interface EvidenceCollection {
  readonly evidence: readonly Evidence[]
  readonly provenance: readonly CollectorProvenance[]
}

interface CollectorOutcome {
  readonly run: CollectorRun
  readonly responsibleAxes: readonly AxisId[]
}

export async function collectEvidence(
  request: EvidenceCollectionRequest,
): Promise<EvidenceCollection> {
  const requestedAxes = request.vocabulary.map((scale) => scale.axis)
  const context: CollectorContext = {
    path: request.path,
    vocabulary: request.vocabulary,
    signal: request.signal,
  }

  const outcomes = await Promise.all(
    request.collectors.map((collector) => runCollector(collector, requestedAxes, context)),
  )

  // SAFETY: concatenate every run's observations unconditionally rather than filtering to COMPLETED
  // — today a rejected collect() always yields observations: [], but filtering would silently drop
  // future partial runs.
  const observations = outcomes.flatMap((outcome) => outcome.run.observations)

  return {
    evidence: resolveEvidence(observations, requestedAxes),
    provenance: outcomes.map(toProvenance),
  }
}

async function runCollector(
  collector: EvidenceCollector,
  requestedAxes: readonly AxisId[],
  context: CollectorContext,
): Promise<CollectorOutcome> {
  const responsibleAxes = collector.supportedAxes.filter((axis) => requestedAxes.includes(axis))

  if (responsibleAxes.length === 0) {
    return {
      responsibleAxes,
      run: {
        collector: collector.id,
        status: 'SKIPPED',
        observations: [],
        reason: `${collector.id} supports none of the requested axes`,
      },
    }
  }

  try {
    const observations = await collector.collect(context)
    return { responsibleAxes, run: { collector: collector.id, status: 'COMPLETED', observations } }
  } catch (error) {
    return {
      responsibleAxes,
      run: {
        collector: collector.id,
        status: context.signal.aborted ? 'TIMED_OUT' : 'FAILED',
        observations: [],
        reason: reasonFor(error),
      },
    }
  }
}

function reasonFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function toProvenance({ run, responsibleAxes }: CollectorOutcome): CollectorProvenance {
  if (run.status === 'COMPLETED') {
    return { collector: run.collector, status: 'COMPLETED', axes: responsibleAxes }
  }
  return { collector: run.collector, status: run.status, axes: responsibleAxes, reason: run.reason }
}
