import type { AxisId, AxisVocabulary } from '../models/axis.model.js'
import type { CollectorDiagnostic } from '../models/collector-diagnostic.model.js'
import type {
  CollectorCollection,
  CollectorContext,
  EvidenceCollector,
} from '../ports/evidence-collector.port.js'
import { MINIMUM_ACTIVE_DAYS } from './delivery-sample.js'
import type { ForgeDeliveryReader } from './forge-repository/delivery-reader.js'
import { deriveObservations, scaleFor } from './forge-repository/derived-observations.js'
import { deriveForgeMetrics } from './forge-repository/pull-request-history.js'
import type { RepositorySlug } from './forge-repository/repository-slug.js'

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
//
// INVARIANT: `deliveries` is the walk shared with `ForgeContributorRosterAdapter` — one memoised
// `ForgeDeliveryReader`, built once by the composition root and handed to both, so a GitHub subject
// is walked once for its deliveries rather than twice.
export class ForgeRepositoryEvidenceCollector implements EvidenceCollector {
  readonly id = COLLECTOR_ID
  readonly supportedAxes: readonly AxisId[] = ['size', 'intervention', 'parallelism']

  constructor(
    private readonly slug: RepositorySlug,
    private readonly deliveries: ForgeDeliveryReader,
  ) {}

  async collect(context: CollectorContext): Promise<CollectorCollection> {
    context.signal.throwIfAborted()

    if (!hasAnySupportedAxis(context.vocabulary)) return { observations: [], diagnostics: [] }

    const metrics = deriveForgeMetrics(await this.deliveries.read(context.signal))

    return {
      observations: deriveObservations(
        metrics,
        context.vocabulary,
        COLLECTOR_ID,
        `merged pull requests of ${this.slug.owner}/${this.slug.name}`,
      ),
      diagnostics: diagnosticsFor(metrics, context.vocabulary),
    }
  }
}

// INVARIANT: why an axis this collector supports went unobserved, and only where the reason is one
// it knows. A parallelism withheld for too thin a sample is a fact about the window, not a verdict
// on the subject, and saying so is what stops "no observation" reading as "no branches".
function diagnosticsFor(
  metrics: ReturnType<typeof deriveForgeMetrics>,
  vocabulary: readonly AxisVocabulary[],
): readonly CollectorDiagnostic[] {
  const parallelismScale = scaleFor(vocabulary, 'parallelism')
  if (
    parallelismScale?.kind !== 'numeric' ||
    metrics.parallelism !== null ||
    metrics.activeDays === null ||
    metrics.activeDays >= MINIMUM_ACTIVE_DAYS
  ) {
    return []
  }

  return [
    {
      collector: COLLECTOR_ID,
      axis: 'parallelism',
      reason: 'INSUFFICIENT_ACTIVE_DAYS',
      observed: metrics.activeDays,
      minimum: MINIMUM_ACTIVE_DAYS,
    },
  ]
}

function hasAnySupportedAxis(vocabulary: readonly AxisVocabulary[]): boolean {
  return vocabulary.some(
    (scale) =>
      scale.axis === 'size' || scale.axis === 'intervention' || scale.axis === 'parallelism',
  )
}
