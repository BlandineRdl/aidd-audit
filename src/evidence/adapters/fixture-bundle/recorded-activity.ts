import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type DemonstratedValue, demonstratedFrom } from '../delivery-sample.js'
import { interventionFor } from '../intervention-scale.js'
import { bucketForFiles, bucketForLines, lowerBucket } from '../size-buckets.js'

// INVARIANT: The delivery record a bundle carries, read from `git-activity.json`. A bundle
// publishes medians already aggregated over its own declared period, so nothing here re-slices a
// window or checks a sample size: the counts behind an aggregate are not in it. `null` is a value
// the record did not yield, never a measurement of zero — the axis it belongs to goes unobserved
// rather than being published low, which a minimum-threshold scale would turn into a practice gap
// nobody saw.
export interface RecordedActivity {
  readonly sizeBucket: string | null
  // INVARIANT: `null` unless the record carries `parallelism.days_at_concurrency`. A bundle written
  // before that field existed answers the habitual question alone rather than gaining a reading it
  // never recorded.
  readonly demonstratedParallelism: DemonstratedValue<number> | null
  readonly intervention: string | null
  readonly parallelism: number | null
  // `false` is a commit record read and holding no AI attribution; `null` is one not read.
  readonly aiAttribution: boolean | null
}

const ACTIVITY_FILE = 'git-activity.json'

const NOTHING_RECORDED: RecordedActivity = {
  sizeBucket: null,
  demonstratedParallelism: null,
  intervention: null,
  parallelism: null,
  aiAttribution: null,
}

export async function readRecordedActivity(bundlePath: string): Promise<RecordedActivity> {
  const document = await readJsonFile(join(bundlePath, ACTIVITY_FILE))
  if (document === null) return NOTHING_RECORDED

  const pullRequests = objectAt(document, 'pull_requests')
  const total = numberAt(pullRequests, 'total')

  return {
    sizeBucket: readSizeBucket(pullRequests, total),
    intervention: readIntervention(pullRequests, total),
    parallelism: numberAt(objectAt(document, 'parallelism'), 'median_concurrent_branches'),
    demonstratedParallelism: readDemonstratedParallelism(objectAt(document, 'parallelism')),
    aiAttribution: readAiAttribution(objectAt(document, 'commits')),
  }
}

function readSizeBucket(pullRequests: unknown, total: number | null): string | null {
  if (total === 0) return 'none'

  const lines = numberAt(pullRequests, 'median_lines_changed')
  const files = numberAt(pullRequests, 'median_files_changed')
  if (lines === null || files === null) return null

  return lowerBucket(bucketForLines(lines), bucketForFiles(files))
}

function readIntervention(pullRequests: unknown, total: number | null): string | null {
  if (total === 0) return 'not-applicable'

  const corrections = numberAt(pullRequests, 'median_correction_commits_after_open')
  if (corrections === null) return null

  return interventionFor(corrections, zeroTouchShare(pullRequests, total))
}

// INVARIANT: `parallelism.days_at_concurrency` maps a branch count to the number of active days that
// carried it, which is the distribution behind the recorded median. It goes through the same rule
// the forge collector applies, so the two collectors cannot answer this question differently.
//
// SAFETY: a record whose distribution does not support its own recorded median is refused rather
// than reconciled. A bundle is a recording, and an inconsistent recording is not evidence of
// anything; averaging the two would publish a number neither half of the record states.
function readDemonstratedParallelism(parallelism: unknown): DemonstratedValue<number> | null {
  const days = objectAt(parallelism, 'days_at_concurrency')
  if (typeof days !== 'object' || days === null || Array.isArray(days)) return null

  const perActiveDay: number[] = []
  for (const [concurrency, activeDays] of Object.entries(days as Record<string, unknown>)) {
    const branches = Number(concurrency)
    if (!Number.isInteger(branches) || branches < 0) return null
    if (typeof activeDays !== 'number' || !Number.isInteger(activeDays) || activeDays < 0) {
      return null
    }
    for (let day = 0; day < activeDays; day += 1) perActiveDay.push(branches)
  }
  if (perActiveDay.length === 0) return null

  const recorded = numberAt(parallelism, 'median_concurrent_branches')
  if (recorded !== null && medianOf(perActiveDay) !== recorded) return null

  const seen = [...new Set(perActiveDay)].sort((left, right) => left - right)
  return demonstratedFrom(
    perActiveDay.length,
    seen,
    (candidate) => perActiveDay.filter((count) => count >= candidate).length,
  )
}

function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle] ?? 0
  if (sorted.length % 2 === 1) return upper
  return ((sorted[middle - 1] ?? 0) + upper) / 2
}

// `null` is a record that did not carry the count, never a share of zero.
function zeroTouchShare(pullRequests: unknown, total: number | null): number | null {
  const untouched = numberAt(pullRequests, 'merged_without_human_edit_after_open')
  if (untouched === null || total === null || total <= 0) return null
  return untouched / total
}

function readAiAttribution(commits: unknown): boolean | null {
  const ratio = numberAt(commits, 'ai_coauthored_ratio')
  return ratio === null ? null : ratio > 0
}

async function readJsonFile(absolute: string): Promise<unknown> {
  let content: string
  try {
    content = await readFile(absolute, 'utf8')
  } catch {
    return null
  }

  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

function objectAt(document: unknown, key: string): unknown {
  if (typeof document !== 'object' || document === null) return null
  return (document as Record<string, unknown>)[key]
}

function numberAt(document: unknown, key: string): number | null {
  const value = objectAt(document, key)
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
