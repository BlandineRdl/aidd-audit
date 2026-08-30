import type { EvidenceCollector } from '../../evidence/ports/evidence-collector.port.js'
import { collectEvidence } from '../../evidence/usecases/collect-evidence.usecase.js'
import type { MaturityModel } from '../../maturity/models/maturity.model.js'
import { axisVocabularyOf } from '../composition/axis-vocabulary.js'
import { composeAssessmentReport } from '../composition/compose-assessment-report.js'
import type { AssessmentReport } from '../contracts/assessment-report.contract.js'

export interface AssessMaturityRequest {
  readonly subjectPath: string
  readonly model: MaturityModel
  readonly collectors: readonly EvidenceCollector[]
  readonly signal: AbortSignal
}

export async function assessMaturity(request: AssessMaturityRequest): Promise<AssessmentReport> {
  const { subjectPath, model, collectors, signal } = request
  const vocabulary = axisVocabularyOf(model)
  const { evidence, provenance, diagnostics } = await collectEvidence({
    path: subjectPath,
    vocabulary,
    collectors,
    signal,
  })
  return composeAssessmentReport({ subjectPath, model, evidence, provenance, diagnostics })
}
