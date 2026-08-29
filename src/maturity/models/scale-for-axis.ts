import { InvalidMaturityModelError } from './invalid-maturity-model.error.js'
import type { Axis, AxisId, MaturityModel, Scale } from './maturity.model.js'

// SAFETY: `Object.hasOwn`, not a bare index — `model.scales` carries user-supplied keys, and a plain
// lookup would resolve an inherited `Object.prototype` member (`toString`, `constructor`, …) as if
// it were a declared scale. One rule, four callers: the loader's vocabulary and cumulativity checks,
// the engine's comparison, and `assessment`'s projection into the collector vocabulary.
export function scaleNamedBy(model: MaturityModel, axis: Axis): Scale {
  const scale = Object.hasOwn(model.scales, axis.scale) ? model.scales[axis.scale] : undefined
  if (scale === undefined) {
    throw new InvalidMaturityModelError(
      `Axis '${axis.id}' names a scale the model does not declare: '${axis.scale}'.`,
    )
  }
  return scale
}

export function scaleForAxis(model: MaturityModel, axisId: AxisId): Scale {
  const axis = model.axes.find((candidate) => candidate.id === axisId)
  if (axis === undefined) {
    throw new InvalidMaturityModelError(`Unknown axis '${axisId}'.`)
  }
  return scaleNamedBy(model, axis)
}
