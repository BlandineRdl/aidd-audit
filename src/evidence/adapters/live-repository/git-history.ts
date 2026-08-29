import { runGit } from './git-process.js'
import { bucketForFiles, bucketForLines, lowerBucket, type SizeBucket } from '../size-buckets.js'

/** The 180 days ending at the most recent commit, never wall-clock now: the same repository
 *  must not report two different levels on two different days. **The length is chosen, not
 *  measured**, on the same footing as the sample floors below: long enough that two quarters of
 *  ordinary delivery fall inside it, short enough that a practice abandoned a year ago stops
 *  counting. Nothing observed here establishes 180 over 90 or 365. */
const WINDOW_DAYS = 180
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

/** A sample is not a habit: below these counts a median describes an accident, and this
 *  collector emits nothing rather than publish it. That much follows from the conservative rule.
 *
 *  **The number 5 is chosen, not measured, and nothing in this project establishes it.** No
 *  distribution of delivered changes was consulted, and the four reference profiles cannot
 *  stand in for one: they are fixture bundles, and a bundle publishes pre-aggregated medians
 *  without the counts behind them, so they never cross this floor at all.
 *
 *  What is known is the shape of the cost on each side, and it is asymmetric. Too low, and a
 *  fortnight of unusual weeks is published as a habit — a wrong level, stated confidently, on a
 *  repository no offline reader can contradict. Too high, and a small but genuine practice stays
 *  UNKNOWN — an evidence gap, which the report names as one and which may never be read as a
 *  practice gap. Withholding a level is recoverable; inventing one is not. That asymmetry is the
 *  whole argument for 5 over 3, and it is an argument about direction, not about the value.
 *
 *  **Not to be lowered so that a given repository classifies.** That is fitting the measure to
 *  the result one hoped for, and this repository — 3 merges over 3 active days as this is
 *  written — is precisely the case that invites it. Move either number only from an observed
 *  distribution across real repositories, which needs a corpus this project does not have and
 *  is post-MVP. Until then the floor stands and the history accumulates.
 *
 *  Either number changes what `assess` reports about every repository, so it is a product
 *  decision, never a tuning knob. */
const MINIMUM_DELIVERED_CHANGES = 5
const MINIMUM_ACTIVE_DAYS = 5

/** Field separator inside one `git log` record. Never occurs in a hash, date or parent list. */
const FIELD = '\x1f'

export interface GitDerivedMetrics {
  readonly sizeBucket: string | null
  readonly parallelism: number | null
}

/** Nothing was recoverable: an evidence gap, never a measurement of zero. */
const UNRECOVERABLE: GitDerivedMetrics = { sizeBucket: null, parallelism: null }

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

/** Nulls whenever the history is not recoverable — shallow, unborn, without a merge, or too
 *  small a sample. Rejects on an abort, and on the `git diff` a partial clone whose origin is
 *  unreachable fails outright. */
export async function readGitDerivedMetrics(
  path: string,
  signal: AbortSignal,
): Promise<GitDerivedMetrics> {
  // A truncation looks ordinary: the most recent commit is still the most recent, and a deep
  // enough one clears the minimum sample and publishes a confidently wrong median.
  if (await isShallowRepository(path, signal)) return UNRECOVERABLE

  // An unborn HEAD makes `git log` exit fatal. Unreadable is not empty.
  const walk = await readFirstParentWalk(path, signal)
  if (walk === null) return UNRECOVERABLE

  // A delivered change is one merge commit, and no merge leaves nothing recoverable: a squash
  // history and a rebase history are indistinguishable afterwards and demand opposite
  // readings, so guessing low here would publish a practice gap nobody observed.
  const merges = walk.filter(isDeliveredChange)
  if (merges.length === 0) return UNRECOVERABLE

  const windowEnd = await readMostRecentCommitDate(path, signal)
  if (windowEnd === null) return UNRECOVERABLE
  const windowStart = windowEnd - WINDOW_DAYS * MILLISECONDS_PER_DAY
  const inWindow = (authorDate: string): boolean => {
    const instant = Date.parse(authorDate)
    return Number.isFinite(instant) && instant >= windowStart
  }

  const sizeBucket = await readSizeBucket(
    path,
    merges.filter((merge) => inWindow(merge.authorDate)),
    signal,
  )

  const parallelism = await readParallelism(path, walk, merges, inWindow, signal)

  return { sizeBucket, parallelism }
}

/** Three answers, not two: `null` is a history that could not be read, and collapsing it into
 *  `false` publishes a harness set missing `prompts` — a practice gap nobody observed, where an
 *  UNKNOWN axis is honest. Read outside the shallow guard and the window, which can only hide a
 *  trailer, never fabricate one. A trailer is attribution, never authorship: it feeds the
 *  harness `prompts` capability alone. No `intervention` value is emitted anywhere here — a
 *  merge records that a branch landed, never what followed review, and no local history has it. */
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

/** `git`'s answer, or `null` when `git` could not give one — an unborn HEAD, a corrupt ref, a
 *  subject that is not a repository. Each is a source that could not be read, and every caller
 *  turns that into an evidence gap. Cancellation is not one of them: it surfaces as a rejection
 *  the caller turns into `TIMED_OUT`, held here rather than at each call site, where no test
 *  could kill one rethrow of four. */
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

/** What makes a `Co-Authored-By:` trailer attribution to an agent rather than to a person. The
 *  lists are closed by design: extending one is an edit to the evidence spec, never a runtime
 *  decision. A name is not an identity — `Claude Dupont`, `Codex Ltd` and `Jan Copilot` are a
 *  person, a company and a colleague — whereas an address at a vendor domain is, and so is a
 *  display name with no human name component left in it. */
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

