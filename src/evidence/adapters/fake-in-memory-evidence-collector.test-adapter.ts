import type { AxisId } from '../models/axis.model.js'
import type { CollectorDiagnostic } from '../models/collector-diagnostic.model.js'
import type { Observation } from '../models/observation.model.js'
import {
  type CollectorCollection,
  type CollectorContext,
  type EvidenceCollector,
} from '../ports/evidence-collector.port.js'

export class FakeInMemoryEvidenceCollector implements EvidenceCollector {
  readonly contexts: CollectorContext[] = []

  constructor(
    readonly id: string,
    readonly supportedAxes: readonly AxisId[],
    private readonly observations: readonly Observation[],
    private readonly diagnostics: readonly CollectorDiagnostic[] = [],
  ) {}

  async collect(context: CollectorContext): Promise<CollectorCollection> {
    this.contexts.push(context)

    return { observations: this.observations, diagnostics: this.diagnostics }
  }
}
