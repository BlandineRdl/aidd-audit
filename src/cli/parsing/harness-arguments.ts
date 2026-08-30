import { commandOperandsFor } from './command-name.js'
import { UsageError } from '../usage.error.js'

const USAGE_LINE = 'usage: aidd-audit harness <path> [--json] [--details]'

export interface HarnessArguments {
  readonly subjectPath: string
  readonly json: boolean
  readonly details: boolean
}

// COMPAT: hand-rolled rather than `node:util`'s `parseArgs`, matching `assess-arguments.ts`.
export function parseHarnessArguments(argv: readonly string[]): HarnessArguments {
  const operands = commandOperandsFor(argv, 'harness')

  let subjectPath: string | undefined
  let jsonSeen = false
  let detailsSeen = false

  for (const token of operands) {
    if (token === '--json') {
      if (jsonSeen) throw usageError("Flag '--json' was given more than once.")
      jsonSeen = true
      continue
    }

    if (token === '--details') {
      if (detailsSeen) throw usageError("Flag '--details' was given more than once.")
      detailsSeen = true
      continue
    }

    if (token.startsWith('--')) {
      throw usageError(`Unknown flag '${token}'.`)
    }

    if (subjectPath !== undefined) {
      throw usageError(`Unexpected second subject '${token}'.`)
    }
    subjectPath = token
  }

  if (subjectPath === undefined) {
    throw usageError('No subject path given.')
  }

  return { subjectPath, json: jsonSeen, details: detailsSeen }
}

function usageError(reason: string): UsageError {
  return new UsageError(`${reason} ${USAGE_LINE}`)
}
