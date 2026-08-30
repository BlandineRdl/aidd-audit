import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AxisVocabulary } from '../models/axis.model.js'
import type { Observation } from '../models/observation.model.js'
import { FixtureBundleEvidenceCollector } from './fixture-bundle.adapter.js'
import { InconsistentRecordError } from './fixture-bundle/inconsistent-record.error.js'

const AIDD_VOCABULARY: readonly AxisVocabulary[] = [
  { axis: 'size', kind: 'ordinal', values: ['none', 'S', 'M', 'L', 'XL'] },
  {
    axis: 'harness',
    kind: 'set',
    members: ['prompts', 'context-engineering', 'behavior', 'loops'],
  },
  {
    axis: 'intervention',
    kind: 'ordinal',
    values: [
      'not-applicable',
      'after-the-fact-most',
      'after-the-fact-some',
      'key-steps',
      'never-once-framed',
      'never-framing-included',
    ],
  },
  { axis: 'parallelism', kind: 'numeric' },
]

let bundles: string[] = []

afterEach(() => {
  for (const bundle of bundles) rmSync(bundle, { recursive: true, force: true })
  bundles = []
})

function bundleHolding(files: Readonly<Record<string, string>>): string {
  const path = mkdtempSync(join(tmpdir(), 'aidd-bundle-'))
  bundles.push(path)

  for (const [name, content] of Object.entries(files)) {
    const absolute = join(path, name)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, content)
  }

  return path
}

const MANIFEST = { 'profile.json': '{}' }

function activity(pullRequests: unknown, extra: Readonly<Record<string, unknown>> = {}): string {
  return JSON.stringify({ pull_requests: pullRequests, ...extra })
}

async function collectFrom(
  path: string,
  vocabulary: readonly AxisVocabulary[] = AIDD_VOCABULARY,
): Promise<readonly Observation[]> {
  return (
    await new FixtureBundleEvidenceCollector().collect({
      path,
      vocabulary,
      signal: new AbortController().signal,
    })
  ).observations
}

function valueFor(observations: readonly Observation[], axis: string): unknown {
  return observations.find((observation) => observation.axis === axis)?.value
}

describe('a directory is a bundle only when it says so', () => {
  it('observes nothing about a directory carrying no manifest', async () => {
    const path = bundleHolding({ 'git-activity.json': activity({ total: 40 }) })

    expect(await collectFrom(path)).toEqual([])
  })
})

