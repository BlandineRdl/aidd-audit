import type { AxisVocabulary } from '../../models/axis.model.js'
import type { Observation } from '../../models/observation.model.js'
import { deriveObservations } from './derived-observations.js'
import {
  deriveForgeMetrics,
  type ForgeDerivedMetrics,
  type MergedPullRequest,
} from './pull-request-history.js'

// INVARIANT: The roster's own collector id. It is distinct from `forge-repository`'s so that a
// per-account observation never claims to have come from the repository-level collector — the two
// answer the same axes from two different samples, and `resolveEvidence` must never see them as one
// list.
const ROSTER_COLLECTOR_ID = 'forge-contributor-roster'

export interface ContributorDeliveries {
  readonly account: string | null
  readonly deliveryCount: number
  readonly activeDays: number
  // INVARIANT: the derived values themselves, beside the observations built from them. The roster
  // adapter reads only the counts and the observations; this field exists so the suite can drive
  // the per-account derivation at its own boundary rather than through a walked payload, which is
  // the coarseness `testing.md` records a mutation sweep punishing on `harness/`.
  readonly metrics: ForgeDerivedMetrics
  readonly observations: readonly Observation[]
}

// INVARIANT: One entry per account that opened at least one delivery in the window handed in, each
// holding that account's own metrics, its own active-day count and its own observations — never
// another account's, and never a list concatenated across accounts. `deliveries` is expected to have
// already left the window and bot filters `readDeliveredChanges` applies at the repository level;
// a bot-opened delivery is excluded again here, by the same `openedByABot` flag, so that this
// function stays correct and independently testable on a hand-built sample that never goes through
// that walk.
// LIMITATION: `deriveForgeMetrics` applies `MINIMUM_DELIVERED_CHANGES`, `MINIMUM_ACTIVE_DAYS` and
// `MINIMUM_DEMONSTRATED_SAMPLE`, from `delivery-sample.ts`, to whatever sample it is handed — here,
// one account's own deliveries and active days, never the repository's. Splitting the window by
// person shrinks every sample, so a team of four sharing thirty deliveries will have members below
// one or both floors, and their rows will carry an evidence gap where the repository line carried a
// level. That is the conservative rule working, not a regression: the argument for the values
// themselves is in `delivery-sample.ts` and none of it changes because the sample is now one
// person's. The floors are not to be lowered so that a given contributor classifies, on the same
// footing as the sentence in `delivery-sample.ts` that forbids lowering them so that a given
// repository classifies.
export function readContributorDeliveries(
  deliveries: readonly MergedPullRequest[],
  vocabulary: readonly AxisVocabulary[],
): readonly ContributorDeliveries[] {
  const byAccount = new Map<string | null, MergedPullRequest[]>()

  for (const delivery of deliveries) {
    if (delivery.openedByABot) continue
    const bucket = byAccount.get(delivery.openedBy)
    if (bucket === undefined) {
      byAccount.set(delivery.openedBy, [delivery])
    } else {
      bucket.push(delivery)
    }
  }

  return [...byAccount.entries()].map(([account, ownDeliveries]) =>
    readOneAccount(account, ownDeliveries, vocabulary),
  )
}

function readOneAccount(
  account: string | null,
  ownDeliveries: readonly MergedPullRequest[],
  vocabulary: readonly AxisVocabulary[],
): ContributorDeliveries {
  const metrics = deriveForgeMetrics(ownDeliveries)
  const basis =
    account === null
      ? 'merged pull requests with no named author'
      : `merged pull requests opened by ${account}`

  return {
    account,
    deliveryCount: ownDeliveries.length,
    activeDays: distinctActiveDays(ownDeliveries),
    metrics,
    observations: deriveObservations(metrics, vocabulary, ROSTER_COLLECTOR_ID, basis),
  }
}

// INVARIANT: A day on which one of this account's own deliveries received a commit — the same
// `commitDays` field `deriveForgeMetrics` reads to build its own per-day counts, so the two cannot
// drift into naming different days active. Only the count of distinct days is needed here, never the
// per-day concurrency `countRequestsPerActiveDay` computes internally for the parallelism reading, so
// nothing of that rule is reimplemented — only the set of days it would have counted from.
function distinctActiveDays(ownDeliveries: readonly MergedPullRequest[]): number {
  return new Set(ownDeliveries.flatMap((delivery) => delivery.commitDays)).size
}
