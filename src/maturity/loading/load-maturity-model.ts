import { readFileSync } from 'node:fs'
import YAML from 'yaml'
import { InvalidMaturityModelError } from '../models/invalid-maturity-model.error.js'
import type { MaturityModel } from '../models/maturity.model.js'
import { requireShape } from './model-shape.js'
import { requireCoverage, requireCumulativity, requireVocabulary } from './model-consistency.js'

export function loadMaturityModel(path: string): MaturityModel {
  return parseMaturityModel(readModelFile(path))
}

function readModelFile(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new InvalidMaturityModelError(
      `The maturity model at '${path}' could not be read: ${reason}`,
    )
  }
}

export function parseMaturityModel(source: string): MaturityModel {
  const document = parseYamlDocument(source)
  const model = requireShape(document)
  requireVocabulary(model)
  requireCoverage(model)
  requireCumulativity(model)
  return model
}

function parseYamlDocument(source: string): unknown {
  try {
    return YAML.parse(source)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new InvalidMaturityModelError(`The maturity model is not valid YAML: ${reason}`)
  }
}
