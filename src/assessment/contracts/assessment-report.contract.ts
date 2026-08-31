export const ASSESSMENT_REPORT_SCHEMA_VERSION = 1

export type EvidenceStatus = 'CONFIRMED' | 'CLAIMED' | 'CONFLICTING' | 'UNKNOWN'
export type AssessmentOutcome = 'MET' | 'NOT_MET' | 'UNPROVEN'

export type Threshold = string | number | readonly string[]
export type ObservedValue = string | number | readonly string[]

export type RequirementReport =
  | {
      readonly axis: string
      readonly threshold: Threshold
      readonly observed: ObservedValue
      readonly evidence: 'CONFIRMED'
      readonly outcome: 'MET' | 'NOT_MET'
    }
  | {
      readonly axis: string
      readonly threshold: Threshold
      readonly observed: ObservedValue | null
      readonly evidence: Exclude<EvidenceStatus, 'CONFIRMED'>
      readonly outcome: 'UNPROVEN'
      readonly diagnostic?: EvidenceGapDiagnostic
    }

export interface EvidenceGapDiagnostic {
  readonly collector: string
  readonly axis: string
  readonly reason: 'INSUFFICIENT_ACTIVE_DAYS'
  readonly observed: number
  readonly minimum: number
}

export interface AxisReport {
  readonly axis: string
  readonly label: string
  readonly outcome: AssessmentOutcome
  readonly requirements: readonly RequirementReport[]
}

export interface LevelReport {
  readonly id: string
  readonly rank: number
  readonly label: string
  readonly outcome: AssessmentOutcome
  readonly axes: readonly AxisReport[]
}

export type BlockingRequirement =
  | {
      readonly level: string
      readonly axis: string
      readonly evidence: 'CONFIRMED'
      readonly outcome: 'NOT_MET'
      readonly gap: 'PRACTICE'
    }
  | {
      readonly level: string
      readonly axis: string
      readonly evidence: Exclude<EvidenceStatus, 'CONFIRMED'>
      readonly outcome: 'UNPROVEN'
      readonly gap: 'EVIDENCE'
    }

// INVARIANT: axes lists what a collector was asked to attempt, fixed before it ran and never
// revised by what it answered — a COMPLETED entry is not a claim that anything was observed;
// `coverage` and the axis reports say what was. Stated in full rather than by reference since this
// contract is self-contained on purpose; `evidence/models/collector-provenance.model.ts` carries
// the same shape and the two must not drift.
export type ProvenanceEntry =
  | {
      readonly collector: string
      readonly status: 'COMPLETED'
      readonly axes: readonly string[]
    }
  | {
      readonly collector: string
      readonly status: 'FAILED' | 'TIMED_OUT' | 'SKIPPED'
      readonly axes: readonly string[]
      readonly reason: string
    }

export interface CoverageReport {
  readonly axesRequested: number
  readonly axesObserved: number
  readonly axesConfirmed: number
}

// INVARIANT: The loaded model owns the words explaining its scale values. Renderers receive this projection
// with the verdict, rather than reopening the model or carrying an AIDD-specific glossary.
export type AxisVocabularyReport =
  | {
      readonly axis: string
      readonly kind: 'ordinal'
      readonly values: readonly string[]
      readonly descriptions: Readonly<Record<string, string>>
    }
  | {
      readonly axis: string
      readonly kind: 'set'
      readonly members: readonly string[]
      readonly descriptions: Readonly<Record<string, string>>
    }
  | {
      readonly axis: string
      readonly kind: 'numeric'
      readonly description: string
    }

// INVARIANT: What a share counts. Size counts delivered changes and parallelism counts active days,
// so a rendering that said "40% of occasions" for both would erase a difference the reader needs.
// Stated in full rather than by reference since this contract is self-contained on purpose;
// `evidence/models/observation.model.ts` carries the same names and the two must not drift.
export type DemonstrationUnit = 'DELIVERIES' | 'ACTIVE_DAYS'

// INVARIANT: One axis of one contributor as its own evidence resolved it, whatever level that row
// reached. `value` is `null` for every status but `CONFIRMED`, on the same terms a
// `RequirementReport` uses. It exists because a row whose `proven` is null published nothing it had
// observed: the level report is the only place a row's values travelled, so the rows that reached
// no level — the ones a reader most wants to understand — stated only what blocked them. One entry
// per axis the model declares, resolved or not: an axis nobody answered is present holding
// `UNKNOWN` and a null value, on the same terms a `RequirementReport` states an unproven one, so a
// reader can tell an axis nobody answered from one this row simply does not carry.
export interface ContributorAxisObservation {
  readonly axis: string
  readonly value: ObservedValue | null
  readonly evidence: EvidenceStatus
}

// INVARIANT: One axis the subject repeatedly reached, and how often it did. `share` is a fraction of
// occasions between 0 and 1, not a percentage — the recorded bundle format already states every
// ratio that way, and a bare `40` would read as a count. It is not optional: a demonstrated value
// without the frequency that earned it is a maximum wearing a habit's clothes, and must never be
// published or rendered alone.
export interface DemonstratedAxis {
  readonly axis: string
  readonly observed: ObservedValue
  readonly share: number
  readonly unit: DemonstrationUnit
}

