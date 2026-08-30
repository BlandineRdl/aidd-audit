import type { AxisVocabulary } from '../models/axis.model.js'
import { NO_HARNESS_AUTHORSHIP } from '../models/harness-authorship.model.js'
import type { Observation } from '../models/observation.model.js'
import type {
  ContributorRecord,
  ContributorRoster,
  ContributorRosterContext,
  ContributorRosterRun,
} from '../ports/contributor-roster.port.js'
import { WINDOW_DAYS, windowStartFrom } from './delivery-sample.js'
import { readCommitHistory } from './forge-repository/commit-history.js'
import {
  readContributorDeliveries,
  type ContributorDeliveries,
} from './forge-repository/contributor-deliveries.js'
import type { ForgeDeliveryReader } from './forge-repository/delivery-reader.js'
import { deriveForgeMetrics } from './forge-repository/pull-request-history.js'
import type { RepositorySlug } from './forge-repository/repository-slug.js'
import { decidedCapabilities } from './harness/decided-capabilities.js'
import { readHarnessAuthorship } from './harness/harness-authorship.js'
import { scanHarness, type HarnessScan } from './harness/harness-scan.js'
import type { HarnessTree } from './harness/harness-tree.js'
import { hasAiAttributionTrailer } from './live-repository/git-history.js'
import { mostRecentCommitDate } from './live-repository/git-process.js'

const COLLECTOR_ID = 'forge-contributor-roster'

// INVARIANT: constructed with four things the composition root holds or can build, and this adapter
// computes none of them itself. `slug` is resolved once by the caller, exactly as
// `ForgeRepositoryEvidenceCollector` is given one, so this adapter never decides for itself whether
// a subject is its own — a bundle tracked inside a repository would otherwise be handed the
// surrounding repository's people. `path` is the same work-tree root the caller already gate-checked,
// read here and never taken from the call-time context a second time. `deliveries` is the walk shared
// with the repository-level collector, so "one walk" is a fact of the call graph rather than a
// sentence in a comment. `tree` is scanned by this adapter's own `scanHarness` run, which is what
// makes the harness observation on every record identical to the collector's own rather than a value
// borrowed from it.
export class ForgeContributorRosterAdapter implements ContributorRoster {
  readonly id = COLLECTOR_ID

  constructor(
    private readonly slug: RepositorySlug,
    private readonly path: string,
    private readonly deliveries: ForgeDeliveryReader,
    private readonly tree: HarnessTree,
  ) {}

