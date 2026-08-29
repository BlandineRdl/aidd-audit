import type { Axis, AxisId, Level, MaturityModel } from '../models/maturity.model.js'
import type { AxisObservation } from '../models/axis-observation.model.js'
import type {
  AxisResult,
  LevelResult,
  RequirementResult,
} from '../models/requirement-result.model.js'
import { InvalidMaturityModelError } from '../models/invalid-maturity-model.error.js'
import { InvalidObservationError } from './invalid-observation.error.js'
import { aggregate, outcomeOf } from './requirement-outcome.js'

export interface MaturityCheck {
  // Ordered by rank, whatever order the model declared them in.
  readonly levels: readonly LevelResult[]
  readonly proven: LevelResult | null
  // INVARIANT: strictly the level above proven, or the lowest level when none is proven; its own
  // outcome says why it blocks. Null once the top level is proven.
  readonly next: LevelResult | null
}

// Assumes a well-formed, cumulative model. `loading/` owes both.
export function checkMaturity(
  model: MaturityModel,
  observations: readonly AxisObservation[],
): MaturityCheck {
  const observationsByAxis = indexObservations(observations)
  const levels = evaluateLevels(model, observationsByAxis)
  const proven = highestProven(levels)
  const next = levelAbove(levels, proven)

  return { levels, proven, next }
}

type ObservationsByAxis = ReadonlyMap<AxisId, AxisObservation>

// Keeping the last would let collection order decide. Resolution is the evidence context's job.
function indexObservations(observations: readonly AxisObservation[]): ObservationsByAxis {
  const byAxis = new Map<AxisId, AxisObservation>()
  for (const observation of observations) {
    if (byAxis.has(observation.axis)) {
      throw new InvalidObservationError(`Duplicate observation for axis '${observation.axis}'.`)
    }
    byAxis.set(observation.axis, observation)
  }
  return byAxis
}

function evaluateLevels(
  model: MaturityModel,
  observations: ObservationsByAxis,
): readonly LevelResult[] {
  return [...model.levels]
    .sort((a, b) => a.rank - b.rank)
    .map((level) => evaluateLevel(model, level, observations))
}

function evaluateLevel(
  model: MaturityModel,
  level: Level,
  observations: ObservationsByAxis,
): LevelResult {
  requireDeclaredAxes(model, level)

  const axes = model.axes.map((axis) => evaluateAxis(model, level, axis, observations))
  return { level, outcome: aggregate(axes.map((axis) => axis.outcome)), axes }
}

// SAFETY: evaluation walks the model's axes, so a requirement naming an axis the model doesn't
// declare would be dropped without a word instead of rejected.
function requireDeclaredAxes(model: MaturityModel, level: Level): void {
  const declared = new Set(model.axes.map((axis) => axis.id))
  for (const requirement of level.requirements) {
    if (!declared.has(requirement.axis)) {
      throw new InvalidMaturityModelError(
        `Level '${level.id}' requires an axis the model does not declare: '${requirement.axis}'.`,
      )
    }
  }
}

function evaluateAxis(
  model: MaturityModel,
  level: Level,
  axis: Axis,
  observations: ObservationsByAxis,
): AxisResult {
  const observation = observations.get(axis.id)
  const declared = level.requirements.filter((requirement) => requirement.axis === axis.id)
  if (declared.length === 0) {
    throw new InvalidMaturityModelError(
      `Level '${level.id}' declares no requirement for axis '${axis.id}'.`,
    )
  }

  const requirements = declared.map(
    (requirement): RequirementResult => ({
      axis: axis.id,
      requirement,
      outcome: outcomeOf(model, requirement, observation),
    }),
  )

  return {
    axis: axis.id,
    outcome: aggregate(requirements.map((requirement) => requirement.outcome)),
    requirements,
  }
}

function highestProven(levels: readonly LevelResult[]): LevelResult | null {
  return [...levels].reverse().find((result) => result.outcome === 'MET') ?? null
}

function levelAbove(
  levels: readonly LevelResult[],
  proven: LevelResult | null,
): LevelResult | null {
  if (proven === null) return levels[0] ?? null
  return levels.find((result) => result.level.rank > proven.level.rank) ?? null
}
