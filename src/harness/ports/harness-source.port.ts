import type { LoadingTier } from '../models/loading-tier.model.js'
import type { ReadingScope } from '../models/reading-scope.model.js'

// INVARIANT: what a tool's own loading convention must answer for one file it would read: where it
// sits, how large it is, what it holds, and which tier and scope it belongs to under that
// convention. The domain learns nothing about how a convention decided that — Claude's own rule for
// what loads at session opening today, or another tool's convention later — only this shape.
export interface HarnessSourceFile {
  readonly path: string
  readonly byteSize: number
  readonly content: string
  readonly tier: LoadingTier
  readonly scope: ReadingScope
}

// INVARIANT: an unread entry is evidence about the audit's limits, never a measured zero. The
// source records it beside successfully read files so a renderer can distinguish "nothing here"
// from "something named here could not be interpreted".
export type HarnessUnreadReason =
  | 'MISSING_IMPORT'
  | 'INVALID_RULE_FRONT_MATTER'
  | 'MISSING_DECLARATION_FRONT_MATTER'
  | 'INVALID_DECLARATION_FRONT_MATTER'
  | 'MISSING_DECLARATION_DESCRIPTION'

export interface HarnessSourceUnreadEntry {
  readonly path: string
  readonly scope: ReadingScope
  readonly reason: HarnessUnreadReason
}

export interface HarnessSourceReading {
  readonly files: readonly HarnessSourceFile[]
  readonly unread: readonly HarnessSourceUnreadEntry[]
}

// INVARIANT: `tool` names the convention that was read, so a figure this produces is never mistaken
// for a universal one — the audit reads one tool's rules for what loads at session opening, not an
// abstraction over every agent tool that might exist.
export interface HarnessSourcePort {
  readonly tool: string
  read(subjectPath: string, signal: AbortSignal): Promise<HarnessSourceReading>
}
