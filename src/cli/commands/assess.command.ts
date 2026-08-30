import { type Stats, statSync } from 'node:fs'
import type { AssessmentReport } from '../../assessment/contracts/assessment-report.contract.js'
import { assessMaturity } from '../../assessment/usecases/assess-maturity.usecase.js'
import { FixtureBundleEvidenceCollector } from '../../evidence/adapters/fixture-bundle.adapter.js'
import { ForgeRepositoryEvidenceCollector } from '../../evidence/adapters/forge-repository.adapter.js'
import {
  type RepositorySlug,
  repositorySlug,
} from '../../evidence/adapters/forge-repository/repository-slug.js'
import { LiveRepositoryEvidenceCollector } from '../../evidence/adapters/live-repository.adapter.js'
import { isRepositoryRoot } from '../../evidence/adapters/live-repository/git-process.js'
import type { EvidenceCollector } from '../../evidence/ports/evidence-collector.port.js'
import { loadMaturityModel } from '../../maturity/loading/load-maturity-model.js'
import { InvalidMaturityModelError } from '../../maturity/models/invalid-maturity-model.error.js'
import { parseAssessArguments } from '../parsing/assess-arguments.js'
import { canonicalModelPath } from '../bootstrap/canonical-model-path.js'
import { renderHumanReport, renderHumanReports } from '../renderers/human.renderer.js'
import { colouredText, plainText } from '../renderers/text-style.js'
import { renderJsonReport, renderJsonReports } from '../renderers/json.renderer.js'
import { resolveSubjects } from '../subjects/resolve-subjects.js'
import { UsageError } from '../usage.error.js'

export interface CommandIo {
  stdout(text: string): void
  stderr(text: string): void

  // INVARIANT: colour is a property of the channel, never of the report. It is stated by whoever
  // owns the streams — only `main.ts` knows whether one is a terminal — so `runAssess` decides
  // nothing about presentation and a captured run is plain without asking for it.
  readonly colours: boolean
}

// SAFETY: Only a work-tree root gets a forge. `git remote get-url` run inside a checkout answers for
// the enclosing repository, so a bundle tracked in one would be handed that repository's pull
// requests as its own evidence — the fault the live collector's own root check exists to prevent.
async function forgeFor(
  subjectPath: string,
  isWorkTreeRoot: boolean,
  signal: AbortSignal,
): Promise<RepositorySlug | null> {
  if (!isWorkTreeRoot) return null
  return repositorySlug(subjectPath, signal)
}

// INVARIANT: One axis, one source. The live collector and the forge would both answer `size`,
// `intervention` and `parallelism`, from a graph and from the pull requests it came from, and
// `resolveEvidence` turns two differing observations into CONFLICTING — so adding the better source
// beside the weaker one would destroy both. Where a forge exists it owns those three axes and the
// live collector is built for the harness alone. Choosing between sources is wiring, which is this
// module's job; no collector learns about another and no resolution rule changes.
//
// LIMITATION: The cost is that on a GitHub subject whose forge cannot answer — `gh` absent, no
// credentials, a rate limit — those three axes are UNKNOWN where the graph would have offered a
// value. That is the conservative direction, and `provenance` names the forge as FAILED so the
// reader sees which source was asked and refused.
function collectorsFor(forge: RepositorySlug | null): readonly EvidenceCollector[] {
  if (forge === null) {
    return [new LiveRepositoryEvidenceCollector(), new FixtureBundleEvidenceCollector()]
  }

  return [
    new LiveRepositoryEvidenceCollector(['harness']),
    new ForgeRepositoryEvidenceCollector(forge),
    new FixtureBundleEvidenceCollector(),
  ]
}

// INVARIANT: the wired set is the default, never the only one. A suite that needs a collector this
// composition root would not build — one emitting a value off the loaded scale, which is the only
// route to exit code 1 — passes its own, and nothing about the production wiring moves.
export interface AssessOptions {
  readonly collectors?: readonly EvidenceCollector[]
}

export async function runAssess(
  argv: readonly string[],
  io: CommandIo,
  options: AssessOptions = {},
): Promise<number> {
  // SAFETY: the controller is held, not discarded. Aborting in `finally` is what makes the seam
  // real: an in-flight `git` or `gh` child is cancelled when the command returns.
  //
  // LIMITATION: no budget is set on it. Honouring one is a collector's own duty, and no number here
  // has been measured — least of all for the forge, whose round trip is the one failure a local
  // `git` cannot produce and the reason a budget is now owed rather than merely absent. Measuring it
  // means timing real queries against real repositories, which this project has not done. The day it
  // does, it is a timer on this controller rather than a restructuring.
  const budget = new AbortController()

  try {
    const args = parseAssessArguments(argv)
    requireExistingSubject(args.subjectPath)

    const resolved = await resolveSubjects(args.subjectPath, budget.signal)
    const model = loadMaturityModel(args.modelPath ?? canonicalModelPath())
    const reports: AssessmentReport[] = []
    for (const subjectPath of resolved.subjects) {
      const isWorkTreeRoot = resolved.isSet
        ? await isRepositoryRoot(subjectPath, budget.signal)
        : resolved.isWorkTreeRoot
      reports.push(
        await assessMaturity({
          subjectPath,
          model,
          collectors:
            options.collectors ??
            collectorsFor(await forgeFor(subjectPath, isWorkTreeRoot, budget.signal)),
          signal: budget.signal,
        }),
      )
    }

    // INVARIANT: colour dresses the explanation only. The contract is the machine-readable
    // channel, and every byte of it is the contract's.
    const rendered = renderReports(reports, resolved.isSet, args.json, io.colours)
    io.stdout(`${rendered}\n`)
    return 0
  } catch (error) {
    io.stderr(`${messageOf(error)}\n`)
    return error instanceof UsageError || error instanceof InvalidMaturityModelError ? 2 : 1
  } finally {
    budget.abort()
  }
}

function renderReports(
  reports: readonly AssessmentReport[],
  isSet: boolean,
  json: boolean,
  colours: boolean,
): string {
  const [only] = reports
  const style = colours ? colouredText : plainText
  if (!isSet && only !== undefined) return json ? renderJsonReport(only) : renderHumanReport(only, style)
  return json ? renderJsonReports(reports) : renderHumanReports(reports, style)
}

// Never reads inside the subject: a failure met during collection is the collector's.
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
