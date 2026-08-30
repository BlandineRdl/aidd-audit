import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AssessmentReport } from '../../assessment/contracts/assessment-report.contract.js'
import { gitEnvironment } from '../../evidence/adapters/live-repository/git-process.js'
import type { Observation } from '../../evidence/models/observation.model.js'
import type {
  CollectorCollection,
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
      colours: false,
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
    expect(stdout()).toContain("Aucun niveau n'a pu être entièrement prouvé")
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

describe('runAssess — a set of exactly one bundle still publishes the set shape', () => {
  let tempDir: string | undefined

  afterEach(() => {
    if (tempDir !== undefined) {
      rmSync(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
  })

  function directoryHoldingOneBundle(): string {
    tempDir = mkdtempSync(join(tmpdir(), 'aidd-audit-one-bundle-'))
    const bundle = join(tempDir, 'only')
    mkdirSync(bundle)
    writeFileSync(join(bundle, 'profile.json'), '{}')
    return tempDir
  }

  it('renders an array under --json, not the bare object a lone subject publishes', async () => {
    const { io, stdout } = capturingIo()

    const exitCode = await runAssess(['assess', directoryHoldingOneBundle(), '--json'], io)

    expect(exitCode).toBe(0)
    const parsed = JSON.parse(stdout())
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(1)
  })

  it('publishes a document for the bundle itself, not for the directory holding it', async () => {
    const { io, stdout } = capturingIo()
    const directory = directoryHoldingOneBundle()

    const exitCode = await runAssess(['assess', directory, '--json'], io)

    expect(exitCode).toBe(0)
    const documents = JSON.parse(stdout()) as readonly AssessmentReport[]
    expect(documents).toHaveLength(1)
    expect(documents[0]?.subject.path).toBe(join(directory, 'only'))
  })
})

describe('runAssess — a set member that is its own work-tree root', () => {
  let tempDir: string | undefined
  let originalPath: string | undefined

  afterEach(() => {
    if (originalPath !== undefined) {
      process.env.PATH = originalPath
      originalPath = undefined
    }
    if (tempDir !== undefined) {
      rmSync(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
  })

  // SAFETY: a `gh` that refuses is put ahead of any real one, so the forge is asked and answers
  // FAILED instead of reaching the network from inside the gate. What is under test is which
  // collectors the composition root builds, and a refusal names itself in `provenance` just as an
  // answer would.
  function refusingGhOnPath(directory: string): void {
    const bin = join(directory, 'bin')
    mkdirSync(bin)
    const script = join(bin, 'gh')
    writeFileSync(script, '#!/bin/sh\necho "gh: no credentials in this run" >&2\nexit 1\n')
    chmodSync(script, 0o755)
    originalPath = process.env.PATH
    process.env.PATH = `${bin}:${process.env.PATH ?? ''}`
  }

  // INVARIANT: a bundle is free to be a git repository nested inside a plain directory, so a set's
  // members are not all non-roots just because the directory holding them is one.
  function setHoldingARepositoryBundle(): { directory: string; member: string } {
    tempDir = mkdtempSync(join(tmpdir(), 'aidd-audit-set-member-root-'))
    refusingGhOnPath(tempDir)

    const member = join(tempDir, 'member')
    mkdirSync(member)
    writeFileSync(join(member, 'profile.json'), '{}')
    // SAFETY: `gitEnvironment()` drops the `GIT_*` variables a running git hook exports. Without it
    // these commands are aimed at the enclosing repository rather than the bundle, and the suite
    // passes standalone while failing under `pre-commit` — which is where it first did.
    const git = (...args: readonly string[]): void => {
      execFileSync('git', [...args], { cwd: member, stdio: 'ignore', env: gitEnvironment() })
    }
    git('-c', 'init.defaultBranch=main', 'init', '-q')
    git('remote', 'add', 'origin', 'https://github.com/an-owner/a-repository.git')

    return { directory: tempDir, member }
  }

  async function documentsFor(...argv: readonly string[]): Promise<readonly AssessmentReport[]> {
    const { io, stdout } = capturingIo()
    const exitCode = await runAssess(['assess', ...argv, '--json'], io)

    expect(exitCode).toBe(0)
    const published: unknown = JSON.parse(stdout())
    return (Array.isArray(published) ? published : [published]) as AssessmentReport[]
  }

  it('publishes inside a set the document it publishes when named alone', async () => {
    const { directory, member } = setHoldingARepositoryBundle()

    const [alone] = await documentsFor(member)
    const [inTheSet] = await documentsFor(directory)

    // INVARIANT: the forge is what a member loses when the work-tree-root answer is inherited from
    // the directory holding it rather than asked of the member, so its presence is what makes the
    // equality below prove anything.
    expect(alone?.provenance.map((entry) => entry.collector)).toContain('forge-repository')
    expect(inTheSet).toEqual(alone)
  })
})

describe('runAssess — a set publishes every report or none', () => {
  let tempDir: string | undefined

  afterEach(() => {
    if (tempDir !== undefined) {
      rmSync(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
  })

  function twoBundles(): string {
    tempDir = mkdtempSync(join(tmpdir(), 'aidd-audit-partial-set-'))
    for (const name of ['first', 'second']) {
      const bundle = join(tempDir, name)
      mkdirSync(bundle)
      writeFileSync(join(bundle, 'profile.json'), '{}')
    }
    return tempDir
  }

  it('writes nothing when the second report is the one that cannot be published', async () => {
    const { io, stdout, stderr } = capturingIo()

    const exitCode = await runAssess(['assess', twoBundles(), '--json'], io, {
      collectors: [new PoisonedForOneSubject('second', Number.POSITIVE_INFINITY)],
    })

    // INVARIANT: the first report rendered cleanly. Publishing it and then failing would leave a
    // caller holding half a set that reads like a whole one.
    expect(exitCode).toBe(1)
    expect(stdout()).toBe('')
    expect(stderr()).toContain('Infinity')
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
        '    descriptions: { S: small, M: medium, L: large }',
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

  async collect(context: CollectorContext): Promise<{
    readonly observations: readonly Observation[]
    readonly diagnostics: readonly []
  }> {
    context.signal.throwIfAborted()
    return {
      observations: [
        {
          axis: 'parallelism',
          reading: 'SUSTAINED' as const,
          value: this.value,
          kind: 'OBSERVED' as const,
          collector: this.id,
          basis: 'a value this suite chose',
          demonstration: null,
        },
      ],
      diagnostics: [],
    }
  }
}

// INVARIANT: answers `parallelism` for one named subject only, so a set's earlier reports render
// cleanly and the refusal lands on a later one. Like its sibling above it fakes no domain
// collaborator: everything downstream of it is the real pipeline.
class PoisonedForOneSubject implements EvidenceCollector {
  readonly id = 'poisoned-for-one-subject'
  readonly supportedAxes: readonly string[] = ['parallelism']

  constructor(
    private readonly subjectName: string,
    private readonly value: number,
  ) {}

  async collect(context: CollectorContext): Promise<CollectorCollection> {
    context.signal.throwIfAborted()
    if (!context.path.endsWith(this.subjectName)) return { observations: [], diagnostics: [] }
    return { observations: [
      {
        axis: 'parallelism',
        reading: 'SUSTAINED',
        value: this.value,
        kind: 'OBSERVED',
        collector: this.id,
        basis: 'a value this suite chose',
        demonstration: null,
      },
    ], diagnostics: [] }
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
