import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { bucketForFiles, bucketForLines, lowerBucket } from '../size-buckets.js'

/**
 * The delivery record a bundle carries, read from `git-activity.json`.
 *
 * A bundle publishes medians already aggregated over its own declared period, so nothing here
 * re-slices a window or checks a sample size: the counts behind an aggregate are not in it.
 *
 * `null` is a value the record did not yield, never a measurement of zero — the axis it belongs
 * to goes unobserved rather than being published low, which a minimum-threshold scale would
 * turn into a practice gap nobody saw.
 */
export interface RecordedActivity {
  readonly sizeBucket: string | null
  readonly intervention: string | null
  readonly parallelism: number | null
  /** `false` is a commit record read and holding no AI attribution; `null` is one not read. */
  readonly aiAttribution: boolean | null
}

const ACTIVITY_FILE = 'git-activity.json'

const NOTHING_RECORDED: RecordedActivity = {
  sizeBucket: null,
  intervention: null,
  parallelism: null,
  aiAttribution: null,
}

/** A change opened and never corrected. At this share the subject is granted the autonomy the
 *  corrective-commit median alone cannot express. */
const ZERO_TOUCH_SHARE_FOR_AUTONOMY = 0.9

export async function readRecordedActivity(bundlePath: string): Promise<RecordedActivity> {
  const document = await readJsonFile(join(bundlePath, ACTIVITY_FILE))
  if (document === null) return NOTHING_RECORDED

  const pullRequests = objectAt(document, 'pull_requests')
  const total = numberAt(pullRequests, 'total')

  return {
    sizeBucket: readSizeBucket(pullRequests, total),
    intervention: readIntervention(pullRequests, total),
    parallelism: numberAt(objectAt(document, 'parallelism'), 'median_concurrent_branches'),
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

  if (isAutonomous(pullRequests, total)) return 'never-once-framed'
  if (corrections >= 2.5) return 'after-the-fact-most'
  if (corrections >= 1.5) return 'after-the-fact-some'
  return 'key-steps'
}

function isAutonomous(pullRequests: unknown, total: number | null): boolean {
  const untouched = numberAt(pullRequests, 'merged_without_human_edit_after_open')
  if (untouched === null || total === null || total <= 0) return false
  return untouched / total >= ZERO_TOUCH_SHARE_FOR_AUTONOMY
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
