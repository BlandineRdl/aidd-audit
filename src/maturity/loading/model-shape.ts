import { InvalidMaturityModelError } from '../models/invalid-maturity-model.error.js'
import type {
  Axis,
  Level,
  LevelRequirement,
  MaturityModel,
  Scale,
  ScaleId,
} from '../models/maturity.model.js'

/** Field types only. Whether the model holds together is `model-consistency`. */
export function requireShape(document: unknown): MaturityModel {
  if (!isRecord(document)) {
    throw new InvalidMaturityModelError(
      `The maturity model must be a YAML mapping, not ${describeType(document)}.`,
    )
  }

  return {
    schemaVersion: requireSchemaVersion(document.schemaVersion),
    id: requireNonEmptyString(document.id, 'id'),
    scales: requireScales(document.scales),
    axes: requireAxes(document.axes),
    levels: requireLevels(document.levels),
  }
}

// A document declaring another version may carry fields this parser would
// silently drop, and `--model` takes an arbitrary file.
function requireSchemaVersion(value: unknown): number {
  if (typeof value !== 'number' || value !== 1) {
    const got = typeof value === 'number' ? String(value) : describeType(value)
    throw new InvalidMaturityModelError(`'schemaVersion' must be the number 1, got ${got}.`)
  }
  return value
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidMaturityModelError(
      `'${field}' must be a non-empty string, got ${describeType(value)}.`,
    )
  }
  return value
}

/**
 * `NaN` is a number and orders against nothing: `requireDistinctRanks` sees a
 * single Set member, `sort` by difference leaves the order unspecified, and
 * `levelAbove`'s `rank >` comparison is then always false — so `next` would go
 * silently null. A rank that cannot be ordered is a model defect, not a rank.
 */
function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new InvalidMaturityModelError(
      `'${field}' must be a finite number, got ${describeType(value)}.`,
    )
  }
  return value
}

function requireStringArray(value: unknown, field: string): readonly string[] {
  const isString = (item: unknown): item is string => typeof item === 'string'
  if (!Array.isArray(value) || !value.every(isString)) {
    throw new InvalidMaturityModelError(
      `'${field}' must be an array of strings, got ${describeType(value)}.`,
    )
  }
  return value
}

function requireScales(value: unknown): Readonly<Record<ScaleId, Scale>> {
  if (!isRecord(value)) {
    throw new InvalidMaturityModelError(`'scales' must be a mapping, got ${describeType(value)}.`)
  }
  const entries = Object.entries(value)
  if (entries.length === 0) {
    throw new InvalidMaturityModelError(`'scales' must declare at least one scale.`)
  }

  // Object.create(null): a plain object literal inherits Object.prototype, so
  // an axis naming `scale: toString` or `scale: constructor` would later read
  // as "declared" off the prototype chain instead of failing the lookup below.
  const scales: Record<ScaleId, Scale> = Object.create(null)
  for (const [scaleId, raw] of entries) {
    scales[scaleId] = requireScale(raw, scaleId)
  }
  return scales
}

function requireScale(value: unknown, scaleId: string): Scale {
  if (!isRecord(value)) {
    throw new InvalidMaturityModelError(
      `Scale '${scaleId}' must be a mapping, got ${describeType(value)}.`,
    )
  }

  if (value.kind === 'ordinal') {
    return {
      kind: 'ordinal',
      values: requireStringArray(value.values, `scale '${scaleId}'.values`),
    }
  }
  if (value.kind === 'set') {
    return {
      kind: 'set',
      members: requireStringArray(value.members, `scale '${scaleId}'.members`),
    }
  }
  if (value.kind === 'numeric') {
    return { kind: 'numeric' }
  }
  throw new InvalidMaturityModelError(
    `Scale '${scaleId}' has an unknown kind ${describeType(value.kind)}; ` +
      `expected 'ordinal', 'set' or 'numeric'.`,
  )
}

function requireAxes(value: unknown): readonly Axis[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidMaturityModelError(
      `'axes' must be a non-empty array, got ${describeType(value)}.`,
    )
  }

  const axes = value.map((item, index) => requireAxis(item, index))
  requireDistinctIds(
    axes.map((axis) => axis.id),
    'axes',
  )
  return axes
}

function requireAxis(value: unknown, index: number): Axis {
  if (!isRecord(value)) {
    throw new InvalidMaturityModelError(
      `axes[${index}] must be a mapping, got ${describeType(value)}.`,
    )
  }
  return {
    id: requireNonEmptyString(value.id, `axes[${index}].id`),
    label: requireNonEmptyString(value.label, `axes[${index}].label`),
    scale: requireNonEmptyString(value.scale, `axes[${index}].scale`),
  }
}

function requireLevels(value: unknown): readonly Level[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidMaturityModelError(
      `'levels' must be a non-empty array, got ${describeType(value)}.`,
    )
  }

  const levels = value.map((item, index) => requireLevel(item, index))
  requireDistinctIds(
    levels.map((level) => level.id),
    'levels',
  )
  return levels
}

function requireLevel(value: unknown, index: number): Level {
  if (!isRecord(value)) {
    throw new InvalidMaturityModelError(
      `levels[${index}] must be a mapping, got ${describeType(value)}.`,
    )
  }
  const id = requireNonEmptyString(value.id, `levels[${index}].id`)
  return {
    id,
    rank: requireNumber(value.rank, `level '${id}'.rank`),
    label: requireNonEmptyString(value.label, `level '${id}'.label`),
    requirements: requireRequirements(value.requirements, id),
  }
}

function requireRequirements(value: unknown, levelId: string): readonly LevelRequirement[] {
  if (!Array.isArray(value)) {
    throw new InvalidMaturityModelError(
      `Level '${levelId}'.requirements must be an array, got ${describeType(value)}.`,
    )
  }
  return value.map((item, index) => requireRequirement(item, levelId, index))
}

function requireRequirement(value: unknown, levelId: string, index: number): LevelRequirement {
  if (!isRecord(value)) {
    throw new InvalidMaturityModelError(
      `Level '${levelId}'.requirements[${index}] must be a mapping, got ${describeType(value)}.`,
    )
  }
  const axis = requireNonEmptyString(value.axis, `level '${levelId}'.requirements[${index}].axis`)
  const hasMin = value.min !== undefined
  const hasIncludes = value.includes !== undefined

  if (hasMin === hasIncludes) {
    throw new InvalidMaturityModelError(
      `Level '${levelId}' requirement for axis '${axis}' must carry exactly one of 'min' or 'includes'.`,
    )
  }

  if (hasIncludes) {
    return {
      axis,
      includes: requireStringArray(
        value.includes,
        `level '${levelId}' requirement for axis '${axis}'.includes`,
      ),
    }
  }

  const min = value.min
  if (typeof min !== 'string' && typeof min !== 'number') {
    throw new InvalidMaturityModelError(
      `Level '${levelId}' requirement for axis '${axis}'.min must be a string or a number, ` +
        `got ${describeType(min)}.`,
    )
  }
  // Finiteness is requireThresholdOnScale's, not this stage's.
  return { axis, min }
}

function requireDistinctIds(ids: readonly string[], field: string): void {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) {
      throw new InvalidMaturityModelError(`'${field}' declares '${id}' more than once.`)
    }
    seen.add(id)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describeType(value: unknown): string {
  if (value === undefined) return 'nothing'
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value)
  return `a ${typeof value}`
}
