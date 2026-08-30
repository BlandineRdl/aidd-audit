// INVARIANT: exactly two values. SUBJECT is carried by the audited repository, so the same subject
// reproduces the same figures on any machine. MACHINE is carried by the tool's own local
// configuration, so it reproduces only against an unchanged machine — the same claim this tool
// already makes for a source living outside its subject. Merging the two into one total would
// publish a figure honest about neither, which is why a report never sums across scopes either.
export const READING_SCOPES = ['SUBJECT', 'MACHINE'] as const

export type ReadingScope = (typeof READING_SCOPES)[number]
