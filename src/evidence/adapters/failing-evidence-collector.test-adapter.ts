import type { AxisId } from '../models/axis.model.js'
import type { EvidenceCollector } from '../ports/evidence-collector.port.js'

// COMPAT: `failure` is `unknown` because that is what a `catch` receives — a boundary can reject
// with anything.
export class FailingEvidenceCollector implements EvidenceCollector {
  constructor(
    readonly id: string,
    readonly supportedAxes: readonly AxisId[],
    private readonly failure: unknown,
  ) {}

  async collect(): Promise<never> {
    throw this.failure
  }
}
