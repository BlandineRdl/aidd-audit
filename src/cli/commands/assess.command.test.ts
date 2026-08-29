import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AssessmentReport } from '../../assessment/contracts/assessment-report.contract.js'
import type { Observation } from '../../evidence/models/observation.model.js'
import type {
  CollectorContext,
  EvidenceCollector,
} from '../../evidence/ports/evidence-collector.port.js'
import type { CommandIo } from './assess.command.js'
import { runAssess } from './assess.command.js'

// INVARIANT: profiles/perceval is the subject of record for this suite; production code holds no
// profile knowledge of it.
const PERCEVAL = 'profiles/perceval'

// LIMITATION: The repository itself: `intervention` is not recoverable from any local history, so
// one axis is always UNKNOWN and no level can be proven of it.
const THIS_REPOSITORY = '.'

function capturingIo(): { io: CommandIo; stdout: () => string; stderr: () => string } {
  const out: string[] = []
  const err: string[] = []
  return {
    io: {
      stdout: (text) => out.push(text),
      stderr: (text) => err.push(text),
    },
    stdout: () => out.join(''),
    stderr: () => err.join(''),
  }
}

describe('runAssess — happy path', () => {
  it('assesses a profile, writing a report to stdout and nothing to stderr', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runAssess(['assess', PERCEVAL], io)

    expect(exitCode).toBe(0)
    expect(stderr()).toBe('')
    expect(stdout()).toContain(PERCEVAL)
    expect(stdout()).toContain('Red')
  })

  it('says a subject could not be classified rather than naming a level for it', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runAssess(['assess', THIS_REPOSITORY], io)

    expect(exitCode).toBe(0)
    expect(stderr()).toBe('')
    expect(stdout()).toContain('could not be established')
  })

  it('renders the frozen contract under --json', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runAssess(['assess', PERCEVAL, '--json'], io)

    expect(exitCode).toBe(0)
    expect(stderr()).toBe('')
    const report = JSON.parse(stdout()) as AssessmentReport
    expect(report.schemaVersion).toBe(1)
    expect(report.proven?.label).toBe('Red')
    expect(report.coverage.axesRequested).toBe(4)

    // SAFETY: A bundle is tracked inside this repository, so the live collector's gate is what
    // stands between perceval's own evidence and this repository's harness published as his.
    expect(report.provenance).toEqual([
      {
        collector: 'live-repository',
        status: 'COMPLETED',
        axes: ['size', 'harness', 'intervention', 'parallelism'],
      },
      {
        collector: 'fixture-bundle',
        status: 'COMPLETED',
        axes: ['size', 'harness', 'intervention', 'parallelism'],
      },
    ])
    expect(report.coverage.axesObserved).toBe(4)
  })

  it('produces the same report through --model aidd.yml as through the packaged default', async () => {
    const withDefault = capturingIo()
    const withOverride = capturingIo()

    await runAssess(['assess', PERCEVAL, '--json'], withDefault.io)
    await runAssess(['assess', PERCEVAL, '--json', '--model', 'aidd.yml'], withOverride.io)

    expect(withOverride.stdout()).toEqual(withDefault.stdout())
  })
})

