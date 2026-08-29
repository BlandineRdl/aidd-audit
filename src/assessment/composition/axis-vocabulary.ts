import type { AxisVocabulary } from '../../evidence/models/axis.model.js'
import type { Axis, MaturityModel, Scale } from '../../maturity/models/maturity.model.js'
import { scaleNamedBy } from '../../maturity/models/scale-for-axis.js'

export function axisVocabularyOf(model: MaturityModel): readonly AxisVocabulary[] {
  return model.axes.map((axis) => vocabularyFor(axis, scaleNamedBy(model, axis)))
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
