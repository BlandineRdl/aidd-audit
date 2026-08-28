export type AxisId = string

export type AxisVocabulary =
  | {
      readonly axis: AxisId
      readonly kind: 'ordinal'
      readonly values: readonly string[]
    }
  | {
      readonly axis: AxisId
      readonly kind: 'set'
      readonly members: readonly string[]
    }
  | {
      readonly axis: AxisId
      readonly kind: 'numeric'
    }
