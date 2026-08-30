import type { AxisId } from '../models/axis.model.js'
import {
  EVIDENCE_READINGS,
  type Evidence,
  type EvidenceReading,
  type Observation,
  type ObservedValue,
} from '../models/observation.model.js'

// INVARIANT: maps over requested axes crossed with every reading, not over observed ones, so an
// axis and reading with no observation stays visible as UNKNOWN.
//
// INVARIANT: values are compared only inside one reading. `CONFLICTING` must keep meaning "two
// collectors saw the same thing differently"; a habitual value and a demonstrated one differ by
// design, and comparing them would call every two-reading axis a conflict.
export function resolveEvidence(
  observations: readonly Observation[],
  axes: readonly AxisId[],
): readonly Evidence[] {
  return axes.flatMap((axis) =>
    EVIDENCE_READINGS.map((reading) =>
      resolveAxis(
        axis,
        reading,
        observations.filter(
          (observation) => observation.axis === axis && observation.reading === reading,
        ),
      ),
    ),
  )
}

function resolveAxis(
  axis: AxisId,
  reading: EvidenceReading,
  observations: readonly Observation[],
): Evidence {
  if (observations.length === 0) {
    return { axis, reading, status: 'UNKNOWN', value: null, demonstration: null, observations }
  }

  const observed = observations.filter((observation) => observation.kind === 'OBSERVED')
  const [firstObserved, ...restObserved] = observed

  if (firstObserved === undefined) {
    return { axis, reading, status: 'CLAIMED', value: null, demonstration: null, observations }
  }

  const confirmedValue = agreedValue(firstObserved, restObserved)

  if (confirmedValue !== undefined) {
    return {
      axis,
      reading,
      status: 'CONFIRMED',
      value: confirmedValue,
      // LIMITATION: the share of the observation that carried the agreed value. Two collectors
      // agreeing on a value may have counted different numbers of occasions, and nothing here
      // reconciles them; the first is taken. A second forge would make that a real choice.
      demonstration: firstObserved.demonstration,
      observations,
    }
  }

  return { axis, reading, status: 'CONFLICTING', value: null, demonstration: null, observations }
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
