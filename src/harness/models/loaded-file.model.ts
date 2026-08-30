import type { LoadingTier } from './loading-tier.model.js'
import type { ReadingScope } from './reading-scope.model.js'

// INVARIANT: tier and scope are required fields, never optional and never defaulted. A figure
// without a tier cannot be totalled honestly — it would have to be guessed into ALWAYS_LOADED or
// CONDITIONALLY_LOADED — and a figure without a scope cannot be reproduced, since a reader would not
// know whether to expect the same bytes on a different machine. Both are made unrepresentable by
// absence rather than caught after the fact: there is no constructor here to skip, only this shape.
export interface LoadedFile {
  readonly path: string
  readonly byteSize: number
  readonly lineCount: number
  readonly tokenEstimate: number
  readonly tier: LoadingTier
  readonly scope: ReadingScope
}
