import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { chmod, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import type { AssessmentReport } from '../../assessment/contracts/assessment-report.contract.js'
import { gitEnvironment } from '../../evidence/adapters/live-repository/git-process.js'
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

// SAFETY: Integration against a real temporary Git repository with a GitHub-shaped `origin` and a
// stub `gh` planted ahead of any real one on this process's PATH — deterministic and offline
// whatever `gh` this machine does or does not have installed, on the same footing
// `forge-repository.adapter.test.ts` already stubs it.
describe('runAssess — the contributor roster', () => {
  const run = promisify(execFile)
  const A_LONG_TIME = 60_000
  const workspaces: string[] = []
  let restorePath: string | undefined

  afterEach(async () => {
    if (restorePath !== undefined) process.env.PATH = restorePath
    restorePath = undefined
    await Promise.all(
      workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })),
    )
  })

  async function emptyDirectory(prefix: string): Promise<string> {
    const path = await mkdtemp(join(await realpath(tmpdir()), prefix))
    workspaces.push(path)
    return path
  }

  async function git(cwd: string, args: readonly string[]): Promise<void> {
    await run('git', args, { cwd, env: gitEnvironment() })
  }

  async function githubOriginRepository(): Promise<string> {
    const repository = await emptyDirectory('aidd-assess-command-forge-')
    await git(repository, ['-c', 'init.defaultBranch=main', 'init', '-q'])
    await git(repository, ['config', 'user.email', 'dev@example.com'])
    await git(repository, ['config', 'user.name', 'A Developer'])
    await git(repository, ['config', 'commit.gpgsign', 'false'])
    await writeFile(join(repository, 'a.md'), 'a\n')
    await git(repository, ['add', '-A'])
    await git(repository, ['commit', '-q', '-m', 'init'])
    await git(repository, [
      'remote',
      'add',
      'origin',
      'https://github.com/an-owner/a-repository.git',
    ])
    return repository
  }

  async function plantGh(script: string): Promise<string> {
    const directory = await emptyDirectory('aidd-assess-command-gh-')
    await writeFile(join(directory, 'gh'), script)
    await chmod(join(directory, 'gh'), 0o755)
    restorePath = process.env.PATH
    process.env.PATH = `${directory}:${process.env.PATH ?? ''}`
    return directory
  }

  async function refusingGh(): Promise<void> {
    await plantGh('#!/bin/sh\necho "gh: no credentials in this run" >&2\nexit 1\n')
  }

  it('gives a bundle subject no roster at all: contributors stays null', async () => {
    const { io, stdout } = capturingIo()

    const exitCode = await runAssess(['assess', PERCEVAL, '--json'], io)

    expect(exitCode).toBe(0)
    expect(JSON.parse(stdout()).contributors).toBeNull()
  })

  it(
    'exits 0 with a published report carrying the section when the roster could not be read',
    async () => {
      const repository = await githubOriginRepository()
      await refusingGh()
      const { io, stdout } = capturingIo()

      const exitCode = await runAssess(['assess', repository, '--json'], io)

      expect(exitCode).toBe(0)
      const report = JSON.parse(stdout()) as AssessmentReport
      expect(report.contributors?.status).toBe('FAILED')

      const { io: proseIo, stdout: proseStdout } = capturingIo()
      await runAssess(['assess', repository], proseIo)
      expect(proseStdout()).toContain('Contributors: could not be read')
    },
    A_LONG_TIME,
  )

  it(
    'honours a `roster: null` override rather than the production wiring it would otherwise build',
    async () => {
      const repository = await githubOriginRepository()
      await refusingGh()
      const { io, stdout } = capturingIo()

      const exitCode = await runAssess(['assess', repository, '--json'], io, { roster: null })

      expect(exitCode).toBe(0)
      // INVARIANT: without the override this same subject and this same refusing `gh` produce a
      // FAILED roster, proven by the test above. `null` here is only reachable if `'roster' in
      // options` won, never `??`, which would have silently fallen back to `rosterFor`.
      expect(JSON.parse(stdout()).contributors).toBeNull()
    },
    A_LONG_TIME,
  )

  it(
    'walks the forge once for its deliveries, shared by the repository line and the rows',
    async () => {
      const repository = await githubOriginRepository()
      const directory = await emptyDirectory('aidd-assess-command-gh-counting-')
      const counts = join(directory, 'counts')
      const prAnswer = join(directory, 'pr.json')
      const commitAnswer = join(directory, 'commits.json')
      await writeFile(
        prAnswer,
        JSON.stringify({
          data: {
            repository: {
              pullRequests: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
            },
          },
        }),
      )
      await writeFile(
        commitAnswer,
        JSON.stringify({
          data: {
            repository: {
              defaultBranchRef: {
                target: {
                  history: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
                },
              },
            },
          },
        }),
      )
      await writeFile(counts, '')
      await plantGh(
        [
          '#!/bin/sh',
          'kind=other',
          'for arg in "$@"; do',
          '  case "$arg" in',
          '    *pullRequests*) kind=pr ;;',
          '    *defaultBranchRef*) kind=commits ;;',
          '  esac',
          'done',
          `echo "$kind" >> "${counts}"`,
          'if [ "$kind" = "pr" ]; then',
          `  cat "${prAnswer}"`,
          'else',
          `  cat "${commitAnswer}"`,
          'fi',
          '',
        ].join('\n'),
      )

      const { io, stdout } = capturingIo()
      const exitCode = await runAssess(['assess', repository, '--json'], io)

      expect(exitCode).toBe(0)
      const report = JSON.parse(stdout()) as AssessmentReport
      expect(report.contributors?.status).toBe('COMPLETED')
      expect(
        report.provenance.find((entry) => entry.collector === 'forge-repository')?.status,
      ).toBe('COMPLETED')

      const invocations = (await readFile(counts, 'utf8'))
        .split('\n')
        .filter((line) => line.length > 0)

      expect(invocations.filter((kind) => kind === 'pr')).toHaveLength(1)
    },
    A_LONG_TIME,
  )
})
