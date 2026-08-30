import { describe, expect, it } from 'vitest'
import { IMPORT_DEPTH_LIMIT, followImports } from './context-imports.js'

function readerOver(
  files: Readonly<Record<string, string>>,
): (path: string) => Promise<string | null> {
  return async (path) => (path in files ? files[path]! : null)
}

describe("following a context file's @ imports", () => {
  it('finds every file a context file imports, resolved relative to the importing file', async () => {
    const read = readerOver({ 'memory/architecture.md': 'architecture content' })

    const result = await followImports('CLAUDE.md', '@memory/architecture.md', read)

    expect(result).toEqual([{ path: 'memory/architecture.md', content: 'architecture content' }])
  })

  it('resolves an import relative to the importing file, not to the entry file', async () => {
    const read = readerOver({
      'memory/root.md': '@nested/child.md',
      'memory/nested/child.md': 'child content',
    })

    const result = await followImports('CLAUDE.md', '@memory/root.md', read)

    expect(result).toContainEqual({ path: 'memory/root.md', content: '@nested/child.md' })
    expect(result).toContainEqual({ path: 'memory/nested/child.md', content: 'child content' })
  })

  it('preserves an absolute ~/.claude import and resolves its descendants from that directory', async () => {
    const read = readerOver({
      '~/.claude/memory/root.md': '@child.md',
      '~/.claude/memory/child.md': 'child content',
    })

    const result = await followImports('CLAUDE.md', '@~/.claude/memory/root.md', read)

    expect(result).toEqual([
      { path: '~/.claude/memory/root.md', content: '@child.md' },
      { path: '~/.claude/memory/child.md', content: 'child content' },
    ])
  })

  it('does not count an import mentioned inside a fenced code block', async () => {
    const content = ['```', '@fenced-import.md', '```', '@real-import.md'].join('\n')
    const read = readerOver({
      'real-import.md': 'real content',
      'fenced-import.md': 'fenced content',
    })

    const result = await followImports('CLAUDE.md', content, read)

    expect(result).toEqual([{ path: 'real-import.md', content: 'real content' }])
  })

  it('does not count an import mentioned inside inline backticks', async () => {
    const content = 'See `@backticked-import.md` for details, or @real-import.md directly.'
    const read = readerOver({
      'real-import.md': 'real content',
      'backticked-import.md': 'backticked content',
    })

    const result = await followImports('CLAUDE.md', content, read)

    expect(result).toEqual([{ path: 'real-import.md', content: 'real content' }])
  })

  it('reports a named but missing import as unread, distinct from a file read and found empty', async () => {
    const read = readerOver({ 'present.md': '' })

    const result = await followImports('CLAUDE.md', '@missing.md @present.md', read)

    expect(result).toContainEqual({ path: 'missing.md', content: null })
    expect(result).toContainEqual({ path: 'present.md', content: '' })
  })

  it('terminates an import cycle and counts each file exactly once', async () => {
    const read = readerOver({ 'a.md': '@b.md', 'b.md': '@a.md' })

    const result = await followImports('a.md', '@b.md', read)

    expect(result).toEqual([{ path: 'b.md', content: '@a.md' }])
  })

  it('stops following imports past the documented depth of four', async () => {
    const read = readerOver({
      'd1.md': '@d2.md',
      'd2.md': '@d3.md',
      'd3.md': '@d4.md',
      'd4.md': '@d5.md',
      'd5.md': 'never reached',
    })

    const result = await followImports('CLAUDE.md', '@d1.md', read)
    const paths = result.map((file) => file.path).sort()

    expect(paths).toEqual(['d1.md', 'd2.md', 'd3.md', 'd4.md'])
    expect(IMPORT_DEPTH_LIMIT).toBe(4)
  })

  it('reports nothing for a file with no imports at all', async () => {
    const result = await followImports('CLAUDE.md', 'just prose, no imports here', readerOver({}))

    expect(result).toEqual([])
  })
})
