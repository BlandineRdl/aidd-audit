import type { TokenEncoderPort, TokenEstimate } from '../ports/token-encoder.port.js'

// LIMITATION: a controlled double, not a real encoder — no real file drives the JSON renderer's
// refusal path, so this is how that path is proven at all.
export class InfiniteTokenEncoderTestAdapter implements TokenEncoderPort {
  readonly encoding = 'test-infinite'

  estimate(_text: string): TokenEstimate {
    return { tokens: Number.POSITIVE_INFINITY, encoding: this.encoding }
  }
}
