import type { AxisId, Level, LevelRequirement } from './maturity.model.js'

export type Outcome = 'MET' | 'NOT_MET' | 'UNPROVEN'

export interface RequirementResult {
  readonly axis: AxisId
  readonly requirement: LevelRequirement
  readonly outcome: Outcome
}

export interface AxisResult {
  readonly axis: AxisId
  readonly outcome: Outcome
  readonly requirements: readonly RequirementResult[]
}

export interface LevelResult {
  readonly level: Level
  readonly outcome: Outcome
  readonly axes: readonly AxisResult[]
}
