import { InvalidMaturityModelError } from './invalid-maturity-model.error.js'
import { isSetRequirement, type LevelRequirement, type Scale } from './maturity.model.js'

// One rule, two callers: the loader gates YAML, the engine backstops a hand-built model.
export function requireThresholdOnScale(
  scale: Scale,
  requirement: LevelRequirement,
  context = '',
): void {
  const prefix = context.length > 0 ? `${context}: ` : ''

  if (isSetRequirement(requirement)) {
    if (scale.kind !== 'set') {
      throw new InvalidMaturityModelError(
        sentence(prefix, `axis '${requirement.axis}' is not a set scale but declares 'includes'.`),
      )
    }
    for (const member of requirement.includes) {
      if (!scale.members.includes(member)) {
        throw new InvalidMaturityModelError(
          sentence(prefix, `member '${member}' is not on the '${requirement.axis}' scale.`),
        )
      }
    }
    return
  }

  if (scale.kind === 'set') {
    throw new InvalidMaturityModelError(
      sentence(prefix, `axis '${requirement.axis}' is a set scale and needs 'includes'.`),
    )
  }
  if (scale.kind === 'numeric') {
    if (typeof requirement.min !== 'number') {
      throw new InvalidMaturityModelError(
        sentence(prefix, `axis '${requirement.axis}' is numeric but its minimum is not a number.`),
      )
    }
    // SAFETY: a non-finite threshold is never met — `value >= NaN` is false for every observation —
    // which reports NOT_MET, a practice gap. Left unguarded, a defect in the model would make AIDD
    // blame the assessed repository.
    if (!Number.isFinite(requirement.min)) {
      throw new InvalidMaturityModelError(
        sentence(
          prefix,
          `axis '${requirement.axis}'.min must be a finite number, got ${String(requirement.min)}.`,
        ),
      )
    }
  }
  if (scale.kind === 'ordinal' && !scale.values.includes(String(requirement.min))) {
    throw new InvalidMaturityModelError(
      sentence(
        prefix,
        `threshold '${String(requirement.min)}' is not on the '${requirement.axis}' scale.`,
      ),
    )
  }
}

function sentence(prefix: string, body: string): string {
  if (prefix.length > 0) return `${prefix}${body}`
  return `${body.charAt(0).toUpperCase()}${body.slice(1)}`
}
