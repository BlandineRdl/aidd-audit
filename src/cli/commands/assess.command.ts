import { type Stats, statSync } from 'node:fs'
import { assessMaturity } from '../../assessment/usecases/assess-maturity.usecase.js'
import { LiveRepositoryEvidenceCollector } from '../../evidence/adapters/live-repository.adapter.js'
import type { EvidenceCollector } from '../../evidence/ports/evidence-collector.port.js'
import { loadMaturityModel } from '../../maturity/loading/load-maturity-model.js'
import { InvalidMaturityModelError } from '../../maturity/models/invalid-maturity-model.error.js'
import { parseAssessArguments } from '../parsing/assess-arguments.js'
import { canonicalModelPath } from '../bootstrap/canonical-model-path.js'
import { renderHumanReport } from '../renderers/human.renderer.js'
import { renderJsonReport } from '../renderers/json.renderer.js'
import { UsageError } from '../usage.error.js'

export interface CommandIo {
  stdout(text: string): void
  stderr(text: string): void
}

// The composition root: the CLI wires the concrete adapters the core only knows as ports.
// The live collector answers a repository and stays silent on anything else, so a fixture
// bundle is simply not its subject — until the bundle adapter lands, that subject has no
// collector and the report says so with `proven: null` rather than guessing.
const collectors: readonly EvidenceCollector[] = [new LiveRepositoryEvidenceCollector()]

const neverAborts = new AbortController().signal

export async function runAssess(argv: readonly string[], io: CommandIo): Promise<number> {
  try {
    const args = parseAssessArguments(argv)
    requireExistingSubject(args.subjectPath)

    const model = loadMaturityModel(args.modelPath ?? canonicalModelPath())

    const report = await assessMaturity({
      subjectPath: args.subjectPath,
      model,
      collectors,
      signal: neverAborts,
    })

    const rendered = args.json ? renderJsonReport(report) : renderHumanReport(report)
    io.stdout(`${rendered}\n`)
    return 0
  } catch (error) {
    io.stderr(`${messageOf(error)}\n`)
    return error instanceof UsageError || error instanceof InvalidMaturityModelError ? 2 : 1
  }
}

/** Validates the argument; never reads inside the subject. */
function requireExistingSubject(subjectPath: string): void {
  let stats: Stats
  try {
    stats = statSync(subjectPath)
  } catch {
    throw new UsageError(`Subject path '${subjectPath}' does not exist.`)
  }

  if (!stats.isDirectory() && !stats.isFile()) {
    throw new UsageError(`Subject path '${subjectPath}' is neither a file nor a directory.`)
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
