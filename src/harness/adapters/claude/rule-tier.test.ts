import { describe, expect, it } from 'vitest'
import { tierOfRule } from './rule-tier.js'

describe('the tier a rule actually loads in', () => {
  it('places a rule declaring paths in the conditional tier', () => {
    const content = ['---', 'paths:', '  - "src/**/*.ts"', '---', '', '# A rule'].join('\n')

    expect(tierOfRule(content)).toEqual({ decided: true, tier: 'CONDITIONALLY_LOADED' })
  })

  it('places a rule with frontmatter but no paths key in the always-loaded tier', () => {
    const content = ['---', 'name: something', '---', '', '# A rule'].join('\n')

    expect(tierOfRule(content)).toEqual({ decided: true, tier: 'ALWAYS_LOADED' })
  })

  it('places a rule carrying no frontmatter at all in the always-loaded tier', () => {
    expect(tierOfRule('# A rule with no frontmatter block')).toEqual({
      decided: true,
      tier: 'ALWAYS_LOADED',
    })
  })

  it('reports a rule as undecided when its frontmatter cannot be parsed', () => {
    const content = ['---', 'paths: [', '---', '# A rule'].join('\n')

    expect(tierOfRule(content)).toEqual({
      decided: false,
      reason: 'INVALID_RULE_FRONT_MATTER',
    })
  })
})
