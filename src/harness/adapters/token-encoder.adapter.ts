import { countTokens } from 'gpt-tokenizer/encoding/o200k_base'
import type { TokenEncoderPort, TokenEstimate } from '../ports/token-encoder.port.js'

// LIMITATION: named explicitly rather than read off the package's default export, so a future major
// of gpt-tokenizer moving its default encoding cannot silently move the encoding this figure was
// produced under. The name travels on every estimate this adapter produces.
const ENCODING = 'o200k_base'

// INVARIANT: o200k_base over the older cl100k_base. Measured on this repository's own files, the two
// encodings differ by up to a third on the same bytes, and cl100k_base over-counts the French
// memory files specifically — levels/aidd.md by 10.2%, README.md by 8.4% — while reading as correct
// on the English ones. A bias that moves per file, rather than applying evenly, would destroy the
// file-to-file comparison this whole measurement exists to support: a harness holding more than one
// natural language must not become comparable only by accident of which language happened to be
// under-counted less.
export class GptTokenizerEncoderAdapter implements TokenEncoderPort {
  readonly encoding = ENCODING

  estimate(text: string): TokenEstimate {
    return { tokens: countTokens(text), encoding: ENCODING }
  }
}
