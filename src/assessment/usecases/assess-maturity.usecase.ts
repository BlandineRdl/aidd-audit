import type {
  ContributorRoster,
  ContributorRosterContext,
  ContributorRosterRun,
} from '../../evidence/ports/contributor-roster.port.js'
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
  readonly roster?: ContributorRoster
  readonly signal: AbortSignal
}

export async function assessMaturity(request: AssessMaturityRequest): Promise<AssessmentReport> {
  const { subjectPath, model, collectors, roster, signal } = request
  const vocabulary = axisVocabularyOf(model)
  const { evidence, provenance } = await collectEvidence({
    path: subjectPath,
    vocabulary,
    collectors,
    signal,
  })
  // INVARIANT: read after collection, never concurrently with it — the sequencer's job is order,
  // and overlapping the two forge round trips would buy a latency nobody has measured.
  const run = await readRoster(roster, { path: subjectPath, vocabulary, signal })
  return composeAssessmentReport({ subjectPath, model, evidence, provenance, roster: run })
}

// INVARIANT: a roster that could not be read is a gap in the document, never a failure of the run —
// the exit code answers "did the assessment run", not "did every source answer". A throw here
// becomes a FAILED or TIMED_OUT run with a named reason rather than an exception reaching the CLI,
// on the same footing `collectEvidence` already gives a failing collector.
async function readRoster(
  roster: ContributorRoster | undefined,
  context: ContributorRosterContext,
): Promise<ContributorRosterRun | null> {
  if (roster === undefined) return null

  try {
    return await roster.read(context)
  } catch (error) {
    return {
      status: context.signal.aborted ? 'TIMED_OUT' : 'FAILED',
      records: [],
      reason: reasonFor(error),
    }
  }
}

function reasonFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