  async read(context: ContributorRosterContext): Promise<ContributorRosterRun> {
    try {
      context.signal.throwIfAborted()

      const subjectActivityEnd = await mostRecentCommitDate(this.path, context.signal)
      const history = await readCommitHistory(this.slug, subjectActivityEnd, context.signal)
      if (history === null) {
        return this.failed(context, 'the commit walk did not complete')
      }

      context.signal.throwIfAborted()

      const deliveries = await this.deliveries.read(context.signal)
      if (deliveries === null) {
        return this.failed(context, 'the delivery walk did not complete')
      }

      context.signal.throwIfAborted()

      // SAFETY: `history !== null` above is exactly the guard `readCommitHistory` uses to refuse a
      // non-finite `subjectActivityEnd`, so this window end is known finite here.
      const windowStart = windowStartFrom(subjectActivityEnd as number)

      const trailer = await hasAiAttributionTrailer(this.path, context.signal)
      const scan = await scanHarness(this.tree, trailer, context.signal)

      const harnessScale = harnessSetScaleFrom(context.vocabulary)
      const harnessObserved =
        harnessScale === undefined ? null : decidedCapabilities(scan, harnessScale)

      const provingPaths = provingPathsOf(scan)

      const accountForEmail = accountForEmailFrom(history.accountByEmail)
      const authorship = await readHarnessAuthorship(
        this.path,
        provingPaths,
        accountForEmail,
        windowStart,
        context.signal,
      )
      if (authorship === null) {
        return this.failed(context, 'the harness authorship walk did not complete')
      }

      const deliveriesByAccount = new Map(
        readContributorDeliveries(deliveries, context.vocabulary).map((entry) => [
          entry.account,
          entry,
        ]),
      )

      const accounts = new Set<string | null>([
        ...history.commitsByAccount.keys(),
        ...deliveriesByAccount.keys(),
      ])

      // INVARIANT: The harness axis is shared by decision, never attributed by authorship — the plan
      // rejects scoring a developer who joins tomorrow and relies on the harness at White, and
      // attributing it by use is not observable at all. Computed here, from the tree this adapter was
      // handed, so it is deterministically identical to `LiveRepositoryEvidenceCollector`'s own
      // reading rather than a value borrowed from it; nothing falls back to the repository's
      // evidence. Without it every row would answer no harness axis at all — every level of `aidd.yml`
      // declares it — and every row would be `proven: null` by construction.
      //
      // SAFETY: `null` withholds the observation instead of inventing one. The rows then answer no
      // harness axis, which under a model declaring it is an evidence gap on every row — the same
      // answer the live collector gives for the same two conditions, and never a failed run.
      const harnessObservation: Observation | null =
        harnessObserved === null
          ? null
          : {
              axis: 'harness',
              reading: 'SUSTAINED',
              value: harnessObserved,
              kind: 'OBSERVED',
              collector: COLLECTOR_ID,
              basis: `tracked tree of ${this.path}, union of what was seen — shared by every row`,
              demonstration: null,
            }

      const records: ContributorRecord[] = [...accounts].map((account) => {
        const delivery = deliveriesByAccount.get(account) ?? emptyDeliveries(account)
        return {
          account,
          // LIMITATION: `account === null` never carries an address count — the unattributed bucket
          // is commits nothing observable could attribute, and counting the addresses it dropped
          // would state something about a person who was never named.
          emailAddresses:
            account === null ? 0 : (history.emailAddressesByAccount.get(account) ?? 0),
          commits: history.commitsByAccount.get(account) ?? 0,
          deliveries: delivery.deliveryCount,
          activeDays: delivery.activeDays,
          harnessAuthorship: authorship.get(account) ?? NO_HARNESS_AUTHORSHIP,
          observations:
            harnessObservation === null
              ? delivery.observations
              : [...delivery.observations, harnessObservation],
        }
      })

      return {
        status: 'COMPLETED',
        records,
        windowDays: WINDOW_DAYS,
        harnessObserved,
        harnessPaths: provingPaths.length,
      }
    } catch (error) {
      return {
        status: context.signal.aborted ? 'TIMED_OUT' : 'FAILED',
        records: [],
        reason: reasonFor(error),
      }
    }
  }

  private failed(context: ContributorRosterContext, reason: string): ContributorRosterRun {
    return {
      status: context.signal.aborted ? 'TIMED_OUT' : 'FAILED',
      records: [],
      reason,
    }
  }
}

type SetVocabulary = Extract<AxisVocabulary, { kind: 'set' }>

function harnessSetScaleFrom(vocabulary: readonly AxisVocabulary[]): SetVocabulary | undefined {
  const scale = vocabulary.find((candidate) => candidate.axis === 'harness')
  return scale?.kind === 'set' ? scale : undefined
}

// INVARIANT: The flattened union of every member's proving paths, deduplicated — the same paths
// `harnessAuthorship.ts` reads over, and the same count `harnessPaths` publishes. A file proving two
// members counts once here, exactly as it counts once in `harnessPaths`.
function provingPathsOf(scan: HarnessScan): readonly string[] {
  const paths = new Set<string>()
  for (const proof of Object.values(scan.provenBy)) {
    if (proof.kind === 'files') {
      for (const path of proof.paths) paths.add(path)
    }
  }
  return [...paths]
}

// INVARIANT: This adapter's own lookup, built the moment the commit walk returns — the dictionary it
// closes over, `accountByEmail`, does not exist before then. Lowercases the address it is handed;
// `commit-history.ts` keys the dictionary on the lowercased address, so this is the one place that
// normalisation happens for the authorship walk.
function accountForEmailFrom(
  accountByEmail: ReadonlyMap<string, string>,
): (email: string) => string | null {
  return (email) => accountByEmail.get(email.toLowerCase()) ?? null
}

function emptyDeliveries(account: string | null): ContributorDeliveries {
  return {
    account,
    deliveryCount: 0,
    activeDays: 0,
    metrics: deriveForgeMetrics([]),
    observations: [],
  }
}

function reasonFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
