import { runGit } from '../live-repository/git-process.js'
import type { HarnessAuthorship } from '../../models/harness-authorship.model.js'

// INVARIANT: `harnessAuthorship` is a fact published beside a level and never inside one. This
// module produces no `Observation`, names no axis, no scale and no threshold, and reaches
// `resolveEvidence` through nothing — `harness-authorship.test.ts` asserts the import list that
// keeps it that way. It sits beside `harness-scan.ts`, never above or below it: this module imports
// nothing from there, and the two share nothing but a list of paths the caller passes from one to
// the other.

// Record separator, opening every commit's header, and the field separator inside it. Reused from `git-history.ts`'s own names, for the reason it names them: neither occurs in a hash, a date, an address or a path.
const RECORD = '\x1e'
const FIELD = '\x1f'

// LIMITATION: The bound is argv and not `git`: a repository whose harness proves itself through
// hundreds of files would otherwise build a command line the kernel refuses, and a refusal here
// loses the whole fact — mirroring `git-history.ts`'s `MERGES_PER_DIFF_INVOCATION`. **The value is
// chosen and not measured**, and no repository was consulted for it. Too high is a kernel refusal;
// too low is more spawns, each paying `git`'s startup cost. Unlike the sample floors in
// `delivery-sample.ts` it is not a threshold and neither direction changes a published number — it
// is not to be moved so that a given repository produces a tidier count.
const PROVING_PATHS_PER_LOG_INVOCATION = 500

interface AuthorshipRecord {
  readonly hash: string
  readonly authorDate: string
  readonly email: string
  readonly paths: readonly string[]
}

interface Accumulator {
  readonly commitHashes: Set<string>
  readonly filePaths: Set<string>
}

// INVARIANT: `windowStart` and `accountForEmail` are both parameters, computed nowhere in this
// file. The commit walk that anchors the roster already ended the window at the subject's most
// recent commit, and a second reading of that end would put two periods in one document; the
// forge's dictionary, built by the caller over its own walk, is the only identity authority this
// feature has, and normalising a second time here would be free to drift silently into the
// unattributed bucket. `null` is the unattributed bucket, on the same footing as
// `ContributorRecord.account` — a sentinel string would be a login-shaped value in a map of logins.
export async function readHarnessAuthorship(
  path: string,
  provingPaths: readonly string[],
  accountForEmail: (email: string) => string | null,
  windowStart: number,
  signal: AbortSignal,
): Promise<ReadonlyMap<string | null, HarnessAuthorship> | null> {
  signal.throwIfAborted()

  // There is nothing to author: no `git` is spawned for an empty proving set.
  if (provingPaths.length === 0) return new Map()

  const accumulators = new Map<string | null, Accumulator>()

  for (let from = 0; from < provingPaths.length; from += PROVING_PATHS_PER_LOG_INVOCATION) {
    const chunk = provingPaths.slice(from, from + PROVING_PATHS_PER_LOG_INVOCATION)

    // `runGit` covers a spawn already in flight; this check covers only the gap between two chunks.
    signal.throwIfAborted()

    let stdout: string
    try {
      stdout = await runGit(path, logArgsFor(chunk), signal)
    } catch (error) {
      // SAFETY: `null` is a walk that did not run — never `NO_HARNESS_AUTHORSHIP` from a `git` that
      // failed. Rethrow on an abort, `null` on any other refusal, on the pattern `git-history.ts`'s
      // `readGit` already holds. Publishing zeros from a refused walk would state that every account
      // wrote none of the harness on the strength of a read nobody completed; the caller turns this
      // `null` into a `FAILED` roster rather than a row of zeros.
      if (signal.aborted) throw error
      return null
    }

    for (const record of parseRecords(stdout)) {
      const instant = Date.parse(record.authorDate)
      // Filtered on the author date, `>= windowStart` and no upper bound — `HEAD` already caps the walk, and `--since` would filter the committer date instead.
      if (!Number.isFinite(instant) || instant < windowStart) continue

      // SAFETY: Read `%ae`, never `%aE`. `%aE` applies the assessed repository's own `.mailmap`,
      // which would let a file the subject's own author wrote decide which two people are one.
      const account = accountForEmail(record.email)
      const accumulator = accumulators.get(account) ?? {
        commitHashes: new Set<string>(),
        filePaths: new Set<string>(),
      }
      accumulator.commitHashes.add(record.hash)
      for (const provingPath of record.paths) accumulator.filePaths.add(provingPath)
      accumulators.set(account, accumulator)
    }
  }

  const authorship = new Map<string | null, HarnessAuthorship>()
  for (const [account, accumulator] of accumulators) {
    authorship.set(account, {
      files: accumulator.filePaths.size,
      commits: accumulator.commitHashes.size,
    })
  }
  return authorship
}

