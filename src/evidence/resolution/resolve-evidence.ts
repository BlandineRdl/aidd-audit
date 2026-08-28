import type { AxisId } from '../models/axis.model.js'
import type { Evidence, Observation, ObservedValue } from '../models/observation.model.js'

/**
 * Resolving requested axes explicitly keeps axes with no observations
 * visible as UNKNOWN.
 */
export function resolveEvidence(
  observations: readonly Observation[],
  axes: readonly AxisId[],
): readonly Evidence[] {
  return axes.map((axis) =>
    resolveAxis(
      axis,
      observations.filter((observation) => observation.axis === axis),
    ),
  )
}

function resolveAxis(axis: AxisId, observations: readonly Observation[]): Evidence {
  if (observations.length === 0) {
    return { axis, status: 'UNKNOWN', value: null, observations }
  }

  const observed = observations.filter((observation) => observation.kind === 'OBSERVED')
  const [firstObserved, ...restObserved] = observed

  if (firstObserved === undefined) {
    return { axis, status: 'CLAIMED', value: null, observations }
  }

  const confirmedValue = agreedValue(firstObserved, restObserved)

  if (confirmedValue !== undefined) {
    return { axis, status: 'CONFIRMED', value: confirmedValue, observations }
  }

  return { axis, status: 'CONFLICTING', value: null, observations }
}

function agreedValue(first: Observation, rest: readonly Observation[]): ObservedValue | undefined {
  return rest.every((observation) => sameValue(observation.value, first.value))
    ? first.value
    : undefined
}

// Array observations represent sets, so order and duplicates do not affect equality.
function sameValue(a: ObservedValue, b: ObservedValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    const setA = new Set(a)
    const setB = new Set(b)
    return setA.size === setB.size && [...setA].every((member) => setB.has(member))
  }
  return a === b
}
