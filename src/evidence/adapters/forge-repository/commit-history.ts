import { runGh } from './gh-process.js'
import type { RepositorySlug } from './repository-slug.js'
import { windowStartFrom } from '../delivery-sample.js'

// INVARIANT: Four git identities on the subject this was measured against — two name strings under
// two emails — all resolve to the login `BlandineRdl`, and neither name string matches that login.
// Keying on the identity publishes one person as four rows and joins to nothing; no local heuristic
// recovers the mapping, because it is GitHub's. Who exists is the key set of `commitsByAccount`, and
// is never published as a second list.
export interface CommitHistory {
  readonly commitsByAccount: ReadonlyMap<string | null, number>
  readonly accountByEmail: ReadonlyMap<string, string>
  // INVARIANT: The distinct addresses GitHub collapsed into one account — the field it feeds is
  // `ContributorRecord.emailAddresses`, named for the addresses it counts and not for identities,
  // because a field named after identities and counting addresses is what published 2 and 4 for one
  // measured subject. Derived here and never by counting `accountByEmail` entries: an email
  // resolving to two accounts is dropped from that dictionary by design, so a count taken there
  // would under-report silently. The unattributed bucket has no entry here — `null` is not an
  // account, and counting the addresses nothing could attribute would state something about a person
  // who was never named.
  readonly emailAddressesByAccount: ReadonlyMap<string, number>
}

// PAGE_SIZE is 100, verified at 783 commits of the measured subject coming back in eight pages.
const PAGE_SIZE = 100

// LIMITATION: The value is chosen, not measured — no distribution of commit counts per window was
// consulted. Too low, and a repository whose window genuinely holds more commits than the cap admits
// publishes no roster at all, an evidence gap where the work was there to be counted. Too high, and
// a subject with a runaway generated history spends round trips on pages whose only effect is to
// confirm the same accounts already seen. `since` already restricts the walk to the window, so the
// cap bites only on a repository committing more than `PAGE_SIZE * MAXIMUM_PAGES` times in the
// window. Not to be lowered so that a given repository classifies.
const MAXIMUM_PAGES = 20

const QUERY = `
query($owner: String!, $name: String!, $size: Int!, $since: GitTimestamp!, $after: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef { target { ... on Commit {
      history(first: $size, since: $since, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { authoredDate author { name email user { login } } }
      } } } }
  }
}`

interface RawCommit {
  readonly authoredDate: string
  readonly email: string | null
  readonly login: string | null
}

// INVARIANT: `null` is a read that did not happen, and is never a roster nobody is on. All five
// refusals below answer it — an unparseable page, a payload carrying no connection, the page cap
// reached with more offered, a missing window end, and a window end that is not a finite instant. A
// caller that treated `null` as an ordinary value would assemble zero records and publish a roster
// stating the window held nobody, derived from a walk nobody read; the caller owes `null` a `FAILED`
// status instead.
export async function readCommitHistory(
  slug: RepositorySlug,
  subjectActivityEnd: number | null,
  signal: AbortSignal,
): Promise<CommitHistory | null> {
  // LIMITATION: without the subject's most recent commit there is no window end, and a roster
  // anchored on the forge's own newest commit would measure a period no other number in the report
  // measures. A `subjectActivityEnd` that does not parse to a finite instant gives the same refusal:
  // every comparison against a window built from `NaN` is false, and the walk would answer an empty
  // window rather than an unread one.
  if (subjectActivityEnd === null || !Number.isFinite(subjectActivityEnd)) return null

  const windowStart = windowStartFrom(subjectActivityEnd)
  const commits = await readCommitPages(slug, new Date(windowStart).toISOString(), signal)
  if (commits === null) return null

  return buildCommitHistory(commits, windowStart, subjectActivityEnd)
}

// INVARIANT: `null` whenever the walk could not be completed — an unreadable page, a payload with no
// connection, or the page cap reached with more still offered. Rejects on a `gh` refusal and on an
// abort, exactly as the pull-request walk does: neither is caught here, so the caller sees the same
// distinction between "asked and refused" and "the budget ran out".
async function readCommitPages(
  slug: RepositorySlug,
  since: string,
  signal: AbortSignal,
): Promise<readonly RawCommit[] | null> {
  signal.throwIfAborted()

  const collected: RawCommit[] = []
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
      '-F',
      `since=${since}`,
      ...(cursor === null ? [] : ['-F', `after=${cursor}`]),
    ]

    const page = readPage(await runGh(args, signal))
    if (page === null) return null
    collected.push(...page.nodes)
    if (!page.hasNextPage || page.endCursor === null) return collected
    cursor = page.endCursor
  }

  // LIMITATION: the walk hit the page cap with the forge still offering more, so the window is
  // knowingly incomplete. Publishing a roster from it would describe part of the period as if it
  // were the whole, so nothing is published at all.
  return null
}

interface Page {
  readonly nodes: readonly RawCommit[]
  readonly hasNextPage: boolean
  readonly endCursor: string | null
}

