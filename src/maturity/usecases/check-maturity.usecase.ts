import {
  isSetRequirement,
  type AxisId,
  type LevelRequirement,
  type MaturityModel,
  type Scale,
} from '../models/maturity.model.js'
import type { AxisObservation } from '../models/axis-observation.model.js'
import type {
  AxisResult,
  LevelResult,
  Outcome,
  RequirementResult,
} from '../models/requirement-result.model.js'

export interface MaturityCheck {
  /** Every level of the model, ordered by rank. */
  readonly levels: readonly LevelResult[]
  /** The highest fully satisfied level, or null when none is proven. */
  readonly proven: LevelResult | null
  /** The lowest unsatisfied level above the proven one, or null at the top. */
  readonly next: LevelResult | null
}

export class MaturityModelError extends Error {}

/**
 * The deterministic decision engine.
 *
 * Same model and same observations always yield the same result. It reads no
 * file, spawns no process, and consults no language model.
 */
export function checkMaturity(
  model: MaturityModel,
  observations: readonly AxisObservation[],
): MaturityCheck {
  const observed = new Map<AxisId, AxisObservation>()
  for (const observation of observations) observed.set(observation.axis, observation)

  const levels = [...model.levels]
    .sort((a, b) => a.rank - b.rank)
    .map((level): LevelResult => {
      const axes = model.axes.map((axis): AxisResult => {
        const requirements = level.requirements
          .filter((requirement) => requirement.axis === axis.id)
          .map((requirement): RequirementResult => ({
            axis: axis.id,
            requirement,
            outcome: resolve(model, requirement, observed.get(axis.id)),
          }))
        return { axis: axis.id, outcome: aggregate(requirements.map((r) => r.outcome)), requirements }
      })

      const outcome = aggregate(axes.map((a) => a.outcome))
      return { level, outcome, satisfied: outcome === 'MET', axes }
    })

  const satisfied = levels.filter((result) => result.satisfied)
  const proven = satisfied.length > 0 ? satisfied[satisfied.length - 1]! : null
  const next = levels.find(
    (result) => !result.satisfied && (proven === null || result.level.rank > proven.level.rank),
  )

  return { levels, proven, next: next ?? null }
}

/**
 * A requirement is MET only when CONFIRMED evidence reaches the minimum.
 * CLAIMED, CONFLICTING, UNKNOWN and a missing observation all yield UNPROVEN:
 * "not proven" is never reported as "not reached".
 */
function resolve(
  model: MaturityModel,
  requirement: LevelRequirement,
  observation: AxisObservation | undefined,
): Outcome {
  if (observation === undefined) return 'UNPROVEN'
  if (observation.confidence !== 'CONFIRMED') return 'UNPROVEN'
  if (observation.value === null) return 'UNPROVEN'
  return reaches(scaleOf(model, requirement.axis), requirement, observation.value) ? 'MET' : 'NOT_MET'
}

/**
 * NOT_MET dominates UNPROVEN: evidence that disproves a minimum is a firmer
 * answer than evidence that is missing. An empty requirement list is MET,
 * which is what makes an axis a level says nothing about satisfiable.
 */
function aggregate(outcomes: readonly Outcome[]): Outcome {
  if (outcomes.includes('NOT_MET')) return 'NOT_MET'
  if (outcomes.includes('UNPROVEN')) return 'UNPROVEN'
  return 'MET'
}

function reaches(
  scale: Scale,
  requirement: LevelRequirement,
  value: string | number | readonly string[],
): boolean {
  if (scale.kind === 'set') {
    if (!isSetRequirement(requirement)) {
      throw new MaturityModelError(`Axis '${requirement.axis}' is a set scale and needs 'includes'.`)
    }
    if (!Array.isArray(value)) {
      throw new MaturityModelError(`Axis '${requirement.axis}' expects a set of values.`)
    }
    return requirement.includes.every((member) => (value as readonly string[]).includes(member))
  }

  if (isSetRequirement(requirement)) {
    throw new MaturityModelError(`Axis '${requirement.axis}' is not a set scale but declares 'includes'.`)
  }

  if (scale.kind === 'numeric') {
    if (typeof value !== 'number' || typeof requirement.min !== 'number') {
      throw new MaturityModelError(`Axis '${requirement.axis}' expects numeric values.`)
    }
    return value >= requirement.min
  }

  const observedRank = scale.values.indexOf(String(value))
  const requiredRank = scale.values.indexOf(String(requirement.min))
  if (observedRank === -1) {
    throw new MaturityModelError(`Value '${String(value)}' is not on the '${requirement.axis}' scale.`)
  }
  if (requiredRank === -1) {
    throw new MaturityModelError(`Threshold '${String(requirement.min)}' is not on the '${requirement.axis}' scale.`)
  }
  return observedRank >= requiredRank
}

function scaleOf(model: MaturityModel, axisId: AxisId): Scale {
  const axis = model.axes.find((candidate) => candidate.id === axisId)
  if (axis === undefined) throw new MaturityModelError(`Unknown axis '${axisId}'.`)
  const scale = model.scales[axis.scale]
  if (scale === undefined) throw new MaturityModelError(`Unknown scale '${axis.scale}'.`)
  return scale
}
