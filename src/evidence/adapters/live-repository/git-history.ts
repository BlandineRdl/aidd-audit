import { mostRecentCommitDate, runGit } from './git-process.js'
import { AUTONOMOUS_INTERVENTION, ZERO_TOUCH_SHARE_FOR_AUTONOMY } from '../autonomy.js'
import {
  MINIMUM_ACTIVE_DAYS,
  MINIMUM_DELIVERED_CHANGES,
  median,
  windowStartFrom,
} from '../delivery-sample.js'
import { bucketForFiles, bucketForLines, lowerBucket, type SizeBucket } from '../size-buckets.js'

// LIMITATION: The share of what landed on the mainline that must be a merge before branch shape is
// read as the delivery record. Below it the merges are a minority of what was delivered, and a
// median or a branch count drawn from them describes that minority while reading as a statement
// about the repository. A squash-merged or rebased history is the case: the branch is gone, its
// delivery lands as an ordinary mainline commit, and nothing distinguishes it from a direct push.
// **One in four is chosen, not measured, and nothing in this project establishes it.** It is not
// one in two because merging every branch while pushing an equal number of direct commits is an
// ordinary workflow that sits exactly at a half, and a rule withholding there would call half a
// sample a minority. The cost is asymmetric in the usual direction. Too high withholds two axes
// from a repository that merges most of its work and pushes the rest directly, which is an evidence
// gap the report names as one. Too low publishes a confident value computed from a fraction of the
// deliveries, and on a minimum-threshold scale a low value is a practice gap nobody observed. **Not
// to be lowered so that a given repository classifies.** Move it only from an observed distribution
// across real repositories, which needs a corpus this project does not have. What lifts this
// properly is a forge collector, which reads the pull request rather than the graph the merge left
// behind.
const MINIMUM_MERGE_SHARE = 0.25

// Field separator inside one `git log` record. Never occurs in a hash, date or parent list.
const FIELD = '\x1f'

export interface GitDerivedMetrics {
  readonly sizeBucket: string | null
  readonly intervention: string | null
  readonly parallelism: number | null
}

// Nothing was recoverable: an evidence gap, never a measurement of zero.
const UNRECOVERABLE: GitDerivedMetrics = {
  sizeBucket: null,
  intervention: null,
  parallelism: null,
}

interface WalkCommit {
  readonly hash: string
  readonly authorDate: string
  readonly parents: readonly string[]
}

interface DeliveredChange extends WalkCommit {
  readonly parents: readonly [string, string, ...string[]]
}

function isDeliveredChange(commit: WalkCommit): commit is DeliveredChange {
  return commit.parents.length >= 2
}

// INVARIANT: nulls whenever the history is not recoverable — shallow, unborn, without a merge, or
// too small a sample. Rejects on an abort, and on the `git diff` a partial clone whose origin is
// unreachable fails outright.
export async function readGitDerivedMetrics(
  path: string,
  signal: AbortSignal,
): Promise<GitDerivedMetrics> {
  // SAFETY: A truncation looks ordinary: the most recent commit is still the most recent, and a
  // deep enough one clears the minimum sample and publishes a confidently wrong median.
  if (await isShallowRepository(path, signal)) return UNRECOVERABLE

  // An unborn HEAD makes `git log` exit fatal. Unreadable is not empty.
  const walk = await readFirstParentWalk(path, signal)
  if (walk === null) return UNRECOVERABLE

  // SAFETY: A delivered change is one merge commit, and no merge leaves nothing recoverable: a
  // squash history and a rebase history are indistinguishable afterwards and demand opposite
  // readings, so guessing low here would publish a practice gap nobody observed.
  const merges = walk.filter(isDeliveredChange)
  if (merges.length === 0) return UNRECOVERABLE

  const windowEnd = await mostRecentCommitDate(path, signal)
  if (windowEnd === null) return UNRECOVERABLE
  const windowStart = windowStartFrom(windowEnd)
  const inWindow = (authorDate: string): boolean => {
    const instant = Date.parse(authorDate)
    return Number.isFinite(instant) && instant >= windowStart
  }

  const deliveredInWindow = merges.filter((merge) => inWindow(merge.authorDate))
  const landedDirectlyInWindow = walk.filter(
    (commit) => !isDeliveredChange(commit) && inWindow(commit.authorDate),
  )

  // SAFETY: Both branch-derived axes stand or fall together, because they read the same graph. The
  // intervention axis is deliberately outside: it reads authorship, which squashing does not erase.
  const readsBranchShape = mergesCarryTheDeliveries(
    deliveredInWindow.length,
    landedDirectlyInWindow.length,
  )

  const sizeBucket = readsBranchShape ? await readSizeBucket(path, deliveredInWindow, signal) : null

  const intervention = await readAutonomy(path, deliveredInWindow, signal)

  const parallelism = readsBranchShape
    ? await readParallelism(path, walk, merges, inWindow, signal)
    : null

  return { sizeBucket, intervention, parallelism }
}

