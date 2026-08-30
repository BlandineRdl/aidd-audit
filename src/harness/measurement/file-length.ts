import type { TokenEncoderPort } from '../ports/token-encoder.port.js'

export interface FileLength {
  readonly lineCount: number
  readonly tokenEstimate: number
}

// LIMITATION: a trailing newline ends the last line rather than opening an empty one after it, so
// "a\nb\n" and "a\nb" both count two lines. The newline is a file-format convention an editor adds
// or omits on save, not a third line with no content, and counting it as one would move a file's
// published length depending on that convention rather than on anything the file says.
export function splitLines(content: string): readonly string[] {
  if (content === '') return []
  const withoutTrailingNewline = content.endsWith('\n') ? content.slice(0, -1) : content
  return withoutTrailingNewline.split('\n')
}

export function countLines(content: string): number {
  return splitLines(content).length
}

// INVARIANT: lines and tokens are independent and both published, never one derived from the other.
// A file dense in short lines and a file sparse in long ones can land on opposite sides of each
// figure, and reporting only one would hide whichever axis a reader needed.
export function measureFileLength(content: string, encoder: TokenEncoderPort): FileLength {
  return {
    lineCount: countLines(content),
    tokenEstimate: encoder.estimate(content).tokens,
  }
}
