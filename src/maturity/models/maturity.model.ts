export type AxisId = string
export type ScaleId = string

export interface OrdinalScale {
  readonly kind: 'ordinal'
  readonly values: readonly string[]
}

export interface SetScale {
  readonly kind: 'set'
  readonly members: readonly string[]
}

export interface NumericScale {
  readonly kind: 'numeric'
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
