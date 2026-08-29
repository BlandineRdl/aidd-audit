import {
  isSetRequirement,
  type LevelRequirement,
  type MaturityModel,
  type MinRequirement,
  type OrdinalScale,
  type SetRequirement,
} from '../models/maturity.model.js'
import type { ObservedValue } from '../models/axis-observation.model.js'
import { scaleForAxis } from '../models/scale-for-axis.js'
import { requireThresholdOnScale } from '../models/threshold-on-scale.js'
import { InvalidObservationError } from './invalid-observation.error.js'

export function reaches(
  model: MaturityModel,
  requirement: LevelRequirement,
  value: ObservedValue,
): boolean {
  const scale = scaleForAxis(model, requirement.axis)
  requireThresholdOnScale(scale, requirement)

  if (isSetRequirement(requirement)) {
    return holdsEveryMember(requirement, value)
  }

  if (scale.kind === 'ordinal') {
    return reachesOrdinalRank(scale, requirement, value)
  }

  return meetsNumericMinimum(requirement, value)
}

function holdsEveryMember(requirement: SetRequirement, value: ObservedValue): boolean {
  if (!isMemberSet(value)) {
    throw new InvalidObservationError(`Axis '${requirement.axis}' expects a set of values.`)
  }

  return requirement.includes.every((member) => value.includes(member))
}

function reachesOrdinalRank(
  scale: OrdinalScale,
  requirement: MinRequirement,
  value: ObservedValue,
): boolean {
  const observedRank = scale.values.indexOf(String(value))

  if (observedRank === -1) {
    throw new InvalidObservationError(
      `Value '${String(value)}' is not on the '${requirement.axis}' scale.`,
    )
  }

  return observedRank >= scale.values.indexOf(String(requirement.min))
}

function meetsNumericMinimum(requirement: MinRequirement, value: ObservedValue): boolean {
  if (typeof value !== 'number') {
    throw new InvalidObservationError(`Axis '${requirement.axis}' expects a numeric value.`)
  }

  return value >= Number(requirement.min)
}

// `Array.isArray` does not narrow the readonly array member of ObservedValue.
function isMemberSet(value: ObservedValue): value is readonly string[] {
  return Array.isArray(value)
}