describe('the recorded delivery answers three axes', () => {
  it.each([
    [99, 2, 'S'],
    [100, 2, 'S'],
    [100, 5, 'M'],
    [399, 5, 'M'],
    [400, 10, 'L'],
    [999, 24, 'L'],
    [1000, 25, 'XL'],
  ])('buckets %s lines over %s files as %s', async (lines, files, expected) => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity({
        total: 40,
        median_lines_changed: lines,
        median_files_changed: files,
      }),
    })

    expect(valueFor(await collectFrom(path), 'size')).toBe(expected)
  })

  it('buckets size on the lower of the recorded lines and files medians', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      // Lines say L, files say M. The axis is a minimum threshold, so M is the honest read.
      'git-activity.json': activity({
        total: 40,
        median_lines_changed: 500,
        median_files_changed: 7,
      }),
    })

    expect(valueFor(await collectFrom(path), 'size')).toBe('M')
  })

  it('reads intervention from the median of corrective commits after a change was opened', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity({
        total: 40,
        median_correction_commits_after_open: 2,
        merged_without_human_edit_after_open: 4,
      }),
    })

    expect(valueFor(await collectFrom(path), 'intervention')).toBe('after-the-fact-some')
  })

  it.each([
    [2.5, 'after-the-fact-most'],
    [2.49, 'after-the-fact-some'],
    [1.5, 'after-the-fact-some'],
    [1.49, 'key-steps'],
  ])('reads a median of %s as %s', async (corrections, expected) => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity({
        total: 40,
        median_correction_commits_after_open: corrections,
        merged_without_human_edit_after_open: 4,
      }),
    })

    expect(valueFor(await collectFrom(path), 'intervention')).toBe(expected)
  })

  it('withholds autonomy from a share just under the bar', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity({
        total: 40,
        median_correction_commits_after_open: 2,
        merged_without_human_edit_after_open: 35,
      }),
    })

    expect(valueFor(await collectFrom(path), 'intervention')).toBe('after-the-fact-some')
  })

  it('grants autonomy when nearly every change was merged untouched', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity({
        total: 40,
        median_correction_commits_after_open: 2,
        merged_without_human_edit_after_open: 36,
      }),
    })

    expect(valueFor(await collectFrom(path), 'intervention')).toBe('never-once-framed')
  })

  it('takes the median of branches worked in parallel, never the peak', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity(
        { total: 40 },
        { parallelism: { max_concurrent_branches: 9, median_concurrent_branches: 2 } },
      ),
    })

    expect(valueFor(await collectFrom(path), 'parallelism')).toBe(2)
  })

  it('answers the habitual question alone when the record carries no distribution', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity(
        { total: 40 },
        { parallelism: { max_concurrent_branches: 9, median_concurrent_branches: 2 } },
      ),
    })

    // INVARIANT: a bundle written before the field existed must not gain a reading it never
    // recorded. `max_concurrent_branches` is not a distribution and never stands in for one.
    const observations = await collectFrom(path)
    expect(observations.filter((entry) => entry.reading === 'DEMONSTRATED')).toEqual([])
  })

  it('reads the recorded days to say what the subject reached, and how often', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity(
        { total: 40 },
        {
          parallelism: {
            max_concurrent_branches: 4,
            median_concurrent_branches: 1,
            days_at_concurrency: { '1': 10, '3': 5, '4': 3 },
          },
        },
      ),
    })

    const observations = await collectFrom(path)
    const demonstrated = observations.find((entry) => entry.reading === 'DEMONSTRATED')

    // Eight of eighteen days carried three branches or more, past a third; only three carried four.
    expect(demonstrated).toMatchObject({
      axis: 'parallelism',
      value: 3,
      demonstration: { unit: 'ACTIVE_DAYS' },
    })
    expect(valueFor(observations, 'parallelism')).toBe(1)
  })

  it('refuses a distribution that cannot support the median recorded beside it', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity(
        { total: 40 },
        {
          parallelism: {
            max_concurrent_branches: 4,
            median_concurrent_branches: 4,
            days_at_concurrency: { '1': 10, '3': 5, '4': 3 },
          },
        },
      ),
    })

    // INVARIANT: named, not dropped. Dropping it would be indistinguishable from a bundle that
    // recorded no distribution at all, and the reader would never learn the record was wrong. The
    // rejection carries both numbers, so the message says which halves disagree.
    await expect(collectFrom(path)).rejects.toBeInstanceOf(InconsistentRecordError)
    await expect(collectFrom(path)).rejects.toThrow(/median of 4/)
    await expect(collectFrom(path)).rejects.toThrow(/yields 1/)
  })

  it('reports a period that delivered nothing as such, not as a gap', async () => {
    const path = bundleHolding({ ...MANIFEST, 'git-activity.json': activity({ total: 0 }) })

    const observations = await collectFrom(path)

    expect(valueFor(observations, 'size')).toBe('none')
    expect(valueFor(observations, 'intervention')).toBe('not-applicable')
  })

  it('leaves an axis unobserved when the record holds no number for it', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity({ total: 40, median_lines_changed: null }),
    })

    const observations = await collectFrom(path)

    expect(valueFor(observations, 'size')).toBeUndefined()
    expect(valueFor(observations, 'intervention')).toBeUndefined()
  })

  it('drops a value the loaded scale cannot rank rather than inventing a term', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity({
        total: 40,
        median_lines_changed: 50,
        median_files_changed: 2,
      }),
    })
    const withoutSmall = AIDD_VOCABULARY.map((scale) =>
      scale.axis === 'size' ? { ...scale, kind: 'ordinal' as const, values: ['M', 'L'] } : scale,
    )

    expect(valueFor(await collectFrom(path, withoutSmall), 'size')).toBeUndefined()
  })
})

