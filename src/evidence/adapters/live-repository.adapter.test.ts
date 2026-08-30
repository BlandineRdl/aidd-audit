import { execFile } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { gitEnvironment } from './live-repository/git-process.js'
import { afterAll, describe, expect, it } from 'vitest'
import type { AxisVocabulary } from '../models/axis.model.js'
import type { Observation } from '../models/observation.model.js'
import type { CollectorContext } from '../ports/evidence-collector.port.js'
import { LiveRepositoryEvidenceCollector } from './live-repository.adapter.js'

// Integration: Git and the disk are the boundary under test.

const run = promisify(execFile)

const NEVER_ABORTED = new AbortController().signal

const FULL_VOCABULARY: readonly AxisVocabulary[] = [
  { axis: 'size', kind: 'ordinal', values: ['none', 'S', 'M', 'L', 'XL'] },
  {
    axis: 'harness',
    kind: 'set',
    members: ['prompts', 'context-engineering', 'behavior', 'loops'],
  },
  {
    axis: 'intervention',
    kind: 'ordinal',
    values: ['not-applicable', 'after-the-fact-most', 'key-steps'],
  },
  { axis: 'parallelism', kind: 'numeric' },
]

const AGENT_TRAILER = 'Co-Authored-By: Claude <noreply@anthropic.com>'

// The same model, with an intervention scale reaching the value autonomy proves.
const AUTONOMY_VOCABULARY: readonly AxisVocabulary[] = FULL_VOCABULARY.map((scale) =>
  scale.axis === 'intervention'
    ? {
        axis: 'intervention',
        kind: 'ordinal',
        values: ['not-applicable', 'after-the-fact-most', 'key-steps', 'never-once-framed'],
      }
    : scale,
)

// Only the harness axis: the Git-derived source returns before it spawns anything.
const HARNESS_ONLY: readonly AxisVocabulary[] = [
  {
    axis: 'harness',
    kind: 'set',
    members: ['prompts', 'context-engineering', 'behavior', 'loops'],
  },
]

// Only the Git-derived axes: the harness source returns before it spawns anything.
const HISTORY_ONLY: readonly AxisVocabulary[] = [
  { axis: 'size', kind: 'ordinal', values: ['none', 'S', 'M', 'L', 'XL'] },
  { axis: 'parallelism', kind: 'numeric' },
]

const workspaces: string[] = []

