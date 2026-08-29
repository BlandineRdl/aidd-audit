import { UsageError } from '../usage.error.js'

const USAGE_LINE = 'usage: aidd-audit assess <path> [--json] [--model <path>]'

export interface AssessArguments {
  readonly subjectPath: string
  readonly modelPath: string | null
  readonly json: boolean
}

// COMPAT: hand-rolled rather than `node:util`'s `parseArgs`, which doesn't let a caller shape its
// rejection messages.
export function parseAssessArguments(argv: readonly string[]): AssessArguments {
  const command = argv[0]
  if (command !== 'assess') {
    const what = command === undefined ? 'No command given.' : `Unknown command '${command}'.`
    throw usageError(what)
  }

  let subjectPath: string | undefined
  let modelPath: string | null = null
  let jsonSeen = false
  let modelSeen = false

  // INVARIANT: `entries()` yields the token itself, so no branch is needed for an index that cannot
  // be empty. A flag's value is the one position genuinely absent — when the flag ends the line.
  const operands = argv.slice(1)
  let valueConsumedAt = -1

  for (const [index, token] of operands.entries()) {
    if (index === valueConsumedAt) {
      continue
    }

    if (token === '--json') {
      if (jsonSeen) throw usageError("Flag '--json' was given more than once.")
      jsonSeen = true
      continue
    }

    if (token === '--model') {
      if (modelSeen) throw usageError("Flag '--model' was given more than once.")
      const value = operands[index + 1]
      if (value === undefined) throw usageError("Flag '--model' needs a value.")
      modelSeen = true
      modelPath = value
      valueConsumedAt = index + 1
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

  return { subjectPath, modelPath, json: jsonSeen }
}

function usageError(reason: string): UsageError {
  return new UsageError(`${reason} ${USAGE_LINE}`)
}