/** The closed list of domains at which an agent token is an agent.
 *  **Which address each tool actually writes is unverified here, for every entry.** Nothing
 *  offline establishes what Gemini, Cursor, Devin or any other agent puts in a trailer, and
 *  this project may not go and look. Every domain below, and every entry of
 *  `KNOWN_AGENT_ADDRESSES`, is a best reading of published convention and no more. Where one
 *  is wrong this rule under-reports, and the repair is to add the real address — never to
 *  loosen the rule back to a bare name, which is what let a person prove `prompts`. */
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

/** The three builders below return POSIX extended regular expressions, anchored at
 *  `TRAILER_KEY`, so an agent named in a message body or on another trailer proves nothing. */

/** A known agent address as a whole token: `[^a-z0-9]` on each side, so `aider` does not match
 *  inside `raider`, while adjacent punctuation still lands `<claude@…>`. */
function trailerValueCarrying(identity: string): string {
  return `${TRAILER_KEY}(.*[^a-z0-9])?${asLiteral(identity)}([^a-z0-9].*)?$`
}

/** An agent token as the whole local part of an address at a vendor domain. `[^a-z0-9._%+-]`
 *  before it excludes `notgemini@`, and `[^a-z0-9.-]` after the domain excludes
 *  `gemini@google.com.example.net`. */
function trailerValueAddressedTo(token: string): string {
  const domains = AGENT_DOMAINS.map(asLiteral).join('|')
  return `${TRAILER_KEY}(.*[^a-z0-9._%+-])?${asLiteral(token)}@(${domains})([^a-z0-9.-].*)?$`
}

/** A display name that is entirely agent components, glued as well as spaced, which is what
 *  lands `Copilot[bot]`. The sort is cosmetic: no test can tell the order from its absence. */
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

/** Taken over everything reachable from HEAD rather than at HEAD's own date, so a merge
 *  landing an older branch cannot move the end of the window backwards. */
async function readMostRecentCommitDate(path: string, signal: AbortSignal): Promise<number | null> {
  const stdout = await readGit(path, ['log', '--format=%aI', 'HEAD'], signal)
  if (stdout === null) return null

  let mostRecent: number | null = null
  for (const line of stdout.split('\n')) {
    if (line.trim() === '') continue
    const instant = Date.parse(line.trim())
    if (!Number.isFinite(instant)) continue
    if (mostRecent === null || instant > mostRecent) mostRecent = instant
  }
  return mostRecent
}

async function readSizeBucket(
  path: string,
  deliveredChanges: readonly DeliveredChange[],
  signal: AbortSignal,
): Promise<SizeBucket | null> {
  if (deliveredChanges.length < MINIMUM_DELIVERED_CHANGES) return null

  const changedLines: number[] = []
  const changedFiles: number[] = []
  for (const merge of deliveredChanges) {
    const diffstat = readDiffstat(
      await runGit(path, ['diff', '--numstat', merge.parents[0], merge.hash], signal),
    )
    changedLines.push(diffstat.lines)
    changedFiles.push(diffstat.files)
  }

  return lowerBucket(bucketForLines(median(changedLines)), bucketForFiles(median(changedFiles)))
}

/** `added \t deleted \t path`. A binary file shows `-` for both: a changed file, zero lines. */
const NUMSTAT_ROW = /^(\d+|-)\t(\d+|-)\t/

/** Lines changed is additions *and* deletions: a change that removes 300 lines is not empty. */
function readDiffstat(stdout: string): { lines: number; files: number } {
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

/** The median number of distinct branches receiving a commit on an active day, over the same
 *  window as `size` — the median and not the peak, because a spike is not a habit.
 *  A reading is forced here: local Git records no branch for a commit, only the merge graph, so
 *  a branch is recovered as a *merge side*, `git rev-list M^1..M^2` for each merge M on the
 *  first-parent walk, the non-merge first-parent commits being the mainline. That is a fact
 *  about the recorded graph, not an inference about a workflow, and it rules out both counting a
 *  commit for every branch that can reach it, where the count means nothing, and reading local
 *  branch refs, which describe today's tips rather than the days measured. */
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

  for (const merge of merges) {
    const absorbed = merge.parents.slice(1)
    for (const [index, side] of absorbed.entries()) {
      // Every other parent is excluded, so an octopus merge's sides stay distinct branches
      // instead of counting their shared commits twice. With two parents this is `M^1..M^2`.
      const excluded = merge.parents.filter((parent) => parent !== side)
      const stdout = await runGit(
        path,
        ['log', '--format=%aI', side, ...excluded.map((parent) => `^${parent}`)],
        signal,
      )
      const branch = `${merge.hash}:${index + 1}`
      for (const line of stdout.split('\n')) {
        if (line.trim() === '') continue
        record(branch, line.trim())
      }
    }
  }

  if (branchesByDay.size < MINIMUM_ACTIVE_DAYS) return null
  return median([...branchesByDay.values()].map((branches) => branches.size))
}

/** The author's own day, read from the `%aI` text rather than recomputed in the reader's
 *  timezone, so the same repository buckets identically wherever it is assessed. */
function calendarDay(authorDate: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(authorDate.trim())
  return match?.[1] ?? null
}

/** Callers guarantee a non-empty sample; an even count yields a half-integer median. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle] ?? 0
  if (sorted.length % 2 === 1) return upper
  return ((sorted[middle - 1] ?? 0) + upper) / 2
}
