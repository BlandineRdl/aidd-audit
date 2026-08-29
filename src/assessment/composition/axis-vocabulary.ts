import type { AxisVocabulary } from '../../evidence/models/axis.model.js'
import type { Axis, MaturityModel, Scale } from '../../maturity/models/maturity.model.js'

export function axisVocabularyOf(model: MaturityModel): readonly AxisVocabulary[] {
  return model.axes.map((axis) => vocabularyFor(axis, scaleOf(model, axis)))
}

function scaleOf(model: MaturityModel, axis: Axis): Scale {
  // Object.hasOwn: see model-consistency.ts's requireVocabulary.
  const scale = Object.hasOwn(model.scales, axis.scale) ? model.scales[axis.scale] : undefined
  // Unreachable for a model loadMaturityModel accepted.
  if (scale === undefined) {
    throw new Error(`Axis '${axis.id}' names a scale the model does not declare: '${axis.scale}'.`)
  }
  return scale
}

function vocabularyFor(axis: Axis, scale: Scale): AxisVocabulary {
  switch (scale.kind) {
    case 'ordinal':
      return { axis: axis.id, kind: 'ordinal', values: scale.values }
    case 'set':
      return { axis: axis.id, kind: 'set', members: scale.members }
    case 'numeric':
      return { axis: axis.id, kind: 'numeric' }
  }
}
