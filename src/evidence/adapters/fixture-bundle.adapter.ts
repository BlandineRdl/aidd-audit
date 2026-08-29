import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { AxisId, AxisVocabulary } from '../models/axis.model.js'
import type { Observation, ObservedValue } from '../models/observation.model.js'
import type { CollectorContext, EvidenceCollector } from '../ports/evidence-collector.port.js'
import { bundleTree } from './fixture-bundle/bundle-tree.js'
import { readRecordedActivity, type RecordedActivity } from './fixture-bundle/recorded-activity.js'
import { decidedCapabilities } from './harness/decided-capabilities.js'
import { scanHarness } from './harness/harness-scan.js'

const COLLECTOR_ID = 'fixture-bundle'

// A marker, never a source: nothing in it is admissible for any axis.
const BUNDLE_MANIFEST = 'profile.json'

// INVARIANT: Every observation is `OBSERVED`: the one declarative artifact a bundle carries is
// prose, and prose is never parsed.
export class FixtureBundleEvidenceCollector implements EvidenceCollector {
  readonly id = COLLECTOR_ID
  readonly supportedAxes: readonly AxisId[] = ['size', 'harness', 'intervention', 'parallelism']

  async collect(context: CollectorContext): Promise<readonly Observation[]> {
    context.signal.throwIfAborted()

    if (!(await isBundle(context.path))) return []

    const activity = await readRecordedActivity(context.path)
    context.signal.throwIfAborted()

    return [...(await collectHarness(context, activity)), ...collectRecorded(context, activity)]
  }
}

async function isBundle(path: string): Promise<boolean> {
  try {
    return (await stat(join(path, BUNDLE_MANIFEST))).isFile()
  } catch {
    return false
  }
}

async function collectHarness(
  context: CollectorContext,
  activity: RecordedActivity,
): Promise<readonly Observation[]> {
  const scale = scaleFor(context.vocabulary, 'harness')
  if (scale?.kind !== 'set') return []

  try {
    const tree = await bundleTree(context.path, context.signal)
    const scan = await scanHarness(tree, activity.aiAttribution, context.signal)

    const capabilities = decidedCapabilities(scan, scale)
    if (capabilities === null) return []

    return [
      observation(
        'harness',
        capabilities,
        `recorded tree of ${context.path}, union of what was seen`,
      ),
    ]
  } catch (error) {
    if (context.signal.aborted) throw error
    if (isFilesystemRefusal(error)) return []
    throw error
  }
}

// SAFETY: A directory or file the filesystem refused to hand over is an evidence gap, and Node
// reports one with an `errno` code. Anything without one is a defect in this code; returning `[]`
// for it would publish that defect as an absence nobody observed, on a run still reported
// `COMPLETED` with no reason. Rethrowing hands it to `runCollector`, which reports `FAILED`.
function isFilesystemRefusal(error: unknown): boolean {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string'
}

function collectRecorded(
  context: CollectorContext,
  activity: RecordedActivity,
): readonly Observation[] {
  const observations: Observation[] = []

  if (onOrdinalScale(context.vocabulary, 'size', activity.sizeBucket)) {
    observations.push(
      observation(
        'size',
        activity.sizeBucket,
        'recorded median delivered change, lower of the lines and files buckets',
      ),
    )
  }

  if (onOrdinalScale(context.vocabulary, 'intervention', activity.intervention)) {
    observations.push(
      observation(
        'intervention',
        activity.intervention,
        'recorded median of corrective commits after a change was opened',
      ),
    )
  }

  if (
    activity.parallelism !== null &&
    scaleFor(context.vocabulary, 'parallelism')?.kind === 'numeric'
  ) {
    observations.push(
      observation(
        'parallelism',
        activity.parallelism,
        'recorded median, over active days, of branches worked in parallel',
      ),
    )
  }

  return observations
}

function onOrdinalScale(
  vocabulary: readonly AxisVocabulary[],
  axis: AxisId,
  value: string | null,
): value is string {
  const scale = scaleFor(vocabulary, axis)
  return value !== null && scale?.kind === 'ordinal' && scale.values.includes(value)
}

function scaleFor(vocabulary: readonly AxisVocabulary[], axis: AxisId): AxisVocabulary | undefined {
  return vocabulary.find((scale) => scale.axis === axis)
}

function observation(axis: AxisId, value: ObservedValue, basis: string): Observation {
  return { axis, value, kind: 'OBSERVED', collector: COLLECTOR_ID, basis }
}
