import { runGh } from './gh-process.js'
import type { RepositorySlug } from './repository-slug.js'
import {
  type DemonstratedValue,
  demonstratedCountFrom,
  demonstratedFrom,
  MINIMUM_ACTIVE_DAYS,
  MINIMUM_DELIVERED_CHANGES,
  median,
  windowStartFrom,
} from '../delivery-sample.js'
import { interventionFor } from '../intervention-scale.js'
import {
  bucketForFiles,
  bucketForLines,
  lowerBucket,
  SIZE_BUCKETS,
  type SizeBucket,
} from '../size-buckets.js'

export interface ForgeDerivedMetrics {
  readonly sizeBucket: string | null
  readonly demonstratedSize: DemonstratedValue<string> | null
  readonly intervention: string | null
  readonly parallelism: number | null
  readonly demonstratedParallelism: DemonstratedValue<number> | null
}

const UNRECOVERABLE: ForgeDerivedMetrics = {
  sizeBucket: null,
  demonstratedSize: null,
  intervention: null,
  parallelism: null,
  demonstratedParallelism: null,
}

// INVARIANT: One delivered change is one merged pull request, which is why this collector sees what
// the graph cannot: a squash merge erases the branch but never the pull request.
interface MergedPullRequest {
  readonly mergedAt: string
  readonly createdAt: string
  readonly lines: number
  readonly files: number
  readonly commitDays: readonly string[]
  readonly commitsAfterOpen: number
  readonly openedByABot: boolean
}

const PAGE_SIZE = 50

// LIMITATION: A page cap rather than an unbounded walk. At fifty per page the window of a busy
// repository fits in a handful of round trips, and a repository past this many merged pull requests
// has far more than the window needs anyway. What it costs is a subject whose window sits beyond the
// cap, which cannot happen while pages come back newest first.
const MAXIMUM_PAGES = 20

// INVARIANT: Commits are capped per pull request. A branch longer than this contributes its first
// hundred commits, which moves a median of corrections only on a subject where the median is already
// far above every threshold on the scale.
const QUERY = `
query($owner: String!, $name: String!, $size: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: MERGED, first: $size, orderBy: {field: CREATED_AT, direction: DESC}, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        createdAt
        mergedAt
        additions
        deletions
        changedFiles
        author { __typename }
        commits(first: 100) { nodes { commit { committedDate } } }
      }
    }
  }
}`

// INVARIANT: Rejects on an abort and on any refusal from `gh`, both of which the adapter turns into
// an evidence gap. Returns nulls when the window holds too small a sample, never a value computed
// from less than the floors allow.
//
// INVARIANT: `subjectActivityEnd` is the instant of the subject's most recent commit, so this
// collector measures the same period as the local one and the two stay interchangeable behind their
// port. Ending at the most recent *merged pull request* instead would let a stretch of direct
// commits pull the window back, and on a subject whose median sits near a bucket bound that moves
// the reported level. `null` falls back to the most recent merge, which is all a subject whose
// history could not be read still offers.
export async function readForgeDerivedMetrics(
  slug: RepositorySlug,
  subjectActivityEnd: number | null,
  signal: AbortSignal,
): Promise<ForgeDerivedMetrics> {
  const merged = await readMergedPullRequests(slug, signal)
  if (merged === null || merged.length === 0) return UNRECOVERABLE

  const windowEnd =
    subjectActivityEnd ??
    merged.reduce(
      (latest, request) => Math.max(latest, Date.parse(request.mergedAt)),
      Number.NEGATIVE_INFINITY,
    )
  if (!Number.isFinite(windowEnd)) return UNRECOVERABLE

  const windowStart = windowStartFrom(windowEnd)
  // SAFETY: bounded at both ends, because a pull request merged into another branch after the
  // subject's last commit is outside the period being measured, not the newest thing in it.
  //
  // SAFETY: a delivery opened by a bot is nobody's practice. The axis measures "la taille habituelle
  // des features livrées avec l'IA", and a scheduled dependency bump is neither a feature nor
  // delivered with an agent, so counting it describes the repository's churn instead of the
  // subject's work. On the repository this was written against, twenty such deliveries out of a
  // hundred and eight halved the median size and cost a whole level. An author GitHub cannot type is
  // kept: absence of proof that it is a bot is not proof that it is one.
  const inWindow = merged.filter((request) => {
    if (request.openedByABot) return false
    const instant = Date.parse(request.mergedAt)
    return Number.isFinite(instant) && instant >= windowStart && instant <= windowEnd
  })

  const bucketPerDelivery = inWindow.map(bucketOf)
  const requestsPerActiveDay = countRequestsPerActiveDay(inWindow)

  return {
    sizeBucket: readSizeBucket(inWindow),
    demonstratedSize: readDemonstratedSize(bucketPerDelivery),
    intervention: readIntervention(inWindow),
    parallelism: readParallelism(requestsPerActiveDay),
    demonstratedParallelism: readDemonstratedParallelism(requestsPerActiveDay),
  }
}

