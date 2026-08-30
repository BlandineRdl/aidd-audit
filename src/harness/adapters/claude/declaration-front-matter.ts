import { readFrontMatter } from './rule-tier.js'

export type DeclarationReading =
  | { readonly decided: true; readonly description: string; readonly body: string }
  | {
      readonly decided: false
      readonly reason:
        | 'MISSING_DECLARATION_FRONT_MATTER'
        | 'INVALID_DECLARATION_FRONT_MATTER'
        | 'MISSING_DECLARATION_DESCRIPTION'
    }

// INVARIANT: follows the tool's own documented split — a skill, an agent and a command contribute
// their frontmatter `description` at session start, and their body only once invoked. A file with
// no frontmatter, unparseable frontmatter, or no `description` field is undecided rather than
// measured as an empty description: nothing here may be guessed into either tier.
export function splitDeclaration(content: string): DeclarationReading {
  const frontMatter = readFrontMatter(content)
  if (!frontMatter.present) {
    return { decided: false, reason: 'MISSING_DECLARATION_FRONT_MATTER' }
  }
  if (!frontMatter.parsed) {
    return { decided: false, reason: 'INVALID_DECLARATION_FRONT_MATTER' }
  }

  const description = frontMatter.data['description']
  if (typeof description !== 'string') {
    return { decided: false, reason: 'MISSING_DECLARATION_DESCRIPTION' }
  }

  return { decided: true, description, body: frontMatter.body }
}
