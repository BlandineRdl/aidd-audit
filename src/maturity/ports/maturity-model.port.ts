import type { MaturityModel } from '../models/maturity.model.js'

/**
 * Where the maturity model comes from.
 *
 * One adapter binds to it, `yaml-maturity-model.adapter`, reading the canonical
 * aidd.yml or the file given to --model. The YAML parser is that adapter's
 * dependency and never reaches a model or a use case.
 */
export interface MaturityModelPort {
  /** @param source a path overriding the built-in model, or undefined for it. */
  load(source?: string): Promise<MaturityModel>
}

export class MaturityModelLoadError extends Error {}