// INVARIANT: The level alone, without the per-axis requirement reports a `LevelReport` carries. Those
// pair a threshold with an observed value, and the observed value that earned a demonstrated level is
// not the one the sustained reading published: a `LevelReport` here would state `threshold: 3,
// observed: 1, outcome: MET` on the same line. What was demonstrated per axis is `axes` below, in a
// shape that carries the share as well, so nothing is lost by narrowing this.
export interface DemonstratedLevel {
  readonly id: string
  readonly rank: number
  readonly label: string
  readonly outcome: AssessmentOutcome
}

// INVARIANT: What the subject has shown it can reach, as opposed to what it sustains. `level` is
// never below `proven`: a demonstrated reading that lands under the habitual one says the
// distribution leans low, and the habitual figure is then already the honest answer. `axes` carries
// only the axes a demonstrated reading was actually observed for, so it may be shorter than the
// model's axis list and is empty on none of them.
export interface DemonstratedReport {
  readonly level: DemonstratedLevel | null
  readonly axes: readonly DemonstratedAxis[]
}

// INVARIANT: spelled here in full even though `evidence/models/harness-authorship.model.ts` carries
// the same two fields. This contract is self-contained on purpose and imports nothing from a
// context, exactly as `ProvenanceEntry` restates `CollectorProvenance` and `DemonstrationUnit`
// restates the unit names beside it. The duplication is the price, and the two must not drift.
export interface HarnessAuthorship {
  readonly files: number
  readonly commits: number
}

export interface ContributorRow {
  // INVARIANT: `null` is the unattributed bucket, the commits whose email the forge maps to no
  // account. It is never merged into a named row, which would be a guess, and never dropped, which
  // would shrink a count the roster publishes.
  //
  // LIMITATION: bot accounts are excluded by the `[bot]` login suffix. `GitActor.user` is typed
  // `User`, so the `__typename` discriminator the pull-request walk uses has no counterpart on a
  // commit's author. The suffix is GitHub's own convention for app accounts, it is a string rule,
  // and a human account ending in `[bot]` would be wrongly dropped.
  readonly account: string | null

  // INVARIANT: how many distinct email addresses this account authored commits under, inside the
  // window. It is what the forge's own address-to-account mapping collapsed, which is why the row
  // is keyed on the account and not on the address: two addresses under two name strings resolving
  // to one login were measured on a real subject, and a roster keyed on the address would have
  // published one person twice and joined to nothing. `0` is not a fabrication and not a missing
  // mapping — it accompanies `commits: 0`, an account that merged a delivery in the window without
  // authoring a commit in it, and there were then no addresses to collapse. A fact about the
  // mapping, never a level input.
  readonly emailAddresses: number

  // INVARIANT: `commits`, `deliveries` and `activeDays` are all counted over the same window every
  // floor and median in this report uses, ending at the subject's most recent commit and never at
  // wall-clock now. `commits` is what the account authored; `deliveries` is what was merged with it
  // as author; `activeDays` is the days on which one of that account's own deliveries received a
  // commit, and never a day on which only somebody else was active. Only `deliveries` and
  // `activeDays` feed a level. All three are published on every row even when `proven` is null,
  // because the count is what separates "nothing to measure" from "measured and low", and prose
  // prints only the one that explains the row.
  readonly commits: number
  readonly deliveries: number
  readonly activeDays: number

  // INVARIANT: who authored the files that proved `prompts`, `context-engineering`, `behavior` and
  // `loops` — `files`, the distinct proving paths this account committed to in the window, and
  // `commits`, the distinct commits it made to them. The two do not partition the harness set: a
  // file written by one account and later edited by another counts once for each, so the sum of
  // `files` across rows may exceed `harnessPaths` and is not a share of anything.
  //
  // INVARIANT: `null` is a walk that did not run. `{ files: 0, commits: 0 }` states that this
  // account wrote none of the harness, which is an observation; `null` states that local Git
  // refused and nobody looked. Collapsing them would publish a claim on the strength of a failure.
  // It is a fact either way, it decides no level, and no recommendation is derived from it: a
  // contributor who authored none of the harness and relies on all of it daily is not thereby
  // deficient, and `project-brief.md` forbids reading a failure to prove a practice as a practice
  // gap.
  readonly harnessAuthorship: HarnessAuthorship | null

  // INVARIANT: `null` means this account's own sample established no level. Never White, never a
  // level below, exactly as the report's own `proven`. A person's sample is a fraction of the
  // repository's and clears the sample floors less often, so `null` is the ordinary outcome on a
  // shared repository and is an evidence gap, not a verdict on anyone.
  readonly proven: LevelReport | null

