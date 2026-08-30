// INVARIANT: the renderer names what a fragment means, never how it looks, and this is the only
// file in the tree that knows an escape sequence. Every member is a whole-string transform, so
// `plainText` renders the exact bytes that shipped before colour existed and a piped run can never
// be a colourised run with the codes stripped by luck.
export interface TextStyle {
  heading(text: string): string
  faint(text: string): string
  satisfied(text: string): string
  practiceGap(text: string): string
  evidenceGap(text: string): string
}

export const plainText: TextStyle = {
  heading: (text) => text,
  faint: (text) => text,
  satisfied: (text) => text,
  practiceGap: (text) => text,
  evidenceGap: (text) => text,
}

// SAFETY: the basic set only — bold, faint and three of the eight ECMA-48 colours, all of which a
// terminal maps to its own theme. A 256-colour palette or a background fill picks an absolute value
// that is unreadable on a light theme, on a dark one, or on both, and nothing in this report is
// worth that.
//
// INVARIANT: a practice gap and an evidence gap take different colours, as they take different
// words. Colour is the faster channel, so collapsing them here would collapse the distinction for
// every reader who scans before reading.
const styled = (code: string) => (text: string) => `\u001b[${code}m${text}\u001b[0m`

export const colouredText: TextStyle = {
  heading: styled('1'),
  faint: styled('2'),
  satisfied: styled('32'),
  practiceGap: styled('31'),
  evidenceGap: styled('33'),
}
