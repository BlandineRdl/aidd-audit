/**
 * The vocabulary a collector is allowed to speak.
 *
 * `evidence` and `maturity` are peers that never import each other, so the
 * shape of a scale is declared on both sides. `assessment` derives this one
 * from the loaded maturity model and hands it to the collectors, which is what
 * keeps a collector from inventing a value the engine would reject.
 */
export type AxisId = string

export type AxisVocabulary =
  | { readonly axis: AxisId; readonly kind: 'ordinal'; readonly values: readonly string[] }
  | { readonly axis: AxisId; readonly kind: 'set'; readonly members: readonly string[] }
  | { readonly axis: AxisId; readonly kind: 'numeric' }