  // INVARIANT: the level immediately above this row's own `proven`, or null once the highest is
  // proven — the report's own `next`, asked of one account's evidence. Its requirements pair each
  // threshold with what *this row* observed, never with the repository's, so it states what this
  // account would have to reach and not what the repository already has. A row is a person, and the
  // question "what is next for me" is the one a person reads the report for; the repository's own
  // `next` cannot answer it, because it is measured over deliveries this account did not make.
  readonly next: LevelReport | null

  // INVARIANT: the same terms the report's own block carries, applied to one account's evidence.
  // Never below that row's `proven`, and never an axis without the share that earned it.
  readonly demonstrated: DemonstratedReport | null

  // INVARIANT: every axis this row's own evidence resolved, published whether or not the row
  // reached a level. Without it a row with `proven: null` says only what blocked it and never what
  // it measured, which is the wrong way round: an account with seven deliveries whose size and
  // intervention were both established, and whose parallelism alone was undecidable, was publishing
  // three facts and showing none of them.
  readonly observed: readonly ContributorAxisObservation[]

  // INVARIANT: what stops the row's next level, on the same footing as the report's own `blocking`.
  // Non-empty whenever `proven` is null, so a reader never meets an absent level with nothing said
  // about what is missing.
  readonly blocking: readonly BlockingRequirement[]
}

export type ContributorRosterReport =
  | {
      // INVARIANT: `COMPLETED` with no rows is the only value entitled to say the window held
      // nobody. A walk that could not be read is `FAILED` or `TIMED_OUT` with the reason naming it,
      // never a completed roster with an empty list — that substitution would state something about
      // people out of a read that failed, which is the product's central failure mode.
      readonly status: 'COMPLETED'

      // INVARIANT: the length of the window every count on every row was taken over, carried here
      // so that a reader of the block and a reader of `delivery-sample.ts` cannot disagree about it.
      readonly windowDays: number

      // INVARIANT: the harness value the repository proved, which every row carries on the harness
      // axis of its own level. Stated once because it is one value: two contributors of one
      // repository share one axis of the four their level is made of, and a copy per row would
      // invite two rows disagreeing about a fact neither of them owns. `null` is an evidence gap —
      // the loaded model declares no harness axis, or the scan left a rankable member undecidable —
      // and never a failure: the walk that produced it ran to completion either way.
      readonly harnessObserved: ObservedValue | null

      // INVARIANT: how many files proved that harness set, and the denominator every row's
      // `harnessAuthorship.files` is read against. One number for the same reason — a per-row copy
      // is two rows free to disagree about the size of one set.
      readonly harnessPaths: number

      readonly rows: readonly ContributorRow[]
    }
  | {
      // INVARIANT: the roster's own status, named here rather than in `provenance`. A
      // `ProvenanceEntry` names a collector and the axes it attempted; the roster is not a collector
      // and answers no axis, so filing its failure there would make `collector` mean two things.
      readonly status: 'FAILED' | 'TIMED_OUT'

      // INVARIANT: no `windowDays` here, and the omission is the statement. The span is a constant
      // and could always be printed, which is why printing it would mislead: a run that did not read
      // counted nothing over any period, and a reader owed "none enumerated, and here is why" must
      // not also be handed a window that suggests something was.
      readonly rows: readonly []
      readonly reason: string
    }

export interface AssessmentReport {
  readonly schemaVersion: typeof ASSESSMENT_REPORT_SCHEMA_VERSION

  readonly model: {
    readonly id: string
    readonly schemaVersion: number
  }

  readonly subject: {
    readonly path: string
  }

  // INVARIANT: null means evidence could not establish even the baseline — never replace it with
  // White or any other default.
  readonly proven: LevelReport | null

  // Level immediately above proven, or null once the highest level is proven.
  readonly next: LevelReport | null

  // INVARIANT: null when no collector observed a demonstrated reading on any axis, which is the
  // whole output of every source that records a median without the distribution behind it. The
  // field is additive: a consumer reading `proven` alone sees what it saw before this field
  // existed, which is why the schema version does not move.
  readonly demonstrated: DemonstratedReport | null

  // Full model evaluation ordered by rank.
  readonly levels: readonly LevelReport[]

  // Requirements preventing next from being proven.
  readonly blocking: readonly BlockingRequirement[]

  // INVARIANT: Per-axis scale vocabulary comes from the loaded model. Raw scale values remain the public facts;
  // descriptions make them legible without teaching a renderer any model-specific terminology.
  readonly vocabulary: readonly AxisVocabularyReport[]

  readonly coverage: CoverageReport
  readonly provenance: readonly ProvenanceEntry[]

  // INVARIANT: `null` means no roster was read at all, because the subject has no forge origin or
  // none was wired. That is a different statement from `{ status: 'COMPLETED', rows: [] }`, a
  // roster that ran and found nobody active in the window. Rows arrive ordered by deliveries
  // descending, then by account ascending, with the unattributed bucket last, so the document is
  // byte-identical across machines. Additive forever, on the same footing `demonstrated` already
  // shipped under: a consumer reading `proven` alone sees exactly what it saw before this field
  // existed, and the schema version does not move.
  //
  readonly contributors: ContributorRosterReport | null
}
