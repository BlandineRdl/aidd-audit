import type { AxisId } from '../models/axis.model.js'
import type { Observation } from '../models/observation.model.js'
import type { CollectorContext, EvidenceCollector } from '../ports/evidence-collector.port.js'

/** An evidence source that is available, holding its observations in memory. */
export class FakeInMemoryEvidenceCollector implements EvidenceCollector {
  readonly contexts: CollectorContext[] = []

  constructor(
    readonly id: string,
    readonly supportedAxes: readonly AxisId[],
    private readonly observations: readonly Observation[],
  ) {}

  async collect(context: CollectorContext): Promise<readonly Observation[]> {
    this.contexts.push(context)

    return this.observations
  }
}
