import type { MaturityModel } from '../../src/maturity/models/maturity.model.js'

/**
 * The shape aidd.yml carries, never its thresholds. Shared so the decision spec
 * and the validator spec agree on what "valid" means.
 */
export const validModel: MaturityModel = {
  schemaVersion: 1,
  id: 'test',
  scales: {
    size: { kind: 'ordinal', values: ['none', 'S', 'M', 'L'] },
    harness: { kind: 'set', members: ['prompts', 'context-engineering', 'behavior'] },
    parallelism: { kind: 'numeric' },
  },
  axes: [
    { id: 'size', label: 'Taille', scale: 'size' },
    { id: 'harness', label: 'Harness', scale: 'harness' },
    { id: 'parallelism', label: 'En parallèle', scale: 'parallelism' },
  ],
  levels: [
    {
      id: 'low',
      rank: 1,
      label: 'Low',
      requirements: [
        { axis: 'size', min: 'S' },
        { axis: 'harness', includes: ['prompts'] },
        { axis: 'parallelism', min: 1 },
      ],
    },
    {
      id: 'high',
      rank: 2,
      label: 'High',
      requirements: [
        { axis: 'size', min: 'L' },
        { axis: 'harness', includes: ['prompts', 'context-engineering'] },
        { axis: 'parallelism', min: 3 },
      ],
    },
  ],
}

/** The same model with `high`'s requirements rewritten. */
export const withHighRequiring = (
  requirements: MaturityModel['levels'][number]['requirements'],
): MaturityModel => ({
  ...validModel,
  levels: validModel.levels.map((level) =>
    level.id === 'high' ? { ...level, requirements } : level,
  ),
})
