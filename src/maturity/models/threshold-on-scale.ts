import { InvalidMaturityModelError } from './invalid-maturity-model.error.js'
import { isSetRequirement, type LevelRequirement, type Scale } from './maturity.model.js'

/**
 * Shared by the loader and the engine deliberately: two copies of this rule
 * drifted apart once, and the engine went on scoring models the loader would
 * have refused.
 */
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
    /**
     * A non-finite threshold is never met: `value >= NaN` is false for every
     * observation. That reports NOT_MET — a *practice* gap — so a defect in
     * the model would make AIDD blame the assessed repository.
     */
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
