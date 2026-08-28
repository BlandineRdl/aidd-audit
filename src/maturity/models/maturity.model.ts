export type AxisId = string
export type ScaleId = string

export interface OrdinalScale {
  readonly kind: 'ordinal'
  /** Ascending. Position in this array is the order. */
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
  /** Canonical ordering. Declaration order carries no meaning. */
  readonly rank: number
  readonly label: string
  readonly requirements: readonly LevelRequirement[]
}

/** A minimum on an ordinal or numeric scale. */
export interface MinRequirement {
  readonly axis: AxisId
  readonly min: string | number
}

/** Every member that must be present on a set scale. */
export interface SetRequirement {
  readonly axis: AxisId
  readonly includes: readonly string[]
}

export type LevelRequirement = MinRequirement | SetRequirement

export function isSetRequirement(requirement: LevelRequirement): requirement is SetRequirement {
  return 'includes' in requirement
}
