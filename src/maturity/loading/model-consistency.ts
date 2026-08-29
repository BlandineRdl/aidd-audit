import { InvalidMaturityModelError } from '../models/invalid-maturity-model.error.js'
import {
  isSetRequirement,
  type AxisId,
  type Level,
  type LevelRequirement,
  type MaturityModel,
  type Scale,
} from '../models/maturity.model.js'
import { scaleNamedBy } from '../models/scale-for-axis.js'
import { requireThresholdOnScale } from '../models/threshold-on-scale.js'

// INVARIANT: call order is load-bearing — cumulativity compares two levels' thresholds, so it needs
// coverage to have proven both levels exist and vocabulary to have proven they are comparable.
export function requireVocabulary(model: MaturityModel): void {
  const scaleByAxis = scalesByAxis(model)

  for (const level of model.levels) {
    for (const requirement of level.requirements) {
      const scale = scaleByAxis.get(requirement.axis)
      // An axis absent from scaleByAxis is undeclared — Coverage rejects that.
      if (scale === undefined) continue
      requireThresholdOnScale(scale, requirement, `Level '${level.id}'`)
    }
  }
}

export function requireCoverage(model: MaturityModel): void {
  requireDistinctRanks(model.levels)

  const declaredAxes = new Set(model.axes.map((axis) => axis.id))

  for (const level of model.levels) {
    const counts = new Map<AxisId, number>()
    for (const requirement of level.requirements) {
      if (!declaredAxes.has(requirement.axis)) {
        throw new InvalidMaturityModelError(
          `Level '${level.id}' requires an axis the model does not declare: '${requirement.axis}'.`,
        )
      }
      counts.set(requirement.axis, (counts.get(requirement.axis) ?? 0) + 1)
    }

    for (const axisId of declaredAxes) {
      const count = counts.get(axisId) ?? 0
      if (count === 0) {
        throw noRequirementFor(level.id, axisId)
      }
      if (count > 1) {
        throw new InvalidMaturityModelError(
          `Level '${level.id}' declares axis '${axisId}' more than once.`,
        )
      }
    }
  }
}

function requireDistinctRanks(levels: readonly Level[]): void {
  const seen = new Set<number>()
  for (const level of levels) {
    if (seen.has(level.rank)) {
      throw new InvalidMaturityModelError(`Rank ${level.rank} is used by more than one level.`)
    }
    seen.add(level.rank)
  }
}

export function requireCumulativity(model: MaturityModel): void {
  const scaleByAxis = scalesByAxis(model)
  const sorted = [...model.levels].sort((a, b) => a.rank - b.rank)

  // Pairwise over the sorted ranks: `lower` is undefined only on the first level, which is real.
  let lower: Level | undefined
  for (const higher of sorted) {
    if (lower !== undefined) requireNoDip(lower, higher, scaleByAxis)
    lower = higher
  }
}

function requireNoDip(lower: Level, higher: Level, scaleByAxis: ReadonlyMap<AxisId, Scale>): void {
  for (const [axisId, scale] of scaleByAxis) {
    const lowerRequirement = requirementOn(lower, axisId)
    const higherRequirement = requirementOn(higher, axisId)

    if (!reachesOrExceeds(scale, lowerRequirement, higherRequirement)) {
      throw new InvalidMaturityModelError(
        `Level '${higher.id}' asks less than '${lower.id}' on axis '${axisId}': ` +
          `a higher rank must never ask less than the rank below it.`,
      )
    }
  }
}

// INVARIANT: throws rather than skipping. `requireCoverage` has already proven exactly one
// requirement per declared axis per level, so an absence here is a defect in this file's call
// order, and a silent `continue` would report a model cumulative that was never compared.
function requirementOn(level: Level, axisId: AxisId): LevelRequirement {
  const requirement = level.requirements.find((candidate) => candidate.axis === axisId)
  if (requirement === undefined) throw noRequirementFor(level.id, axisId)
  return requirement
}

function scalesByAxis(model: MaturityModel): ReadonlyMap<AxisId, Scale> {
  return new Map(model.axes.map((axis) => [axis.id, scaleNamedBy(model, axis)]))
}

function noRequirementFor(levelId: string, axisId: AxisId): InvalidMaturityModelError {
  return new InvalidMaturityModelError(
    `Level '${levelId}' declares no requirement for axis '${axisId}'.`,
  )
}

// SAFETY: the `never` in `default` is what forces a new `Scale` kind to get a comparison here —
// without it a fourth kind silently inherits `true` and every model becomes cumulative. No test can
// reach that branch; only this compiles it shut.
function reachesOrExceeds(
  scale: Scale,
  lower: LevelRequirement,
  higher: LevelRequirement,
): boolean {
  switch (scale.kind) {
    case 'set': {
      if (!isSetRequirement(lower) || !isSetRequirement(higher)) {
        throw new InvalidMaturityModelError(
          `A set scale requires an 'includes' requirement to compare cumulativity.`,
        )
      }
      return lower.includes.every((member) => higher.includes.includes(member))
    }
    case 'numeric': {
      if (isSetRequirement(lower) || isSetRequirement(higher)) {
        throw new InvalidMaturityModelError(
          `A numeric scale requires a 'min' requirement to compare cumulativity.`,
        )
      }
      return Number(higher.min) >= Number(lower.min)
    }
    case 'ordinal': {
      if (isSetRequirement(lower) || isSetRequirement(higher)) {
        throw new InvalidMaturityModelError(
          `An ordinal scale requires a 'min' requirement to compare cumulativity.`,
        )
      }
      return scale.values.indexOf(String(higher.min)) >= scale.values.indexOf(String(lower.min))
    }
    default: {
      const exhaustive: never = scale
      throw new InvalidMaturityModelError(`Unknown scale kind: ${JSON.stringify(exhaustive)}.`)
    }
  }
}