describe('runAssess — usage errors exit 2, nothing on stdout', () => {
  it('rejects a missing subject with the usage line', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runAssess(['assess'], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    expect(stderr()).toContain('No subject path given.')
    expect(stderr()).toContain('usage: aidd-audit assess <path> [--json] [--model <path>]')
    expect(stderr().endsWith('\n')).toBe(true)
  })

  it('rejects a subject path that names no directory or file', async () => {
    const { io, stdout, stderr } = capturingIo()
    const missing = './this-path-does-not-exist'

    const exitCode = await runAssess(['assess', missing], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    expect(stderr()).toContain(`Subject path '${missing}' does not exist.`)
    expect(stderr().endsWith('\n')).toBe(true)
  })

  it('rejects a subject path that exists but is neither a file nor a directory', async () => {
    const { io, stdout, stderr } = capturingIo()
    // /dev/null is a character device: neither isDirectory() nor isFile().
    const device = '/dev/null'

    const exitCode = await runAssess(['assess', device], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    expect(stderr()).toContain(`Subject path '${device}' is neither a file nor a directory.`)
    expect(stderr().endsWith('\n')).toBe(true)
  })

  it('rejects no command word', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runAssess([], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    expect(stderr()).toContain('No command given.')
    expect(stderr().endsWith('\n')).toBe(true)
  })

  it('rejects an unknown command word, naming it', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runAssess(['scan', PERCEVAL], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    expect(stderr()).toContain("Unknown command 'scan'.")
    expect(stderr().endsWith('\n')).toBe(true)
  })

  it('rejects an unknown flag, naming it', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runAssess(['assess', PERCEVAL, '--verbose'], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    // SAFETY: "Unknown flag" discriminates — '--verbose' alone also appears in the second-subject
    // rejection, the wrong guard.
    expect(stderr()).toContain("Unknown flag '--verbose'.")
    expect(stderr().endsWith('\n')).toBe(true)
  })

  it('rejects a repeated --json flag', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runAssess(['assess', PERCEVAL, '--json', '--json'], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    expect(stderr()).toContain("Flag '--json' was given more than once.")
    expect(stderr().endsWith('\n')).toBe(true)
  })

  it('rejects a repeated --model flag', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runAssess(
      ['assess', PERCEVAL, '--model', 'aidd.yml', '--model', 'aidd.yml'],
      io,
    )

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    expect(stderr()).toContain("Flag '--model' was given more than once.")
    expect(stderr().endsWith('\n')).toBe(true)
  })

  it('rejects --model given with no value', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runAssess(['assess', PERCEVAL, '--model'], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    expect(stderr()).toContain("Flag '--model' needs a value.")
    expect(stderr().endsWith('\n')).toBe(true)
  })

  it('rejects a second subject path, naming it', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runAssess(['assess', PERCEVAL, 'profiles/bohort'], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    expect(stderr()).toContain("Unexpected second subject 'profiles/bohort'.")
    expect(stderr().endsWith('\n')).toBe(true)
  })
})

describe('runAssess — model errors exit 2, nothing on stdout', () => {
  let tempDir: string | undefined

  afterEach(() => {
    if (tempDir !== undefined) {
      rmSync(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
  })

  it('rejects a --model path that cannot be read, naming it', async () => {
    const { io, stdout, stderr } = capturingIo()
    const missingModel = join(tmpdir(), `aidd-audit-missing-${Date.now()}.yml`)

    const exitCode = await runAssess(['assess', PERCEVAL, '--model', missingModel], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    expect(stderr()).toContain(missingModel)
    expect(stderr()).toContain('could not be read')
    expect(stderr().endsWith('\n')).toBe(true)
  })

  it('rejects a --model that is not cumulative, carrying the loader’s own reason', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'aidd-audit-'))
    const modelPath = join(tempDir, 'not-cumulative.yml')
    // 'high' (rank 2) asks less than 'low' (rank 1): requireCumulativity fires.
    writeFileSync(
      modelPath,
      [
        'schemaVersion: 1',
        'id: broken',
        'scales:',
        '  size:',
        '    kind: ordinal',
        '    values: [S, M, L]',
        'axes:',
        '  - id: size',
        '    label: Size',
        '    scale: size',
        'levels:',
        '  - id: low',
        '    rank: 1',
        '    label: Low',
        '    requirements:',
        '      - axis: size',
        '        min: M',
        '  - id: high',
        '    rank: 2',
        '    label: High',
        '    requirements:',
        '      - axis: size',
        '        min: S',
        '',
      ].join('\n'),
    )

    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runAssess(['assess', PERCEVAL, '--model', modelPath], io)

    expect(exitCode).toBe(2)
    expect(stdout()).toBe('')
    // Exit 2 pins the class: a TypeError would satisfy the fragment alone.
    expect(stderr()).toContain("asks less than 'low'")
    expect(stderr().endsWith('\n')).toBe(true)
  })
})

// INVARIANT: A collector answering `parallelism` with something the loaded model cannot rank. No
// wired collector can do this — each drops a value off the scale — which is why exit code 1 needed
// a collector this composition root would never build. It fakes no domain collaborator: everything
// downstream of it is the real pipeline.
class OffVocabularyEvidenceCollector implements EvidenceCollector {
  readonly id = 'off-vocabulary'
  readonly supportedAxes: readonly string[] = ['parallelism']

  constructor(private readonly value: string | number) {}

  async collect(context: CollectorContext): Promise<readonly Observation[]> {
    context.signal.throwIfAborted()
    return [
      {
        axis: 'parallelism',
        reading: 'SUSTAINED',
        value: this.value,
        kind: 'OBSERVED',
        collector: this.id,
        basis: 'a value this suite chose',
        demonstration: null,
      },
    ]
  }
}

describe('runAssess — our own failures exit 1, nothing on stdout', () => {
  it('exits 1 when a collector answers a numeric axis with something that is not a number', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runAssess(['assess', PERCEVAL], io, {
      collectors: [new OffVocabularyEvidenceCollector('as many as we felt like')],
    })

    // INVARIANT: 1 is ours and 2 is the caller's. Nothing about the invocation was wrong here.
    expect(exitCode).toBe(1)
    expect(stdout()).toBe('')
    expect(stderr()).toContain('parallelism')
  })

  it('refuses to publish a non-finite number under --json rather than rendering it as null', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runAssess(['assess', PERCEVAL, '--json'], io, {
      collectors: [new OffVocabularyEvidenceCollector(Number.POSITIVE_INFINITY)],
    })

    // INVARIANT: JSON renders Infinity as null, and null in this contract means absence. Refusing
    // is the only truthful answer, and refusing is ours, never the caller's.
    expect(exitCode).toBe(1)
    expect(stdout()).toBe('')
    expect(stderr()).toContain('Infinity')
  })

  it('still renders that same report as prose, where a non-finite number misleads nobody', async () => {
    const { io, stdout } = capturingIo()

    const exitCode = await runAssess(['assess', PERCEVAL], io, {
      collectors: [new OffVocabularyEvidenceCollector(Number.POSITIVE_INFINITY)],
    })

    expect(exitCode).toBe(0)
    expect(stdout()).toContain('Infinity')
  })
})