// Nothing landed in the window clears no share; it is nothing to read.
function mergesCarryTheDeliveries(merges: number, landedDirectly: number): boolean {
  const landings = merges + landedDirectly
  return landings > 0 && merges / landings >= MINIMUM_MERGE_SHARE
}

// SAFETY: Three answers, not two: `null` is a history that could not be read, and collapsing it
// into `false` publishes a harness set missing `prompts` — a practice gap nobody observed, where an
// UNKNOWN axis is honest. Read outside the shallow guard and the window, which can only hide a
// trailer, never fabricate one. A trailer is attribution, never authorship: it feeds the harness
// `prompts` capability alone, and answers whether the whole history holds one rather than which
// commit does, which is `readAutonomy`'s question and is bound by both the guard and the window.
//
// LIMITATION: No value below `AUTONOMOUS_INTERVENTION` is emitted anywhere in this file — a merge records
// that a branch landed, never what followed review, and no local history has it.
export async function hasAiAttributionTrailer(
  path: string,
  signal: AbortSignal,
): Promise<boolean | null> {
  const firstMatch = await readGit(
    path,
    [
      'log',
      '--max-count=1',
      '--format=%H',
      '--regexp-ignore-case',
      '--extended-regexp',
      ...AI_ATTRIBUTION_PATTERNS.map((pattern) => `--grep=${pattern}`),
      'HEAD',
    ],
    signal,
  )
  return firstMatch === null ? null : firstMatch.trim() !== ''
}

// INVARIANT: `git`'s answer, or `null` when `git` could not give one — an unborn HEAD, a corrupt
// ref, a subject that is not a repository. Each is a source that could not be read, and every
// caller turns that into an evidence gap. Cancellation is not one of them: it surfaces as a
// rejection the caller turns into `TIMED_OUT`, held here rather than at each call site, where no
// test could kill one rethrow of four.
async function readGit(
  path: string,
  args: readonly string[],
  signal: AbortSignal,
): Promise<string | null> {
  try {
    return await runGit(path, args, signal)
  } catch (error) {
    if (signal.aborted) throw error
    return null
  }
}

// SAFETY: What makes a `Co-Authored-By:` trailer attribution to an agent rather than to a person.
// The lists are closed by design: extending one is an edit to the evidence spec, never a runtime
// decision. A name is not an identity — `Claude Dupont`, `Codex Ltd` and `Jan Copilot` are a
// person, a company and a colleague — whereas an address at a vendor domain is, and so is a display
// name with no human name component left in it.
const AGENT_TOKENS = [
  'claude',
  'codex',
  'aider',
  'copilot',
  'cursor-agent',
  'cursoragent',
  'gemini-code-assist',
  'gemini',
  'devin',
  'cursor',
] as const

const KNOWN_AGENT_ADDRESSES = [
  'noreply@anthropic.com',
  'devin-ai-integration',
  'bot@cursor.sh',
] as const

const AGENT_WORDS = [
  'bot',
  '[bot]',
  'ai',
  'code',
  'assist',
  'agent',
  'assistant',
  'github',
  'google',
] as const

// LIMITATION: The closed list of domains at which an agent token is an agent. **Which address each
// tool actually writes is unverified here, for every entry.** Nothing offline establishes what
// Gemini, Cursor, Devin or any other agent puts in a trailer, and this project may not go and look.
// Every domain below, and every entry of `KNOWN_AGENT_ADDRESSES`, is a best reading of published
// convention and no more. Where one is wrong this rule under-reports, and the repair is to add the
// real address — never to loosen the rule back to a bare name, which is what let a person prove
// `prompts`.
const AGENT_DOMAINS = [
  'google.com',
  'cursor.sh',
  'cursor.com',
  'cognition.ai',
  'anthropic.com',
  'users.noreply.github.com',
] as const

const REGEX_METACHARACTER = /[\\^$.|?*+()[\]{}]/g

