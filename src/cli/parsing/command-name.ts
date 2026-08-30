import { UsageError } from '../usage.error.js'

export const COMMAND_NAMES = ['assess', 'harness'] as const
export type CommandName = (typeof COMMAND_NAMES)[number]

const USAGE_LINE =
  'usage: aidd-audit assess <path> [--json] [--model <path>] | aidd-audit harness <path> [--json]'

// INVARIANT: the one place that decides what counts as no command word and what counts as an
// unknown one, so a second command never needs its own copy of that rejection. Each argument
// parser calls this first, naming the command it expects; a mismatch — including the absent
// command — is the caller's fault, and the usage line always names every command that exists
// rather than only the one the caller meant to type.
export function commandOperandsFor(
  argv: readonly string[],
  expected: CommandName,
): readonly string[] {
  const command = argv[0]
  if (command !== expected) {
    const what = command === undefined ? 'No command given.' : `Unknown command '${command}'.`
    throw new UsageError(`${what} ${USAGE_LINE}`)
  }
  return argv.slice(1)
}
