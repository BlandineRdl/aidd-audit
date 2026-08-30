import { stripFencedBlocks } from './prose-share.js'

// LIMITATION: eight words is a chosen boundary, not a measured one, and it must not be tuned so that
// a given repository reports a given number. Measured on this repository: whole-line matching finds
// one shared line in five hundred and eighty-two, and the metric ships looking broken. The same
// repository read as eight-word sequences finds the pairs a reader would in fact name as
// duplicated: two shared runs between the testing rule and the testing memory, and seven between
// the comment rule and the coding-assertions memory. A shorter sequence reports more shared passages,
// most of them common phrasing with nothing to say about duplication; a longer one reports fewer,
// and starts missing a paragraph reworded across two files with the same handful of words changed.
// Eight sits where the pairs a reader would name are found and common phrasing mostly is not.
export const SHINGLE_LENGTH = 8

// INVARIANT: one maximal run of shared words, never a window. Consecutive overlapping sequences
// describe one duplicated passage, so they are merged before being counted: a twelve-word run
// shared between two files is one passage of twelve words, not five sequences of eight. Counting
// the windows inflated every pair by roughly its run length minus seven, and printed a reader five
// near-identical quotations of the same sentence.
export interface SharedPassage {
  readonly words: readonly string[]
}

// LIMITATION: normalised to lowercase with leading and trailing punctuation stripped, so the same
// wording reordered by nothing but case or a trailing comma still counts as the same sequence. What
// it cannot do is recognise the same idea in different words — that is a semantic reading, and this
// measurement never attempts one.
function normaliseWord(raw: string): string {
  return raw.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')
}

export function wordsOf(content: string): readonly string[] {
  return stripFencedBlocks(content)
    .split(/\s+/)
    .map(normaliseWord)
    .filter((word) => word.length > 0)
}

function shingleStartsOf(words: readonly string[]): ReadonlyMap<string, readonly number[]> {
  const starts = new Map<string, number[]>()
  for (let start = 0; start + SHINGLE_LENGTH <= words.length; start += 1) {
    const key = words.slice(start, start + SHINGLE_LENGTH).join(' ')
    const matching = starts.get(key)
    if (matching === undefined) starts.set(key, [start])
    else matching.push(start)
  }
  return starts
}

// INVARIANT: a maximal run advances through both files together. Matching against a set of right
// shingles loses its positions and can merge two adjacent left windows that occur far apart on the
// right, publishing a passage no file actually contains. A run starts only where the preceding
// words differ, then extends while the aligned words remain equal.
function maximalRunsBetween(
  left: readonly string[],
  right: readonly string[],
): readonly SharedPassage[] {
  const rightStarts = shingleStartsOf(right)
  const passages = new Map<string, SharedPassage>()

  for (let leftStart = 0; leftStart + SHINGLE_LENGTH <= left.length; leftStart += 1) {
    const key = left.slice(leftStart, leftStart + SHINGLE_LENGTH).join(' ')
    const matches = rightStarts.get(key)
    if (matches === undefined) continue

    for (const rightStart of matches) {
      if (leftStart > 0 && rightStart > 0 && left[leftStart - 1] === right[rightStart - 1]) continue

      let length = SHINGLE_LENGTH
      while (
        leftStart + length < left.length &&
        rightStart + length < right.length &&
        left[leftStart + length] === right[rightStart + length]
      ) {
        length += 1
      }

      const words = left.slice(leftStart, leftStart + length)
      passages.set(words.join(' '), { words })
    }
  }

  return [...passages.values()]
}

// INVARIANT: reports which sequences are shared and what they are, never a ratio, a percentage, or a
// threshold above which a pair counts as duplicated. Two files sharing one passage and two files
// sharing forty are both just named with their count and their passages; calling either one
// "duplicated" is a reading left to whoever consumes this figure.
export function sharedPassagesBetween(
  leftContent: string,
  rightContent: string,
): readonly SharedPassage[] {
  const left = wordsOf(leftContent)
  return maximalRunsBetween(left, wordsOf(rightContent))
}
