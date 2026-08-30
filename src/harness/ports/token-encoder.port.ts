export interface TokenEstimate {
  readonly tokens: number
  readonly encoding: string
}

// LIMITATION: an estimate, never the model's own count. The count a model provider would bill is
// produced by that provider's own tokenizer at inference time, over details this port cannot see —
// which model, and whatever preprocessing sits in front of it — and getting it would mean a network
// call this tool refuses to make. What this port promises instead is a deterministic, offline
// approximation under one named, stable encoding: two figures it produced may be compared to each
// other, but neither should be read as what a bill would show.
export interface TokenEncoderPort {
  readonly encoding: string
  estimate(text: string): TokenEstimate
}
