import {
  isSetRequirement,
  type AxisId,
  type LevelRequirement,
  type MaturityModel,
  type MinRequirement,
  type OrdinalScale,
  type Scale,
  type SetRequirement,
} from '../models/maturity.model.js'
import type { ObservedValue } from '../models/axis-observation.model.js'
import { InvalidMaturityModelError } from '../models/invalid-maturity-model.error.js'
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

function scaleForAxis(model: MaturityModel, axisId: AxisId): Scale {
  const axis = model.axes.find((candidate) => candidate.id === axisId)
  if (axis === undefined) {
    throw new InvalidMaturityModelError(`Unknown axis '${axisId}'.`)
  }

  // Object.hasOwn, not a bare index: a plain lookup resolves an inherited
  // Object.prototype member (`toString`, …) as if it were a declared scale.
  const scale = Object.hasOwn(model.scales, axis.scale) ? model.scales[axis.scale] : undefined
  if (scale === undefined) {
    throw new InvalidMaturityModelError(`Unknown scale '${axis.scale}'.`)
  }

  return scale
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

/** `Array.isArray` does not narrow the readonly array member of ObservedValue. */
function isMemberSet(value: ObservedValue): value is readonly string[] {
  return Array.isArray(value)
}
