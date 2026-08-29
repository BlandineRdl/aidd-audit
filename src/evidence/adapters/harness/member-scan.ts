// INVARIANT: Three answers, not two: proven; decidably absent; and undecidable, which is a source
// that could have proven the member, and that no other route has, refusing to be read.

export interface MemberScan {
  readonly proven: boolean
  readonly undecidable: boolean
}

export const DECIDED_PRESENT: MemberScan = { proven: true, undecidable: false }
