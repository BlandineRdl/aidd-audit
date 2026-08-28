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
import { InvalidMaturityModelError } from './invalid-maturity-model.error.js'
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

  const scale = model.scales[axis.scale]
  if (scale === undefined) {
    throw new InvalidMaturityModelError(`Unknown scale '${axis.scale}'.`)
  }

  return scale
}

/**
 * A model defect must be rejected, never scored. An off-scale ordinal threshold
 * ranks at -1, which every observation clears; an off-scale set member or a
 * non-numeric minimum can never be met, which would report a practice gap.
 *
 * Temporary here: the `load AIDD model` feature moves this whole function to the
 * loader, where the untyped YAML actually enters.
 */
function requireThresholdOnScale(scale: Scale, requirement: LevelRequirement): void {
  if (isSetRequirement(requirement)) {
    if (scale.kind !== 'set') {
      throw new InvalidMaturityModelError(
        `Axis '${requirement.axis}' is not a set scale but declares 'includes'.`,
      )
    }
    for (const member of requirement.includes) {
      if (!scale.members.includes(member)) {
        throw new InvalidMaturityModelError(
          `Member '${member}' is not on the '${requirement.axis}' scale.`,
        )
      }
    }
    return
  }

  if (scale.kind === 'set') {
    throw new InvalidMaturityModelError(
      `Axis '${requirement.axis}' is a set scale and needs 'includes'.`,
    )
  }
  if (scale.kind === 'numeric' && typeof requirement.min !== 'number') {
    throw new InvalidMaturityModelError(
      `Axis '${requirement.axis}' is numeric but its minimum is not a number.`,
    )
  }
  if (scale.kind === 'ordinal' && !scale.values.includes(String(requirement.min))) {
    throw new InvalidMaturityModelError(
      `Threshold '${String(requirement.min)}' is not on the '${requirement.axis}' scale.`,
    )
  }
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