function asLiteral(text: string): string {
  return text.replace(REGEX_METACHARACTER, '\\$&')
}

const TRAILER_KEY = '^[ \t]*co-authored-by[ \t]*:'

// SAFETY: The three builders below return POSIX extended regular expressions, anchored at
// `TRAILER_KEY`, so an agent named in a message body or on another trailer proves nothing.

// SAFETY: A known agent address as a whole token: `[^a-z0-9]` on each side, so `aider` does not
// match inside `raider`, while adjacent punctuation still lands `<claude@…>`.
function trailerValueCarrying(identity: string): string {
  return `${TRAILER_KEY}(.*[^a-z0-9])?${asLiteral(identity)}([^a-z0-9].*)?$`
}

// SAFETY: An agent token as the whole local part of an address at a vendor domain. `[^a-z0-9._%+-]`
// before it excludes `notgemini@`, and `[^a-z0-9.-]` after the domain excludes
// `gemini@google.com.example.net`.
function trailerValueAddressedTo(token: string): string {
  const domains = AGENT_DOMAINS.map(asLiteral).join('|')
  return `${TRAILER_KEY}(.*[^a-z0-9._%+-])?${asLiteral(token)}@(${domains})([^a-z0-9.-].*)?$`
}

// SAFETY: A display name that is entirely agent components, glued as well as spaced, which is what
// lands `Copilot[bot]`. The sort is cosmetic: no test can tell the order from its absence.
function trailerValueNamedByAgentComponents(): string {
  const component = [...AGENT_TOKENS, ...AGENT_WORDS]
    .slice()
    .sort((left, right) => right.length - left.length)
    .map(asLiteral)
    .join('|')
  return `${TRAILER_KEY}[ \t]*((${component})[ \t]*)+(<[^<>]*>)?[ \t]*$`
}

const AI_ATTRIBUTION_PATTERNS: readonly string[] = [
  ...KNOWN_AGENT_ADDRESSES.map(trailerValueCarrying),
  ...AGENT_TOKENS.map(trailerValueAddressedTo),
  trailerValueNamedByAgentComponents(),
]

async function isShallowRepository(path: string, signal: AbortSignal): Promise<boolean> {
  const answer = await readGit(path, ['rev-parse', '--is-shallow-repository'], signal)
  return answer?.trim() === 'true'
}

async function readFirstParentWalk(
  path: string,
  signal: AbortSignal,
): Promise<readonly WalkCommit[] | null> {
  const stdout = await readGit(
    path,
    ['log', '--first-parent', `--format=%H${FIELD}%aI${FIELD}%P`, 'HEAD'],
    signal,
  )
  if (stdout === null) return null

  const commits: WalkCommit[] = []
  for (const record of stdout.split('\n')) {
    if (record.trim() === '') continue
    const [hash, authorDate, parents] = record.split(FIELD)
    if (hash === undefined || authorDate === undefined || parents === undefined) continue
    commits.push({
      hash,
      authorDate,
      parents: parents.split(' ').filter((parent) => parent !== ''),
    })
  }
  return commits
}

// INVARIANT: one `git` invocation for every delivered change, not one per change. `--no-walk` names
// the merges instead of traversing to them, and `--diff-merges=first-parent` gives each the same
// diff `git diff M^1 M` gives — the batch is a change of cost, never of reading. The chunk bound is
// argv, not git: a repository with thousands of merges in the window would otherwise build a command
// line the kernel refuses, and a refusal here is a whole axis lost.
const MERGES_PER_DIFF_INVOCATION = 500

async function readSizeBucket(
  path: string,
  deliveredChanges: readonly DeliveredChange[],
  signal: AbortSignal,
): Promise<SizeBucket | null> {
  if (deliveredChanges.length < MINIMUM_DELIVERED_CHANGES) return null

  const diffstats = new Map<string, Diffstat>()
  for (let from = 0; from < deliveredChanges.length; from += MERGES_PER_DIFF_INVOCATION) {
    const chunk = deliveredChanges.slice(from, from + MERGES_PER_DIFF_INVOCATION)
    const stdout = await runGit(
      path,
      [
        'log',
        '--no-walk',
        '--diff-merges=first-parent',
        '--no-ext-diff',
        '--no-textconv',
        '--numstat',
        `--format=${RECORD}%H`,
        ...chunk.map((merge) => merge.hash),
      ],
      signal,
    )
    for (const [hash, diffstat] of readDiffstatsByCommit(stdout)) diffstats.set(hash, diffstat)
  }

  const changedLines: number[] = []
  const changedFiles: number[] = []
  for (const merge of deliveredChanges) {
    // A merge git reported nothing for changed nothing, which is a delivered change of zero lines.
    const diffstat = diffstats.get(merge.hash) ?? { lines: 0, files: 0 }
    changedLines.push(diffstat.lines)
    changedFiles.push(diffstat.files)
  }

  return lowerBucket(bucketForLines(median(changedLines)), bucketForFiles(median(changedFiles)))
}