afterAll(async () => {
  await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function git(cwd: string, args: readonly string[], date?: string): Promise<void> {
  // SAFETY: never bare `process.env` — a git hook exports GIT_DIR, and an inherited one would send
  // these fixture commits into the repository under test instead of the temporary one.
  const env =
    date === undefined
      ? gitEnvironment()
      : gitEnvironment({ GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date })
  await run('git', [...args], { cwd, env, maxBuffer: 64 * 1024 * 1024 })
}

// COMPAT: `os.tmpdir()` is a symlink on macOS, and git reports the resolved path back.
async function emptyDirectory(): Promise<string> {
  const path = await mkdtemp(join(await realpath(tmpdir()), 'aidd-live-adapter-'))
  workspaces.push(path)
  return path
}

async function write(
  repository: string,
  files: Readonly<Record<string, string>>,
  executable: readonly string[] = [],
): Promise<void> {
  for (const [name, content] of Object.entries(files)) {
    const absolute = join(repository, name)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, content)
    if (executable.includes(name)) await chmod(absolute, 0o755)
  }
}

async function initRepository(): Promise<string> {
  const repository = await emptyDirectory()
  await git(repository, ['-c', 'init.defaultBranch=main', 'init', '-q'])
  await git(repository, ['config', 'user.email', 'dev@example.com'])
  await git(repository, ['config', 'user.name', 'A Developer'])
  await git(repository, ['config', 'commit.gpgsign', 'false'])
  return repository
}

function day(index: number): string {
  return `2026-03-${String(index + 1).padStart(2, '0')}T10:00:00+00:00`
}

// INVARIANT: past the minimum sample on both Git-derived axes, so a null from either is the
// adapter's doing and not the history's. `trailer`, when given, is carried by every commit each
// change absorbs, which is what makes the change one an agent authored alone.
async function buildRepositoryDeliveringSixChanges(
  files: Readonly<Record<string, string>> = {},
  executable: readonly string[] = [],
  trailer: string | null = null,
): Promise<string> {
  const repository = await initRepository()
  await write(repository, { 'README.md': 'a project\n', ...files }, executable)
  await git(repository, ['add', '-A'])
  await git(repository, ['commit', '-q', '-m', 'chore: initial commit'], day(0))

  for (let change = 1; change <= 6; change += 1) {
    await git(repository, ['checkout', '-q', '-b', `feat-${change}`])
    await write(repository, { [`src/feature-${change}.ts`]: `export const feature = ${change}\n` })
    await git(repository, ['add', '-A'])
    const subject = `feat: change ${change}`
    await git(
      repository,
      ['commit', '-q', '-m', trailer === null ? subject : `${subject}\n\n${trailer}`],
      day(change),
    )
    await git(repository, ['checkout', '-q', 'main'])
    await git(
      repository,
      ['merge', '--no-ff', '-q', `feat-${change}`, '-m', `merge: change ${change}`],
      day(change),
    )
  }

  return repository
}

// INVARIANT: Collection is read-only, so assertions differing only in which observation they read
// may share one history. The fixture survives the file and is removed in `afterAll`; callers that
// write a repository keep using `initRepository` and retain their isolation.
const deliveredRepositories = new Map<string, Promise<string>>()

function repositoryDeliveringSixChanges(
  files: Readonly<Record<string, string>> = {},
  executable: readonly string[] = [],
  trailer: string | null = null,
): Promise<string> {
  const key = JSON.stringify([files, executable, trailer])
  let repository = deliveredRepositories.get(key)
  if (repository === undefined) {
    repository = buildRepositoryDeliveringSixChanges(files, executable, trailer)
    deliveredRepositories.set(key, repository)
  }
  return repository
}

const SPAWN_LOG = 'AIDD_TEST_SPAWN_LOG'
const REAL_GIT = 'AIDD_TEST_REAL_GIT'

// INVARIANT: the collector spawns once for the work-tree check and awaits it before either source
// starts, so a second recorded spawn proves a source is in flight — by construction, not by a
// timing ratio.
async function gitHoldingEverySpawnAfterTheFirst(): Promise<{
  readonly waitForASourceToSpawn: () => Promise<void>
  readonly restore: () => void
}> {
  const directory = await emptyDirectory()
  const log = join(directory, 'spawns')
  const realGit = (await run('sh', ['-c', 'command -v git'])).stdout.trim()

  await write(
    directory,
    {
      git: [
        '#!/bin/sh',
        `printf '%s\\n' "$*" >> "$${SPAWN_LOG}"`,
        `if [ "$(wc -l < "$${SPAWN_LOG}")" -gt 1 ]; then`,
        '  while :; do sleep 0.05; done',
        'fi',
        `exec "$${REAL_GIT}" "$@"`,
        '',
      ].join('\n'),
    },
    ['git'],
  )

  const previous = {
    path: process.env.PATH,
    log: process.env[SPAWN_LOG],
    git: process.env[REAL_GIT],
  }
  process.env.PATH = `${directory}:${process.env.PATH ?? ''}`
  process.env[SPAWN_LOG] = log
  process.env[REAL_GIT] = realGit

  async function spawns(): Promise<number> {
    try {
      return (await readFile(log, 'utf8')).split('\n').filter(Boolean).length
    } catch {
      return 0
    }
  }

  return {
    async waitForASourceToSpawn(): Promise<void> {
      const deadline = Date.now() + 10_000
      while ((await spawns()) < 2) {
        if (Date.now() > deadline) {
          throw new Error('no source spawned git within 10s of the work-tree check')
        }
        await new Promise((resolve) => setTimeout(resolve, 1))
      }
    },
    restore(): void {
      process.env.PATH = previous.path
      if (previous.log === undefined) delete process.env[SPAWN_LOG]
      else process.env[SPAWN_LOG] = previous.log
      if (previous.git === undefined) delete process.env[REAL_GIT]
      else process.env[REAL_GIT] = previous.git
    },
  }
}

// Budget spent at the moment a source has git in flight, and nowhere else.
async function collectWithTheBudgetSpentInsideItsFirstSource(
  repository: string,
  vocabulary: readonly AxisVocabulary[],
  reason: Error,
): Promise<readonly Observation[]> {
  const git = await gitHoldingEverySpawnAfterTheFirst()
  const budget = new AbortController()

  try {
    const collecting = new LiveRepositoryEvidenceCollector().collect(
      contextFor(repository, vocabulary, budget.signal),
    )
    // SAFETY: nothing consumes it until the abort has landed, and an unwatched rejection in between
    // would surface as an unhandled one.
    void collecting.catch(() => undefined)

    try {
      await git.waitForASourceToSpawn()
    } finally {
      budget.abort(reason)
    }

    return await collecting
  } finally {
    git.restore()
  }
}

function contextFor(
  path: string,
  vocabulary: readonly AxisVocabulary[] = FULL_VOCABULARY,
  signal: AbortSignal = NEVER_ABORTED,
): CollectorContext {
  return { path, vocabulary, signal }
}

describe('the live repository evidence collector', () => {
  it('observes nothing at all about a directory that is not a Git work tree', async () => {
    const notARepository = await emptyDirectory()
    await write(notARepository, { 'CLAUDE.md': 'project memory\n' })

    const observations = await new LiveRepositoryEvidenceCollector().collect(
      contextFor(notARepository),
    )

    // INVARIANT: a tracked tree is what makes a file versioned. The CLAUDE.md on disk proves
    // nothing, and its absence is an evidence gap, never a practice gap.
    expect(observations).toEqual([])
  })

  it('observes nothing about a directory that merely sits inside a Git work tree', async () => {
    const repository = await repositoryDeliveringSixChanges({ 'CLAUDE.md': 'project memory\n' })
    const inside = join(repository, 'nested')
    await mkdir(inside, { recursive: true })
    await write(repository, { 'nested/README.md': 'a subject of its own\n' })

    const observations = await new LiveRepositoryEvidenceCollector().collect(contextFor(inside))

    // INVARIANT: answering would publish the surrounding repository's harness as this subject's
    // evidence. Emitting nothing is an evidence gap, never a practice one.
    expect(observations).toEqual([])
  })

  it('emits no intervention value for a history no agent is attributed any work in', async () => {
    const collector = new LiveRepositoryEvidenceCollector()
    const repository = await repositoryDeliveringSixChanges({ 'CLAUDE.md': 'project memory\n' })

    const observations = await collector.collect(contextFor(repository))

    // INVARIANT: supportedAxes is what a collector may attempt, never what it delivered. Provenance
    // says who was asked, evidence says who answered. Here nothing carries an agent trailer, and
    // that absence is an evidence gap: a low intervention value would be a practice gap nobody saw.
    expect(collector.supportedAxes).toContain('intervention')
    expect(observations.map((observation) => observation.axis)).not.toContain('intervention')
    expect(observations.length).toBeGreaterThan(0)
  })

  it('observes autonomy when every delivered change is attributed to an agent alone', async () => {
    const repository = await repositoryDeliveringSixChanges({}, [], AGENT_TRAILER)

    const observations = await new LiveRepositoryEvidenceCollector().collect(
      contextFor(repository, AUTONOMY_VOCABULARY),
    )

    expect(observations).toContainEqual(
      expect.objectContaining({ axis: 'intervention', value: 'never-once-framed' }),
    )
  })

  it('drops an intervention value the loaded model has no name for', async () => {
    const repository = await repositoryDeliveringSixChanges({}, [], AGENT_TRAILER)

    const observations = await new LiveRepositoryEvidenceCollector().collect(
      contextFor(repository, FULL_VOCABULARY),
    )

    // INVARIANT: FULL_VOCABULARY's intervention scale stops below the value this history proves. A
    // collector ranks on the loaded model's own scale or stays silent; it never invents a member.
    expect(FULL_VOCABULARY).toContainEqual(
      expect.objectContaining({
        axis: 'intervention',
        values: expect.not.arrayContaining(['never-once-framed']),
      }),
    )
    expect(observations.map((observation) => observation.axis)).not.toContain('intervention')
  })

  it('publishes every observation as its own, and as observed rather than declared', async () => {
    const repository = await repositoryDeliveringSixChanges({ 'CLAUDE.md': 'project memory\n' })

    const observations = await new LiveRepositoryEvidenceCollector().collect(contextFor(repository))

    // Prose is never parsed, so this adapter has no declarative source by construction.
    expect(observations.map((observation) => observation.kind)).toEqual(
      observations.map(() => 'OBSERVED'),
    )
    expect(observations.map((observation) => observation.collector)).toEqual(
      observations.map(() => 'live-repository'),
    )
    expect(observations.every((observation) => observation.basis.length > 0)).toBe(true)
  })

  it('answers the axes on the model it was handed, and stays silent on the rest', async () => {
    const repository = await repositoryDeliveringSixChanges({ 'CLAUDE.md': 'project memory\n' })

    const observations = await new LiveRepositoryEvidenceCollector().collect(
      contextFor(repository, [{ axis: 'harness', kind: 'set', members: ['context-engineering'] }]),
    )

    expect(observations.map((observation) => observation.axis)).toEqual(['harness'])
  })

  it('drops a capability the loaded model has no name for rather than inventing one', async () => {
    const repository = await repositoryDeliveringSixChanges({
      'CLAUDE.md': 'project memory\n',
      'session.md': 'a working session\n',
    })

    const [harness] = await new LiveRepositoryEvidenceCollector().collect(
      contextFor(repository, [{ axis: 'harness', kind: 'set', members: ['prompts'] }]),
    )

    // INVARIANT: a term outside the loaded vocabulary is one this model cannot rank, and is dropped
    // rather than invented.
    expect(harness?.value).toEqual(['prompts'])
  })

  it('withholds the whole harness set when a capability could not be decided', async () => {
    const repository = await repositoryDeliveringSixChanges(
      {
        'CLAUDE.md': 'project memory\n',
        'tools/agent-loop.py': '#!/usr/bin/env python3\nsubprocess.run(["claude", "-p", "go"])\n',
      },
      ['tools/agent-loop.py'],
    )

    const observations = await new LiveRepositoryEvidenceCollector().collect(contextFor(repository))

    // INVARIANT: publishing the set without `loops` would report a practice gap nobody observed.
    // Withholding it is UNKNOWN, which is what the situation is.
    expect(observations.map((observation) => observation.axis)).not.toContain('harness')
    // And it costs that axis alone: the Git-derived ones are untouched.
    expect(observations.map((observation) => observation.axis).sort()).toEqual([
      'parallelism',
      'size',
    ])
  })

  it('is untroubled by a capability the loaded model has no name for', async () => {
    const repository = await repositoryDeliveringSixChanges(
      {
        'CLAUDE.md': 'project memory\n',
        'tools/agent-loop.py': '#!/usr/bin/env python3\nsubprocess.run(["claude", "-p", "go"])\n',
      },
      ['tools/agent-loop.py'],
    )

    // INVARIANT: failing to decide a term the engine cannot rank hides nothing the report could
    // have carried, so it costs the axis nothing.
    const [harness] = await new LiveRepositoryEvidenceCollector().collect(
      contextFor(repository, [
        { axis: 'harness', kind: 'set', members: ['prompts', 'context-engineering'] },
      ]),
    )

    expect(harness?.value).toEqual(['context-engineering'])
  })

  it('still reports the harness when no history is recoverable', async () => {
    const repository = await initRepository()
    await write(repository, { 'CLAUDE.md': 'project memory\n' })
    await git(repository, ['add', '-A'])
    await git(repository, ['commit', '-q', '-m', 'chore: initial commit'], day(0))

    const observations = await new LiveRepositoryEvidenceCollector().collect(contextFor(repository))

    // INVARIANT: the two sources fail independently — one unreadable source must not cost the
    // other.
    expect(observations.map((observation) => observation.axis)).toEqual(['harness'])
  })

  it('surfaces a budget spent while it was reading the harness, rather than an empty answer', async () => {
    const repository = await repositoryDeliveringSixChanges({ 'CLAUDE.md': 'project memory\n' })

    // SAFETY: the signal that matters trips mid-read. An entry check alone leaves every `catch`
    // free to swallow the abort and resolve `[]`, which the port forbids. This model names only the
    // harness axis, so the rejection can only have come through its `catch`. Asserted alone: a test
    // green whichever of two guards you delete holds neither.
    const collecting = collectWithTheBudgetSpentInsideItsFirstSource(
      repository,
      HARNESS_ONLY,
      new Error('harness budget exhausted mid-read'),
    )

    await expect(collecting).rejects.toThrow(Error)
    await expect(collecting).rejects.toThrow(/harness budget exhausted mid-read/)
  })

  it('surfaces a budget spent while it was reading the history, rather than an empty answer', async () => {
    const repository = await repositoryDeliveringSixChanges({ 'CLAUDE.md': 'project memory\n' })

    // The mirror of the test above, on the other source and its own `catch`.
    const collecting = collectWithTheBudgetSpentInsideItsFirstSource(
      repository,
      HISTORY_ONLY,
      new Error('history budget exhausted mid-read'),
    )

    await expect(collecting).rejects.toThrow(Error)
    await expect(collecting).rejects.toThrow(/history budget exhausted mid-read/)
  })

  it('refuses to answer at all once its budget is spent', async () => {
    const repository = await repositoryDeliveringSixChanges({ 'CLAUDE.md': 'project memory\n' })
    const spent = AbortSignal.abort(new Error('collector budget exhausted'))

    // The use case turns this into TIMED_OUT, so the rejection has to escape the adapter.
    const collecting = new LiveRepositoryEvidenceCollector().collect(
      contextFor(repository, FULL_VOCABULARY, spent),
    )

    await expect(collecting).rejects.toThrow(Error)
    await expect(collecting).rejects.toThrow(/collector budget exhausted/)
  })
})
