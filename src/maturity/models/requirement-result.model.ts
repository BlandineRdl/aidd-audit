import type { AxisId, Level, LevelRequirement } from './maturity.model.js'

/**
 * Assessment outcomes. Distinct from evidence confidence: `UNPROVEN` says the
 * evidence could not settle the requirement, never that the minimum was missed.
 */
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
  /** A level is reached when this is MET. No second field can contradict it. */
  readonly outcome: Outcome
  readonly axes: readonly AxisResult[]
}
