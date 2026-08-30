import type { HarnessAuditReport } from '../contracts/harness-audit-report.contract.js'
import { composeHarnessAudit } from '../measurement/compose-harness-audit.js'
import type { HarnessSourcePort } from '../ports/harness-source.port.js'
import type { TokenEncoderPort } from '../ports/token-encoder.port.js'

export interface AuditHarnessInput {
  readonly subjectPath: string
  readonly source: HarnessSourcePort
  readonly encoder: TokenEncoderPort
  readonly signal: AbortSignal
}

// INVARIANT: reads, then measures, then composes — nothing else. It loads no configuration and
// chooses no adapter; both belong to the composition root that builds `source` and `encoder`.
export async function auditHarness(input: AuditHarnessInput): Promise<HarnessAuditReport> {
  const sourceReading = await input.source.read(input.subjectPath, input.signal)
  return composeHarnessAudit(
    input.source.tool,
    sourceReading.files,
    input.encoder,
    sourceReading.unread,
  )
}
