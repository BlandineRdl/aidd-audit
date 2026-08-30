import { parse } from 'yaml'
import type { LoadingTier } from '../../models/loading-tier.model.js'

const FRONT_MATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

export type FrontMatterReading =
  | { readonly present: false }
  | { readonly present: true; readonly parsed: false }
  | {
      readonly present: true
      readonly parsed: true
      readonly data: Readonly<Record<string, unknown>>
      readonly body: string
    }

// INVARIANT: shared with declaration-front-matter.ts, which reads the same `---`-delimited block
// for a different field. `present: false` is a file carrying no frontmatter at all; `parsed:
// false` is a block that exists but whose YAML could not be parsed — the two must stay distinct,
// since a rule with no frontmatter is decided (always-loaded) while one with broken frontmatter is
// not decided at all.
export function readFrontMatter(content: string): FrontMatterReading {
  const match = FRONT_MATTER_BLOCK.exec(content)
  if (match === null) return { present: false }

  let data: unknown
  try {
    data = parse(match[1] ?? '')
  } catch {
    return { present: true, parsed: false }
  }

  return {
    present: true,
    parsed: true,
    data: typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {},
    body: match[2] ?? '',
  }
}

export type RuleTierReading =
  | { readonly decided: true; readonly tier: LoadingTier }
  | { readonly decided: false; readonly reason: 'INVALID_RULE_FRONT_MATTER' }

// INVARIANT: a rule declaring `paths:` loads only on the glob it names — CONDITIONALLY_LOADED. A
// rule with no frontmatter, or frontmatter with no `paths` key, carries no such restriction and is
// ALWAYS_LOADED. Frontmatter present but unparseable is undecided rather than guessed into either
// tier: a rule the reader could not understand says nothing about when it loads.
export function tierOfRule(content: string): RuleTierReading {
  const frontMatter = readFrontMatter(content)
  if (!frontMatter.present) return { decided: true, tier: 'ALWAYS_LOADED' }
  if (!frontMatter.parsed) return { decided: false, reason: 'INVALID_RULE_FRONT_MATTER' }
  return {
    decided: true,
    tier: 'paths' in frontMatter.data ? 'CONDITIONALLY_LOADED' : 'ALWAYS_LOADED',
  }
}
