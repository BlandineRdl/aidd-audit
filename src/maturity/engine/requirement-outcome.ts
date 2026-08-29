import type { LevelRequirement, MaturityModel } from '../models/maturity.model.js'
import type { AxisObservation } from '../models/axis-observation.model.js'
import type { Outcome } from '../models/requirement-result.model.js'
import { reaches } from './scale-comparison.js'

// The conservative rule: anything short of CONFIRMED is UNPROVEN, never NOT_MET.
export function outcomeOf(
  model: MaturityModel,
  requirement: LevelRequirement,
  observation: AxisObservation | undefined,
): Outcome {
  if (observation === undefined || observation.confidence !== 'CONFIRMED') {
    return 'UNPROVEN'
  }

  return reaches(model, requirement, observation.value) ? 'MET' : 'NOT_MET'
}

// INVARIANT: NOT_MET dominates UNPROVEN — proven failure is stronger than missing evidence.
// Requires at least one outcome, or a level silent on an axis would score MET.
export function aggregate(outcomes: readonly Outcome[]): Outcome {
  if (outcomes.includes('NOT_MET')) return 'NOT_MET'
  if (outcomes.includes('UNPROVEN')) return 'UNPROVEN'
  return 'MET'
}