// Opens each commit's record. Never occurs in a hash, a numstat row or a path.
const RECORD = '\x1e'

interface Diffstat {
  readonly lines: number
  readonly files: number
}

function readDiffstatsByCommit(stdout: string): ReadonlyMap<string, Diffstat> {
  const byCommit = new Map<string, Diffstat>()

  for (const record of stdout.split(RECORD)) {
    const [header, ...rows] = record.split('\n')
    if (header === undefined) continue
    const hash = header.trim()
    if (hash === '') continue
    byCommit.set(hash, readDiffstat(rows.join('\n')))
  }

  return byCommit
}

// `added \t deleted \t path`. A binary file shows `-` for both: a changed file, zero lines.
const NUMSTAT_ROW = /^(\d+|-)\t(\d+|-)\t/

// Lines changed is additions *and* deletions: a change that removes 300 lines is not empty.
function readDiffstat(stdout: string): Diffstat {
  let lines = 0
  let files = 0
  for (const row of stdout.split('\n')) {
    const match = NUMSTAT_ROW.exec(row)
    if (match === null) continue
    files += 1
    const added = match[1]
    const deleted = match[2]
    if (added !== undefined && added !== '-') lines += Number(added)
    if (deleted !== undefined && deleted !== '-') lines += Number(deleted)
  }
  return { lines, files }
}

// INVARIANT: Every rank below `AUTONOMOUS_INTERVENTION` is withheld here on purpose, and `null` is
// the only other answer this function has. Those ranks separate *when* a human intervened relative
// to review, which no local Git object records, so emitting one would publish a practice gap nobody
// observed. This one is granted upward only, on positive evidence: a delivered change whose every
// commit is attributed to an agent held no human work at all — strictly more than the recorded
// "never edited after it was opened" the same value stands for, and so admissible on it.
//
// LIMITATION: An unattributed history is silent, never low. A repository whose agent writes no
// trailer is indistinguishable from one that uses no agent, and reading absence as human authorship
// is the fabrication this whole axis exists to avoid. Lifting that needs a source the tool does not
// have offline, which is the forge, and it belongs in a collector of its own.
async function readAutonomy(
  path: string,
  deliveredChanges: readonly DeliveredChange[],
  signal: AbortSignal,
): Promise<string | null> {
  if (deliveredChanges.length < MINIMUM_DELIVERED_CHANGES) return null

  const attributed = await readAgentAttributedCommits(path, signal)
  if (attributed === null) return null

  let zeroTouch = 0
  for (const merge of deliveredChanges) {
    if (await absorbedAgentWorkAlone(path, merge, attributed, signal)) zeroTouch += 1
  }

  const share = zeroTouch / deliveredChanges.length
  return share >= ZERO_TOUCH_SHARE_FOR_AUTONOMY ? AUTONOMOUS_INTERVENTION : null
}

// Every commit whose message carries an agent attribution trailer, in one walk rather than per side.
async function readAgentAttributedCommits(
  path: string,
  signal: AbortSignal,
): Promise<ReadonlySet<string> | null> {
  const stdout = await readGit(
    path,
    [
      'log',
      '--format=%H',
      '--regexp-ignore-case',
      '--extended-regexp',
      ...AI_ATTRIBUTION_PATTERNS.map((pattern) => `--grep=${pattern}`),
      'HEAD',
    ],
    signal,
  )
  if (stdout === null) return null

  return new Set(
    stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((hash) => hash !== ''),
  )
}