// SAFETY: `null` is a page the forge answered with something this code cannot interpret, and it is
// distinct from a page that legitimately held nothing. A payload that parsed but carried no
// connection — `{"data":{"repository":null},"errors":[…]}`, which `gh` returns with exit 0 — must
// never become an empty page whose `hasNextPage: false` quietly ends the walk: `pull-request-history`
// already carries the scar of that exact failure, published once as a truncated window read as
// whole.
function readPage(stdout: string): Page | null {
  let document: unknown
  try {
    document = JSON.parse(stdout)
  } catch {
    return null
  }

  const connection = objectAt(
    objectAt(
      objectAt(objectAt(objectAt(document, 'data'), 'repository'), 'defaultBranchRef'),
      'target',
    ),
    'history',
  )
  const nodes = objectAt(connection, 'nodes')
  if (!Array.isArray(nodes)) return null

  const pageInfo = objectAt(connection, 'pageInfo')
  return {
    nodes: nodes.flatMap((node) => {
      const commit = readRawCommit(node)
      return commit === null ? [] : [commit]
    }),
    hasNextPage: objectAt(pageInfo, 'hasNextPage') === true,
    endCursor: stringAt(pageInfo, 'endCursor'),
  }
}

function readRawCommit(node: unknown): RawCommit | null {
  const authoredDate = stringAt(node, 'authoredDate')
  if (authoredDate === null) return null

  const author = objectAt(node, 'author')
  return {
    authoredDate,
    email: stringAt(author, 'email'),
    login: stringAt(objectAt(author, 'user'), 'login'),
  }
}

// SAFETY: bounded at both ends, even though `since` already bounds the query server-side. The upper
// bound matters because a default branch may carry commits the local checkout has not fetched, which
// are outside the period being measured rather than the newest thing in it; the lower bound is what
// makes the answer this module's own rather than the forge's.
function buildCommitHistory(
  commits: readonly RawCommit[],
  windowStart: number,
  windowEnd: number,
): CommitHistory {
  const commitsByAccount = new Map<string | null, number>()
  const emailsByAccount = new Map<string, Set<string>>()
  const accountsByEmail = new Map<string, Set<string>>()

  for (const commit of commits) {
    const instant = Date.parse(commit.authoredDate)
    if (!Number.isFinite(instant) || instant < windowStart || instant > windowEnd) continue

    // LIMITATION: a login ending in `[bot]` is dropped outright, from every count and the
    // dictionary. `GitActor.user` is typed `User`, so the `__typename === 'Bot'` route the
    // pull-request walk uses to type an author has no counterpart on a commit, and the suffix is the
    // only discriminator this query offers. GitHub reserves it for app accounts, so the rule is
    // sound in practice and unsound in principle: a human account whose login ends in `[bot]` is
    // wrongly dropped, and an app account not using the suffix is wrongly kept. Local work whose
    // email belongs to a dropped bot finds no dictionary entry and lands in the unattributed bucket
    // instead — a bot's work counted as nobody's, which is the right side to be wrong on.
    if (commit.login !== null && commit.login.endsWith('[bot]')) continue

    const account = commit.login
    commitsByAccount.set(account, (commitsByAccount.get(account) ?? 0) + 1)

    // INVARIANT: a commit whose author carries no account — `author.user` null, or `author` itself
    // null — is counted under the key `null` and never merged into a named account. Its email never
    // enters the dictionary: there is no account for that email to map to, and inventing one is the
    // guess this bucket exists to refuse. The bucket states what is observable — commits nothing
    // observable can attribute — and not a fact about a person.
    if (account === null || commit.email === null) continue

    const email = commit.email.toLowerCase()
    const accountsForEmail = accountsByEmail.get(email) ?? new Set<string>()
    accountsForEmail.add(account)
    accountsByEmail.set(email, accountsForEmail)

    const emailsForAccount = emailsByAccount.get(account) ?? new Set<string>()
    emailsForAccount.add(email)
    emailsByAccount.set(account, emailsForAccount)
  }

  const accountByEmail = new Map<string, string>()
  for (const [email, accounts] of accountsByEmail) {
    // INVARIANT: an email that resolves to more than one account is dropped from the dictionary, and
    // both accounts keep their commit counts and both keep that address in their address count. A
    // key meaning two people joins local work to whichever page came back first, which is neither
    // correct nor deterministic; dropping it sends that work to the unattributed bucket instead,
    // which is the conservative direction and the honest one.
    if (accounts.size !== 1) continue
    const [account] = accounts
    if (account !== undefined) accountByEmail.set(email, account)
  }

  const emailAddressesByAccount = new Map<string, number>()
  for (const [account, emails] of emailsByAccount) {
    emailAddressesByAccount.set(account, emails.size)
  }

  return { commitsByAccount, accountByEmail, emailAddressesByAccount }
}

function objectAt(document: unknown, key: string): unknown {
  if (typeof document !== 'object' || document === null) return null
  return (document as Record<string, unknown>)[key]
}

function stringAt(document: unknown, key: string): string | null {
  const value = objectAt(document, key)
  return typeof value === 'string' && value !== '' ? value : null
}
