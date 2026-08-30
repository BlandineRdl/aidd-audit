export type AxisId = string
export type ScaleId = string

export interface OrdinalScale {
  readonly kind: 'ordinal'
  readonly values: readonly string[]
  readonly descriptions: Readonly<Record<string, string>>
}

export interface SetScale {
  readonly kind: 'set'
  readonly members: readonly string[]
  readonly descriptions: Readonly<Record<string, string>>
}

export interface NumericScale {
  readonly kind: 'numeric'
  // INVARIANT: A numeric value needs its unit to be intelligible. It is model vocabulary, not renderer copy:
  // different models can measure a count, duration or rate on the same numeric engine primitive.
  readonly description: string
}

export type Scale = OrdinalScale | SetScale | NumericScale

export interface Axis {
  readonly id: AxisId
  readonly label: string
  readonly scale: ScaleId
}

export interface MaturityModel {
  readonly schemaVersion: number
  readonly id: string
  readonly scales: Readonly<Record<ScaleId, Scale>>
  readonly axes: readonly Axis[]
  readonly levels: readonly Level[]
}

export interface Level {
  readonly id: string
  readonly rank: number
  readonly label: string
  readonly requirements: readonly LevelRequirement[]
}

export interface MinRequirement {
  readonly axis: AxisId
  readonly min: string | number
}

export interface SetRequirement {
  readonly axis: AxisId
  readonly includes: readonly string[]
}

export type LevelRequirement = MinRequirement | SetRequirement

export function isSetRequirement(requirement: LevelRequirement): requirement is SetRequirement {
  return 'includes' in requirement
}
