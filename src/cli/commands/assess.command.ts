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
import { renderJsonReport, renderJsonReports } from '../renderers/json.renderer.js'
import { resolveSubjects } from '../subjects/resolve-subjects.js'
import { UsageError } from '../usage.error.js'

export interface CommandIo {
  stdout(text: string): void
  stderr(text: string): void
}

// SAFETY: Only a work-tree root gets a forge. `git remote get-url` run inside a checkout answers for
// the enclosing repository, so a bundle tracked in one would be handed that repository's pull
// requests as its own evidence — the fault the live collector's own root check exists to prevent.
// `isWorkTreeRoot` is decided by the caller — resolution's own answer for a lone subject, a fresh
// per-member question for a set — so this asks nothing and spawns nothing.
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
      // SAFETY: a set's member may be its own work-tree root — a bundle is free to be a git
      // repository nested inside a plain directory — so the question is asked of the member, never
      // inherited from the directory that failed it. Inheriting it dropped that member's forge and
      // handed the live collector three axes a better source owned, which is a route to
      // CONFLICTING. A lone subject reuses the answer resolution already spawned `git` for.
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

    io.stdout(`${renderReports(reports, resolved.isSet, args.json)}\n`)
    return 0
  } catch (error) {
    io.stderr(`${messageOf(error)}\n`)
    return error instanceof UsageError || error instanceof InvalidMaturityModelError ? 2 : 1
  } finally {
    budget.abort()
  }
}

// INVARIANT: a lone subject renders exactly what it renders today — the single-report entry
// point, untouched — so a report a caller could already name alone never changes shape by sitting
// inside a set. The branch is `resolved.isSet`, never the length of `reports`: a set of exactly
// one bundle is still a set, and must still publish the many-report shape — an array under
// `--json`, not the bare object a lone subject publishes.
function renderReports(
  reports: readonly AssessmentReport[],
  isSet: boolean,
  json: boolean,
): string {
  const [only] = reports
  if (!isSet && only !== undefined) {
    return json ? renderJsonReport(only) : renderHumanReport(only)
  }
  return json ? renderJsonReports(reports) : renderHumanReports(reports)
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
