import { splitLines } from './file-length.js'

// INVARIANT: what this measurement counts as a list line, stated once and carried on every report
// so a rendering never assumes a reading it does not state. A bullet, an ordered item, or a table
// row; nothing else. Blank lines and anything inside a fenced code block are not counted on either
// side — they are not prose either.
export const LIST_LINE_READING =
  'a line beginning with -, *, or +; a digit followed by . or ); or | for a table row — blank lines ' +
  'and lines inside a fenced code block are counted as neither prose nor list'

const FENCE = /^```/
const BULLET = /^[-*+]\s+/
const ORDERED = /^\d+[.)]\s+/
const TABLE_ROW = /^\|/

function isListLine(trimmed: string): boolean {
  return BULLET.test(trimmed) || ORDERED.test(trimmed) || TABLE_ROW.test(trimmed)
}

// INVARIANT: shared with shared-passages.ts, which drops the same fenced blocks before it normalises
// words. A fence tracked two different ways in two files would let the two measurements disagree
// about which lines of the same file they each read.
export function stripFencedBlocks(content: string): string {
  const kept: string[] = []
  let inFence = false
  for (const line of splitLines(content)) {
    if (FENCE.test(line.trim())) {
      inFence = !inFence
      continue
    }
    if (!inFence) kept.push(line)
  }
  return kept.join('\n')
}

// INVARIANT: countable is false exactly when no line in the file could be classified as prose or
// list — every line was blank or fenced. That is not a share of zero: nothing was measured, so
// nothing is divided. Folding it into listLines: 0, proseLines: 0 would read as a file proven to
// hold no list content, which was never observed.
export type ProseShare =
  | { readonly countable: true; readonly listLines: number; readonly proseLines: number }
  | { readonly countable: false }

export function measureProseShare(content: string): ProseShare {
  let listLines = 0
  let proseLines = 0
  let inFence = false

  for (const line of splitLines(content)) {
    const trimmed = line.trim()
    if (FENCE.test(trimmed)) {
      inFence = !inFence
      continue
    }
    if (inFence || trimmed === '') continue
    if (isListLine(trimmed)) listLines += 1
    else proseLines += 1
  }

  if (listLines + proseLines === 0) return { countable: false }
  return { countable: true, listLines, proseLines }
}
