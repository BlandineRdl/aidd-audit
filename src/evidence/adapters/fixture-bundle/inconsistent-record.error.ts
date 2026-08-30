// INVARIANT: a recorded bundle that contradicts itself. A bundle is a recording, and an inconsistent
// recording is not evidence of anything — reconciling the two halves would publish a number neither
// of them states, and dropping it silently would be indistinguishable from a bundle that recorded
// nothing. Thrown so the collector reports `FAILED` with this message in `provenance`, which is the
// only channel that reaches a reader.
export class InconsistentRecordError extends Error {
  constructor(reason: string) {
    super(`The recorded activity contradicts itself: ${reason}`)
    this.name = 'InconsistentRecordError'
  }
}