// SAFETY: `:(top,literal)` on every proving path. `literal` because a proving path containing `*`,
// `?` or `[` is a filename `harness-scan.ts` read off the tree, never a glob; `top` anchors the
// pathspec at the repository root whatever working directory `git` is given, which is the frame
// `git ls-files` reported the path in. `--name-only` still produces a diff, and the subject
// repository's own `.git/config` is in force for it: `runGit`'s hardened configuration disarms
// `core.fsmonitor` and `core.hooksPath` through config, but the diff family has no config
// counterpart — `--no-ext-diff` and `--no-textconv` are what keep this from running a program the
// assessed repository's own author chose.
//
// LIMITATION: Only what is reachable from `HEAD` is counted, so harness work sitting on an unmerged
// branch is invisible. `--full-history` is what keeps a commit that landed through a merged branch
// from being simplified away; its own cost is that a change later reverted still counts, which is
// what the column claims — a commit that touched the file. Authorship is also read on the path as
// it stands today, never followed through a rename: `git log --follow` takes one path at a time, so
// following would mean one spawn per proving path where one now answers for a whole chunk, and
// `--follow` is a similarity heuristic besides — the count would then depend on a rename-detection
// threshold nobody in this project chose. The cost: a harness file renamed inside the window loses
// every author it had under its old name, so the developer who wrote `CLAUDE.md` scores nothing and
// the developer who renamed it to `AGENTS.md` yesterday scores the file. What lifts this is the
// forge's own `history(path:)`, one query per path, which the plan already weighed and rejected for
// the same reason this walk stays local.
function logArgsFor(provingPaths: readonly string[]): readonly string[] {
  return [
    'log',
    '--full-history',
    '--no-merges',
    '--name-only',
    '-z',
    '--no-ext-diff',
    '--no-textconv',
    `--format=${RECORD}%H${FIELD}%aI${FIELD}%ae`,
    'HEAD',
    '--',
    ...provingPaths.map((provingPath) => `:(top,literal)${provingPath}`),
  ]
}

// SAFETY: `-z` is what makes this parse hold: without it a path outside ASCII is quoted and one
// containing a newline breaks the record. Each record opens with `RECORD`, so splitting on it first
// separates one commit from the next; within a record, `--name-only` still emits the blank line that
// separates a commit's format output from its file list, which `-z` leaves as a literal `\n` rather
// than folding it into the NUL stream — the first token after the header carries that leading `\n`
// and it is stripped here rather than left to read as an empty path.
function parseRecords(stdout: string): readonly AuthorshipRecord[] {
  const records: AuthorshipRecord[] = []

  for (const block of stdout.split(RECORD)) {
    if (block === '') continue

    const [header, ...rest] = block.split('\0')
    if (header === undefined) continue

    const [hash, authorDate, email] = header.split(FIELD)
    if (hash === undefined || authorDate === undefined || email === undefined) continue

    const paths = rest
      .map((token, index) => (index === 0 ? token.replace(/^\n/, '') : token))
      .filter((token) => token !== '')

    records.push({ hash, authorDate, email, paths })
  }

  return records
}
