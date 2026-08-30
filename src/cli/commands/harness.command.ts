import { type Stats, statSync } from 'node:fs'
import { ClaudeHarnessAdapter } from '../../harness/adapters/claude-harness.adapter.js'
import { GptTokenizerEncoderAdapter } from '../../harness/adapters/token-encoder.adapter.js'
import type { HarnessSourcePort } from '../../harness/ports/harness-source.port.js'
import type { TokenEncoderPort } from '../../harness/ports/token-encoder.port.js'
import { auditHarness } from '../../harness/usecases/audit-harness.usecase.js'
import { parseHarnessArguments } from '../parsing/harness-arguments.js'
import { renderHarnessHumanReport } from '../renderers/harness-human.renderer.js'
import { renderHarnessJsonReport } from '../renderers/harness-json.renderer.js'
import { UsageError } from '../usage.error.js'
import type { CommandIo } from './assess.command.js'

// INVARIANT: the wired adapters are the default, never the only ones. A suite proving the JSON
// refusal path needs a figure no real file produces, so it passes its own encoder here — matching
// `AssessOptions.collectors` in `assess.command.ts`, and for the same reason: nothing about the
// production wiring moves.
export interface HarnessOptions {
  readonly source?: HarnessSourcePort
  readonly encoder?: TokenEncoderPort
}

export async function runHarness(
  argv: readonly string[],
  io: CommandIo,
  options: HarnessOptions = {},
): Promise<number> {
  // SAFETY: held, not discarded, and aborted in `finally` — an in-flight read is cancelled whichever
  // way the command returns, matching `runAssess`'s own budget.
  const budget = new AbortController()

  try {
    const args = parseHarnessArguments(argv)
    requireExistingSubject(args.subjectPath)

    const source = options.source ?? new ClaudeHarnessAdapter()
    const encoder = options.encoder ?? new GptTokenizerEncoderAdapter()

    const report = await auditHarness({
      subjectPath: args.subjectPath,
      source,
      encoder,
      signal: budget.signal,
    })

    const rendered = args.json ? renderHarnessJsonReport(report) : renderHarnessHumanReport(report)
    io.stdout(`${rendered}\n`)
    return 0
  } catch (error) {
    io.stderr(`${messageOf(error)}\n`)
    return error instanceof UsageError ? 2 : 1
  } finally {
    budget.abort()
  }
}

// Never reads inside the subject: a failure met during reading is the source's own to report.
function requireExistingSubject(subjectPath: string): void {
  let stats: Stats
  try {
    stats = statSync(subjectPath)
  } catch {
    throw new UsageError(`Subject path '${subjectPath}' does not exist.`)
  }

  if (!stats.isDirectory() && !stats.isFile()) {
    throw new UsageError(`Subject path '${subjectPath}' is neither a file nor a directory.`)
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
