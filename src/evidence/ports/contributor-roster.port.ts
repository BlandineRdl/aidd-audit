import type { AxisVocabulary } from '../models/axis.model.js'
import type { HarnessAuthorship } from '../models/harness-authorship.model.js'
import type { Observation, ObservedValue } from '../models/observation.model.js'

// INVARIANT: A second port, never a second value on `EvidenceCollector`. That port's observations
// are compared one axis at a time by `resolveEvidence`; N contributors each emitting the `size`
// axis would be N values of one axis, which resolution answers with `CONFLICTING` and destroys the
// axis for the repository and for every person at once. A roster answers a different question —
// who was active, and what does each person's own sample prove — so it gets its own boundary, and
// nothing it returns ever reaches `resolveEvidence`.
export interface ContributorRosterContext {
  readonly path: string
  readonly vocabulary: readonly AxisVocabulary[]
  readonly signal: AbortSignal
}

// INVARIANT: `emailAddresses` counts the distinct addresses this account authored commits under
// inside the window — `commit-history.ts`'s `emailAddressesByAccount` — and never name-and-email
// pairs; a field named after identities and counting addresses is exactly what published two
// different numbers for one measured subject. `0` is a true reading and not a missing mapping: it
// accompanies `commits: 0`, an account whose delivery merged in the window without a commit
// authored in it, and there were then no addresses to collapse. `activeDays` is copied from that account's own delivery metrics
// (`contributor-deliveries.ts`) rather than recomputed here: a day on which one of this account's
// own deliveries received a commit, and never a day on which only somebody else was active.
export interface ContributorRecord {
  readonly account: string | null
  readonly emailAddresses: number
  readonly commits: number
  readonly deliveries: number
  readonly activeDays: number
  // INVARIANT: `null` is a walk that did not run. A `COMPLETED` run never publishes it on a record:
  // a walk that did not run fails the whole run — see `ContributorRosterRun` below. The field stays
  // nullable here because this port is not the one implementation that reads it.
  readonly harnessAuthorship: HarnessAuthorship | null
  readonly observations: readonly Observation[]
}

// INVARIANT: Mirrors `CollectorRun`'s shape so the two boundaries read alike, with two differences
// forced by what a roster is rather than a collector.
//
// There is no `SKIPPED`: a collector may support none of the requested axes, and reports that. The
// roster answers no axis at all, so a subject with no GitHub origin gets no roster rather than an
// empty one — decided by the composition root, never stated here.
//
// The union carries its own outcome, because no use case sits between this port and the
// composition root. `collectEvidence` is what turns a collector's rejection into a status and a
// reason for `EvidenceCollector`; nothing plays that part for this port, so the one implementation
// does it itself.
export type ContributorRosterRun =
  | {
      readonly status: 'COMPLETED'
      readonly records: readonly ContributorRecord[]
      readonly windowDays: number
      // INVARIANT: The harness value every record shares, or `null` when there is none to share —
      // the loaded model declares no harness axis, or the scan left a rankable member undecidable.
      // `null` is an evidence gap and never a failure: `LiveRepositoryEvidenceCollector` answers the
      // same two conditions with no observation at all, and a roster that called them `FAILED` would
      // report a read that refused where the read in fact succeeded.
      readonly harnessObserved: ObservedValue | null
      readonly harnessPaths: number
    }
  // INVARIANT: A failed run carries no `windowDays`. The number is a constant and could always be
  // stated, which is exactly why stating it here would be wrong: a run that did not read established
  // no period, and a reader owed "none enumerated, and here is why" must not also be handed a span
  // nothing was counted over. It is also what keeps `assessment/` from having to name 180 itself,
  // which it cannot import.
  | {
      readonly status: 'FAILED' | 'TIMED_OUT'
      readonly records: readonly ContributorRecord[]
      readonly reason: string
    }

export interface ContributorRoster {
  readonly id: string
  read(context: ContributorRosterContext): Promise<ContributorRosterRun>
}