// SAFETY: A merge absorbing no commit is not one an agent authored — "every commit is attributed"
// is vacuously true of no commit at all, and a back-merged or rewritten history holds such merges.
// It still counts against the share rather than being dropped from it, because that withholds a
// level where dropping it would grant one, and only the first of those is recoverable.
async function absorbedAgentWorkAlone(
  path: string,
  merge: DeliveredChange,
  attributed: ReadonlySet<string>,
  signal: AbortSignal,
): Promise<boolean> {
  let absorbed = 0
  for (const side of mergeSideRevisions(merge)) {
    const stdout = await runGit(path, ['log', '--format=%H', ...side], signal)
    for (const line of stdout.split('\n')) {
      const hash = line.trim()
      if (hash === '') continue
      if (!attributed.has(hash)) return false
      absorbed += 1
    }
  }
  return absorbed > 0
}

// INVARIANT: One revision range per side a merge absorbed, `M^1..M^2` on the ordinary two-parent
// case. Every other parent is excluded, so an octopus merge's sides stay distinct instead of
// counting their shared commits under each of them.
function mergeSideRevisions(merge: DeliveredChange): readonly (readonly string[])[] {
  return merge.parents
    .slice(1)
    .map((side) => [
      side,
      ...merge.parents.filter((parent) => parent !== side).map((parent) => `^${parent}`),
    ])
}

// INVARIANT: The median number of distinct branches receiving a commit on an active day, over the
// same window as `size` — the median and not the peak, because a spike is not a habit. A reading is
// forced here: local Git records no branch for a commit, only the merge graph, so a branch is
// recovered as a *merge side*, `git rev-list M^1..M^2` for each merge M on the first-parent walk,
// the non-merge first-parent commits being the mainline. That is a fact about the recorded graph,
// not an inference about a workflow, and it rules out both counting a commit for every branch that
// can reach it, where the count means nothing, and reading local branch refs, which describe
// today's tips rather than the days measured.
async function readParallelism(
  path: string,
  walk: readonly WalkCommit[],
  merges: readonly DeliveredChange[],
  inWindow: (authorDate: string) => boolean,
  signal: AbortSignal,
): Promise<number | null> {
  const branchesByDay = new Map<string, Set<string>>()

  const record = (branch: string, authorDate: string): void => {
    if (!inWindow(authorDate)) return
    const day = calendarDay(authorDate)
    if (day === null) return
    const branches = branchesByDay.get(day) ?? new Set<string>()
    branches.add(branch)
    branchesByDay.set(day, branches)
  }

  for (const commit of walk) {
    // A merge is the day a branch landed, never a day the mainline was worked.
    if (isDeliveredChange(commit)) continue
    record('mainline', commit.authorDate)
  }

  // INVARIANT: Each side is its own revision range and cannot be batched into one invocation without
  // losing which side a commit came from, so the cost is bounded by running them a few at a time
  // rather than one at a time. The results are recorded in the order the sides were listed, never
  // the order they returned, so a report cannot depend on which spawn finished first. Which
  // revisions make a side is `mergeSideRevisions`, shared with the autonomy reading so the octopus
  // rule has one home.
  const sides = merges.flatMap((merge) =>
    mergeSideRevisions(merge).map((revisions, index) => ({
      branch: `${merge.hash}:${index + 1}`,
      revisions,
    })),
  )

  for (const dates of await inBoundedParallel(sides, (side) =>
    runGit(path, ['log', '--format=%aI', ...side.revisions], signal).then((stdout) => ({
      branch: side.branch,
      lines: stdout.split('\n'),
    })),
  )) {
    for (const line of dates.lines) {
      if (line.trim() === '') continue
      record(dates.branch, line.trim())
    }
  }

  if (branchesByDay.size < MINIMUM_ACTIVE_DAYS) return null
  return median([...branchesByDay.values()].map((branches) => branches.size))
}

// SAFETY: Enough spawns in flight to hide each one's startup cost, few enough that a repository with
// a thousand merge sides does not try to run a thousand `git` processes at once. Order is preserved,
// so the caller reads the same sequence it passed whatever order the work completed in.
const SPAWNS_IN_FLIGHT = 8

async function inBoundedParallel<Input, Output>(
  inputs: readonly Input[],
  run: (input: Input) => Promise<Output>,
): Promise<readonly Output[]> {
  const outputs: Output[] = []

  for (let from = 0; from < inputs.length; from += SPAWNS_IN_FLIGHT) {
    outputs.push(...(await Promise.all(inputs.slice(from, from + SPAWNS_IN_FLIGHT).map(run))))
  }

  return outputs
}

// INVARIANT: The author's own day, read from the `%aI` text rather than recomputed in the reader's
// timezone, so the same repository buckets identically wherever it is assessed.
function calendarDay(authorDate: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(authorDate.trim())
  return match?.[1] ?? null
}
