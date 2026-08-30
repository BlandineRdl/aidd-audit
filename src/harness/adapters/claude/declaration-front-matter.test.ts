import { describe, expect, it } from 'vitest'
import { splitDeclaration } from './declaration-front-matter.js'

describe('splitting a skill, agent or command into its description and its body', () => {
  it('measures the description apart from the body', () => {
    const content = [
      '---',
      'name: my-skill',
      'description: A short summary of what this does.',
      '---',
      '',
      'The full body, read only once the skill is invoked.',
    ].join('\n')

    expect(splitDeclaration(content)).toEqual({
      decided: true,
      description: 'A short summary of what this does.',
      body: '\nThe full body, read only once the skill is invoked.',
    })
  })

  it('is undecided for a file with no frontmatter at all', () => {
    expect(splitDeclaration('# Just a body, no frontmatter')).toEqual({
      decided: false,
      reason: 'MISSING_DECLARATION_FRONT_MATTER',
    })
  })

  it('is undecided for frontmatter with no description field', () => {
    const content = ['---', 'name: my-skill', '---', 'body'].join('\n')

    expect(splitDeclaration(content)).toEqual({
      decided: false,
      reason: 'MISSING_DECLARATION_DESCRIPTION',
    })
  })

  it('is undecided when the frontmatter cannot be parsed', () => {
    const content = ['---', 'description: [', '---', 'body'].join('\n')

    expect(splitDeclaration(content)).toEqual({
      decided: false,
      reason: 'INVALID_DECLARATION_FRONT_MATTER',
    })
  })
})