// INVARIANT: `null` whenever the walk could not be completed — an unreadable page, or the page cap
// reached with more still offered. Every caller turns that into an evidence gap, because a partial
// window is not a smaller repository.
async function readMergedPullRequests(
  slug: RepositorySlug,
  signal: AbortSignal,
): Promise<readonly MergedPullRequest[] | null> {
  const collected: MergedPullRequest[] = []
  let cursor: string | null = null

  for (let pageIndex = 0; pageIndex < MAXIMUM_PAGES; pageIndex += 1) {
    const args = [
      'api',
      'graphql',
      '-f',
      `query=${QUERY}`,
      '-F',
      `owner=${slug.owner}`,
      '-F',
      `name=${slug.name}`,
      '-F',
      `size=${PAGE_SIZE}`,
      ...(cursor === null ? [] : ['-F', `after=${cursor}`]),
    ]

    const page = readPage(await runGh(args, signal))
    if (page === null) return null
    collected.push(...page.nodes)
    if (!page.hasNextPage || page.endCursor === null) return collected
    cursor = page.endCursor
  }

  // LIMITATION: the walk hit the page cap with the forge still offering more, so the window is
  // knowingly incomplete. Publishing a median from it would describe part of the period as if it
  // were the whole, so nothing is published at all.
  return null
}

interface Page {
  readonly nodes: readonly MergedPullRequest[]
  readonly hasNextPage: boolean
  readonly endCursor: string | null
}

// SAFETY: `null` is a page the forge answered with something this code cannot interpret, and it is
// distinct from a page that legitimately held nothing. A payload that parsed but carried no
// connection — `{"data":{"repository":null},"errors":[…]}`, which `gh` returns with exit 0 — used to
// become an empty page whose `hasNextPage: false` ended the walk, and the metrics were then computed
// from a knowingly truncated window and published as if it were whole.
function readPage(stdout: string): Page | null {
  let document: unknown
  try {
    document = JSON.parse(stdout)
  } catch {
    return null
  }

  const connection = objectAt(objectAt(objectAt(document, 'data'), 'repository'), 'pullRequests')
  const nodes = objectAt(connection, 'nodes')
  if (!Array.isArray(nodes)) return null

  const pageInfo = objectAt(connection, 'pageInfo')
  return {
    nodes: nodes.flatMap((node) => {
      const request = readPullRequest(node)
      return request === null ? [] : [request]
    }),
    hasNextPage: objectAt(pageInfo, 'hasNextPage') === true,
    endCursor: stringAt(pageInfo, 'endCursor'),
  }
}

function readPullRequest(node: unknown): MergedPullRequest | null {
  const mergedAt = stringAt(node, 'mergedAt')
  const createdAt = stringAt(node, 'createdAt')
  const additions = numberAt(node, 'additions')
  const deletions = numberAt(node, 'deletions')
  const files = numberAt(node, 'changedFiles')
  if (
    mergedAt === null ||
    createdAt === null ||
    additions === null ||
    deletions === null ||
    files === null
  ) {
    return null
  }

  const commitDates = readCommitDates(node)
  return {
    mergedAt,
    createdAt,
    // Lines changed is additions *and* deletions: a change that removes 300 lines is not empty.
    lines: additions + deletions,
    files,
    commitDays: commitDates.map((date) => date.slice(0, 10)),
    commitsAfterOpen: commitDates.filter((date) => date > createdAt).length,
    // COMPAT: GitHub types a pull request's author, and a GitHub App comes back as `Bot`. That is a
    // structural fact rather than a name, so no list of bot logins has to be kept correct here —
    // `renovate` and `dependabot` do not even carry a `[bot]` suffix on this field.
    openedByABot: stringAt(objectAt(node, 'author'), '__typename') === 'Bot',
  }
}

function readCommitDates(node: unknown): readonly string[] {
  const nodes = objectAt(objectAt(node, 'commits'), 'nodes')
  if (!Array.isArray(nodes)) return []
  return nodes.flatMap((entry) => {
    const date = stringAt(objectAt(entry, 'commit'), 'committedDate')
    return date === null ? [] : [date]
  })
}

