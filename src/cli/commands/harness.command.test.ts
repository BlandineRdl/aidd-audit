import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ClaudeHarnessAdapter } from '../../harness/adapters/claude-harness.adapter.js'
import { InfiniteTokenEncoderTestAdapter } from '../../harness/adapters/infinite-token-encoder.test-adapter.js'
import type { HarnessAuditReport } from '../../harness/contracts/harness-audit-report.contract.js'
import type { CommandIo } from './assess.command.js'
import { runHarness } from './harness.command.js'

let directories: string[] = []

afterEach(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true })
  directories = []
})

function directoryHolding(files: Readonly<Record<string, string>>): string {
  const path = mkdtempSync(join(tmpdir(), 'aidd-harness-command-'))
  directories.push(path)

  for (const [name, content] of Object.entries(files)) {
    const absolute = join(path, name)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, content)
  }

  return path
}

function emptyMachineDirectory(): string {
  return directoryHolding({})
}

function capturingIo(): { io: CommandIo; stdout: () => string; stderr: () => string } {
  const out: string[] = []
  const err: string[] = []
  return {
    io: {
      stdout: (text) => out.push(text),
      stderr: (text) => err.push(text),
      colours: false,
    },
    stdout: () => out.join(''),
    stderr: () => err.join(''),
  }
}

describe('runHarness — happy path', () => {
  it('audits a subject, writing a report to stdout and nothing to stderr', async () => {
    const subject = directoryHolding({ 'CLAUDE.md': 'the project context file\n' })
    const source = new ClaudeHarnessAdapter(emptyMachineDirectory())
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runHarness(['harness', subject], io, { source })

    expect(exitCode).toBe(0)
    expect(stderr()).toBe('')
    expect(stdout()).toContain('CLAUDE.md')
    expect(stdout().endsWith('\n')).toBe(true)
  })

  it('renders the frozen contract under --json, with the same figures as prose', async () => {
    const subject = directoryHolding({ 'CLAUDE.md': 'the project context file\n' })
    const source = new ClaudeHarnessAdapter(emptyMachineDirectory())
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runHarness(['harness', subject, '--json'], io, { source })

    expect(exitCode).toBe(0)
    expect(stderr()).toBe('')
    const report = JSON.parse(stdout()) as HarnessAuditReport
    expect(report.schemaVersion).toBe(1)
    expect(report.tool).toBe('claude')
    expect(report.files.some((file) => file.path === 'CLAUDE.md')).toBe(true)
  })

  it('says nothing was found to measure for a subject with no harness at all', async () => {
    const subject = directoryHolding({})
    const source = new ClaudeHarnessAdapter(emptyMachineDirectory())
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runHarness(['harness', subject], io, { source })

    expect(exitCode).toBe(0)
    expect(stderr()).toBe('')
    expect(stdout()).toContain('Nothing was found to measure')
  })
})

describe('runHarness — usage errors exit 2, nothing on stdout', () => {
  it('rejects no command word', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runHarness([], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    expect(stderr()).toContain('No command given.')
    expect(stderr()).toContain('assess')
    expect(stderr()).toContain('harness')
    expect(stderr().endsWith('\n')).toBe(true)
  })

  it('rejects an unknown command word, naming it and both known commands', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runHarness(['scan', 'profiles/perceval'], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    expect(stderr()).toContain("Unknown command 'scan'.")
    expect(stderr()).toContain('assess')
    expect(stderr()).toContain('harness')
    expect(stderr().endsWith('\n')).toBe(true)
  })

  it('rejects a missing subject path', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runHarness(['harness'], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    expect(stderr()).toContain('No subject path given.')
    expect(stderr()).toContain('usage: aidd-audit harness <path> [--json]')
  })

  it('rejects a subject path that names no directory or file', async () => {
    const { io, stdout, stderr } = capturingIo()
    const missing = './this-path-does-not-exist'

    const exitCode = await runHarness(['harness', missing], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    expect(stderr()).toContain(`Subject path '${missing}' does not exist.`)
  })

  it('rejects an unknown flag, naming it', async () => {
    const subject = directoryHolding({ 'CLAUDE.md': 'x\n' })
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runHarness(['harness', subject, '--verbose'], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    expect(stderr()).toContain("Unknown flag '--verbose'.")
  })
})

describe('runHarness — the JSON boundary refuses a non-finite figure, exit code 1', () => {
  it('refuses to publish rather than emitting a fabricated absence', async () => {
    const subject = directoryHolding({ 'CLAUDE.md': 'the project context file\n' })
    const source = new ClaudeHarnessAdapter(emptyMachineDirectory())
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runHarness(['harness', subject, '--json'], io, {
      source,
      encoder: new InfiniteTokenEncoderTestAdapter(),
    })

    expect(exitCode).toBe(1)
    expect(stdout()).toBe('')
    expect(stderr()).toContain('tokenEstimate')
  })
})