describe('the harness set is read from the tree the bundle recorded', () => {
  it('proves prompts from the recorded commits, with no transcript in the tree', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity({ total: 40 }, { commits: { ai_coauthored_ratio: 0.6 } }),
    })

    expect(valueFor(await collectFrom(path), 'harness')).toEqual(['prompts'])
  })

  it('anchors a root-relative name under the recorded root', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity({ total: 40 }, { commits: { ai_coauthored_ratio: 0.6 } }),
      'repo-context/docs/context/architecture.md': '# Architecture\n',
      'repo-context/.claude/rules/go.md': '# Go\n',
    })

    expect(valueFor(await collectFrom(path), 'harness')).toEqual([
      'prompts',
      'context-engineering',
      'behavior',
    ])
  })

  it('proves prompts from a transcript filed outside the recorded root', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity({ total: 40 }, { commits: { ai_coauthored_ratio: 0 } }),
      'code/prompt-history.md': '> do the thing\n',
    })

    expect(valueFor(await collectFrom(path), 'harness')).toEqual(['prompts'])
  })

  it('reads a commit record holding no attribution as an answer, not as a gap', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity({ total: 40 }, { commits: { ai_coauthored_ratio: 0 } }),
      'repo-context/CLAUDE.md': '# Instructions\n',
    })

    expect(valueFor(await collectFrom(path), 'harness')).toEqual(['context-engineering'])
  })

  it('costs the whole axis when the commit record was not read at all', async () => {
    const path = bundleHolding({ ...MANIFEST, 'repo-context/CLAUDE.md': '# Instructions\n' })

    expect(valueFor(await collectFrom(path), 'harness')).toBeUndefined()
  })

  it('costs nothing when another route already proved the undecided capability', async () => {
    const path = bundleHolding({ ...MANIFEST, 'session.md': '> then the commit\n' })

    expect(valueFor(await collectFrom(path), 'harness')).toEqual(['prompts'])
  })
})

describe('a bundle records no file mode, so a script is known by its shebang', () => {
  const RETRY_LOOP = '#!/bin/sh\nuntil pnpm check; do\n  claude -p "fix the failures"\ndone\n'

  it('proves loops from a shell script the recorded tree could not mark executable', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity({ total: 40 }, { commits: { ai_coauthored_ratio: 0.6 } }),
      'repo-context/scripts/retry.sh': RETRY_LOOP,
    })

    expect(valueFor(await collectFrom(path), 'harness')).toContain('loops')
  })

  it('weighs a script whose interpreter is not a shell, rather than passing over it', async () => {
    // COMPAT: A recorded tree cannot mark a file executable, so passing over it would drop `loops`
    // from a published set — a practice gap, where undecidable is the evidence gap it is.
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity({ total: 40 }, { commits: { ai_coauthored_ratio: 0.6 } }),
      'repo-context/scripts/retry.js': '#!/usr/bin/env node\nspawn("claude -p fix && exit 1")\n',
    })

    expect(valueFor(await collectFrom(path), 'harness')).toBeUndefined()
  })

  it('decides nothing from a script that spawns no agent, rather than doubting the axis', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity({ total: 40 }, { commits: { ai_coauthored_ratio: 0.6 } }),
      'repo-context/.claude/hooks/check.js': '#!/usr/bin/env node\nexecFileSync("git", ["diff"])\n',
    })

    expect(valueFor(await collectFrom(path), 'harness')).toEqual(['prompts', 'behavior'])
  })

  it('leaves a document about a loop out of it, prose being never parsed', async () => {
    const path = bundleHolding({
      ...MANIFEST,
      'git-activity.json': activity({ total: 40 }, { commits: { ai_coauthored_ratio: 0.6 } }),
      'repo-context/docs/brainstorm/auto-retry.md': `# One day\n\n\`\`\`sh\n${RETRY_LOOP}\`\`\`\n`,
    })

    // SAFETY: Both other answers are wrong: undecidable costs the whole axis, proven credits a
    // practice the subject wrote down and never built.
    expect(valueFor(await collectFrom(path), 'harness')).toEqual(['prompts'])
  })
})

describe('cancellation', () => {
  it('refuses to start on a spent budget', async () => {
    const path = bundleHolding(MANIFEST)
    const controller = new AbortController()
    controller.abort()

    await expect(
      new FixtureBundleEvidenceCollector().collect({
        path,
        vocabulary: AIDD_VOCABULARY,
        signal: controller.signal,
      }),
    ).rejects.toThrow()
  })
})
