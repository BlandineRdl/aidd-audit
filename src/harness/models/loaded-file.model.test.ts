import { describe, expect, it } from 'vitest'
import type { LoadedFile } from './loaded-file.model.js'

describe('a loaded file', () => {
  it('cannot be constructed without a tier', () => {
    // @ts-expect-error a loaded file with no tier does not typecheck: nothing here may default it.
    const missingTier: LoadedFile = {
      path: 'CLAUDE.md',
      byteSize: 10,
      lineCount: 1,
      tokenEstimate: 3,
      scope: 'SUBJECT',
    }

    expect(missingTier.path).toBe('CLAUDE.md')
  })

  it('cannot be constructed without a scope', () => {
    // @ts-expect-error a loaded file with no scope does not typecheck: nothing here may default it.
    const missingScope: LoadedFile = {
      path: 'CLAUDE.md',
      byteSize: 10,
      lineCount: 1,
      tokenEstimate: 3,
      tier: 'ALWAYS_LOADED',
    }

    expect(missingScope.path).toBe('CLAUDE.md')
  })

  it('is constructed once both are given', () => {
    const file: LoadedFile = {
      path: 'CLAUDE.md',
      byteSize: 10,
      lineCount: 1,
      tokenEstimate: 3,
      tier: 'ALWAYS_LOADED',
      scope: 'SUBJECT',
    }

    expect(file.tier).toBe('ALWAYS_LOADED')
    expect(file.scope).toBe('SUBJECT')
  })
})