// One delivery's own bucket, the lower of what its lines and its files say.
function bucketOf(request: MergedPullRequest): SizeBucket {
  return lowerBucket(bucketForLines(request.lines), bucketForFiles(request.files))
}

// INVARIANT: The habitual size, bucketed from the median line count and the median file count. It is
// deliberately not the median of the per-delivery buckets the demonstrated reading uses: this is the
// computation both other collectors already perform, and changing it would move every subject's
// level for a reason unrelated to adding a second reading.
function readSizeBucket(inWindow: readonly MergedPullRequest[]): SizeBucket | null {
  if (inWindow.length < MINIMUM_DELIVERED_CHANGES) return null

  return lowerBucket(
    bucketForLines(median(inWindow.map((request) => request.lines))),
    bucketForFiles(median(inWindow.map((request) => request.files))),
  )
}

// The largest size a third of deliveries reach, which is a capability and not a habit.
function readDemonstratedSize(
  buckets: readonly SizeBucket[],
): DemonstratedValue<SizeBucket> | null {
  return demonstratedFrom(
    buckets.length,
    SIZE_BUCKETS,
    (candidate) =>
      buckets.filter((bucket) => SIZE_BUCKETS.indexOf(bucket) >= SIZE_BUCKETS.indexOf(candidate))
        .length,
  )
}

// LIMITATION: A commit later than the moment the pull request was opened. On a subject that opens a
// pull request once the work is finished this counts a correction; on one that opens a draft and
// keeps working it counts ordinary work, and the two are indistinguishable here. Measuring from the
// first review would separate them, and needs a subject whose pull requests are reviewed.
//
// SAFETY: **the zero-touch route is deliberately not taken here.** `interventionFor` will grant
// `never-once-framed` — "jamais, une fois la tâche cadrée", the top rank a source can observe and
// Silver's requirement — when almost no delivery took a commit after opening. Nothing in this file
// reads authorship, so on the ordinary workflow of pushing a branch and then opening the pull
// request every delivery is zero-touch, and a repository with no agent involvement at all would be
// credited with never having been touched by a human. That is granting the scale's top rank from an
// absence, which is the one thing the conservative rule forbids outright. The live collector reaches
// the same value only where every absorbed commit is attributed to an agent, and a bundle only from
// a field that records human edit by name. Passing `null` keeps this source to the three corrective
// ranks it can actually see.
function readIntervention(inWindow: readonly MergedPullRequest[]): string | null {
  if (inWindow.length < MINIMUM_DELIVERED_CHANGES) return null

  return interventionFor(median(inWindow.map((request) => request.commitsAfterOpen)), null)
}

// INVARIANT: How many distinct pull requests received a commit, on each day one did. This is the
// forge's answer to the branch count the merge graph loses to a squash.
function countRequestsPerActiveDay(inWindow: readonly MergedPullRequest[]): readonly number[] {
  const requestsByDay = new Map<string, Set<string>>()

  for (const [index, request] of inWindow.entries()) {
    for (const day of request.commitDays) {
      const requests = requestsByDay.get(day) ?? new Set<string>()
      requests.add(`${index}`)
      requestsByDay.set(day, requests)
    }
  }

  return [...requestsByDay.values()].map((requests) => requests.size)
}

// The median and not the peak, because a spike is not a habit.
function readParallelism(perActiveDay: readonly number[]): number | null {
  if (perActiveDay.length < MINIMUM_ACTIVE_DAYS) return null
  return median(perActiveDay)
}

// INVARIANT: the most work a third of active days carried at once, a capability rather than a
// habit. The candidates are every count actually seen, so no value is offered that no day reached.
function readDemonstratedParallelism(
  perActiveDay: readonly number[],
): DemonstratedValue<number> | null {
  const daysAtConcurrency = new Map<number, number>()
  for (const count of perActiveDay) {
    daysAtConcurrency.set(count, (daysAtConcurrency.get(count) ?? 0) + 1)
  }
  return demonstratedCountFrom(daysAtConcurrency)
}

function objectAt(document: unknown, key: string): unknown {
  if (typeof document !== 'object' || document === null) return null
  return (document as Record<string, unknown>)[key]
}

function numberAt(document: unknown, key: string): number | null {
  const value = objectAt(document, key)
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringAt(document: unknown, key: string): string | null {
  const value = objectAt(document, key)
  return typeof value === 'string' && value !== '' ? value : null
}
