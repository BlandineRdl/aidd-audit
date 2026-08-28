import type { AxisId } from '../models/axis.model.js'
import type { EvidenceCollector } from '../ports/evidence-collector.port.js'

/**
 * An evidence source that is unavailable. `failure` is `unknown` because that is what a
 * `catch` receives: JavaScript lets a boundary reject with anything, and the use case has
 * to name a reason either way.
 */
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
