export const HARNESS_AUDIT_REPORT_SCHEMA_VERSION = 1

// INVARIANT: stated in full rather than by reference since this contract is self-contained on
// purpose; `harness/models/loading-tier.model.ts` and `harness/models/reading-scope.model.ts` carry
// the same two closed sets and must not drift.
export type LoadingTier = 'ALWAYS_LOADED' | 'CONDITIONALLY_LOADED'
export type ReadingScope = 'SUBJECT' | 'MACHINE'

export interface MeasuredFile {
  readonly path: string
  readonly byteSize: number
  readonly lineCount: number
  readonly tokenEstimate: number
  readonly tier: LoadingTier
  readonly scope: ReadingScope
}

// INVARIANT: totalled within one tier only, and within one scope only. Nothing here adds
// ALWAYS_LOADED to CONDITIONALLY_LOADED, and nothing adds SUBJECT to MACHINE: the always-loaded tier
// is what the tool reads at every session opening, the conditional tier is a worst-case ceiling for
// parts that may never trigger in a given session, and the two scopes carry different
// reproducibility claims. Summing across either pair would publish a figure no session ever pays
// and no reader could reproduce.
export interface TierTotal {
  readonly tier: LoadingTier
  readonly scope: ReadingScope
  readonly fileCount: number
  readonly lineCount: number
  readonly tokenEstimate: number
}

// INVARIANT: countable is false exactly when no line in the file could be classified as prose or
// list — every line was blank or sat inside a fenced code block. That is not a share of zero: never
// render it as listLines: 0, proseLines: 0, which reads as a file proven to hold no list content
// when nothing about the file's shape was in fact established.
export type ProseShareReport =
  | {
      readonly path: string
      readonly countable: true
      readonly listLines: number
      readonly proseLines: number
    }
  | {
      readonly path: string
      readonly countable: false
    }

export interface SharedPassage {
  readonly words: readonly string[]
}

// INVARIANT: a count of shared sequences and the sequences themselves, never a ratio, a percentage,
// or a threshold above which a pair is named. Whether sharing eleven passages or one is worth
// attention is a reading left entirely to whoever consumes this figure.
export interface DuplicationPair {
  readonly left: string
  readonly right: string
  readonly passages: readonly SharedPassage[]
}

// INVARIANT: `guideline` is a closed set matching the five constants in `harness/advice/
// guidelines.ts`, and a finding never exists without naming one. `subject` is a file path, a
// `"left <-> right"` pair, or the fixed label for the whole session opening. `observed` and
// `guidelineValue` are in the same unit — tokens, lines, a count of passages, or a fraction between
// 0 and 1, never a percentage. `potentialTokensRemoved` is an upper-bound estimate, not a measured
// saving: the audit observes the current harness, not its later edit, import overhead, or which
// conditional work a future session triggers. It is `null` when no honest bound is derivable — the
// prose-share reading, whose finding is an opinion about register, not about cost.
export type GuidelineId =
  | 'SESSION_OPENING_TOKEN_BUDGET'
  | 'ALWAYS_LOADED_FILE_TOKENS'
  | 'ALWAYS_LOADED_FILE_LINES'
  | 'PROSE_SHARE'
  | 'SHARED_PASSAGES_PER_PAIR'

export interface Finding {
  readonly guideline: GuidelineId
  readonly subject: string
  readonly observed: number
  readonly guidelineValue: number
  readonly action: string
  readonly potentialTokensRemoved: number | null
}

export type UnreadReason =
  | 'MISSING_IMPORT'
  | 'INVALID_RULE_FRONT_MATTER'
  | 'MISSING_DECLARATION_FRONT_MATTER'
  | 'INVALID_DECLARATION_FRONT_MATTER'
  | 'MISSING_DECLARATION_DESCRIPTION'

export interface UnreadEntry {
  readonly path: string
  readonly scope: ReadingScope
  readonly reason: UnreadReason
}

// INVARIANT: `files`, `tierTotals`, `proseShares` and `duplication` grade, rank, score, warn, or
// recommend nothing — no threshold, no comparison against one, no word calling a figure good, bad,
// excessive, insufficient, or too long. That was this audit's own constraint until the human who
// owns this project was shown the cost of reversing it — a verdict here means inventing thresholds
// with no better foundation than the size axis regretted inventing, recorded in `architecture.md` —
// and chose to reverse it anyway. `findings` is the one field that carries the result of that
// reversal, against the named guidelines in `harness/advice/guidelines.ts`, themselves marked
// CHOSEN rather than measured. `files` and `tierTotals` are both empty exactly when nothing was
// found to measure — a harness the tool could not read publishes no entries and no zeroed totals,
// which is what tells that state apart from a harness that was found and measured at zero. An
// empty `findings` on a non-empty harness means the harness was measured and nothing observed was
// over any stated guideline — not that nothing was checked.
export interface HarnessAuditReport {
  readonly schemaVersion: typeof HARNESS_AUDIT_REPORT_SCHEMA_VERSION

  // INVARIANT: names which tool's loading convention was read, so a figure here is never mistaken
  // for a universal one.
  readonly tool: string

  readonly encoding: string

  readonly shingleLength: number

  readonly listLineReading: string

  readonly files: readonly MeasuredFile[]

  readonly tierTotals: readonly TierTotal[]

  readonly proseShares: readonly ProseShareReport[]

  readonly duplication: readonly DuplicationPair[]

  readonly unread: readonly UnreadEntry[]

  readonly findings: readonly Finding[]
}
