import { mostRecentCommitDate } from '../live-repository/git-process.js'
import { readDeliveredChanges, type MergedPullRequest } from './pull-request-history.js'
import type { RepositorySlug } from './repository-slug.js'

// INVARIANT: One memoised walk of one slug's merged pull requests, over one window, shared by
// `ForgeRepositoryEvidenceCollector` and `ForgeContributorRosterAdapter` so a GitHub subject is
// walked once for its deliveries rather than twice. `read` takes only a signal because the slug and
// the subject path are fixed at construction — the composition root resolves both once and hands
// the same reader to both callers.
export interface ForgeDeliveryReader {
  read(signal: AbortSignal): Promise<readonly MergedPullRequest[] | null>
}

// INVARIANT: the window end is read lazily, on the first `read()`, rather than at construction. A
// caller that never calls `read()` — the collector, when the loaded model declares none of the axes
// it owns — spends no `git log` it would not otherwise have spent, on the same footing the
// collector already kept before this reader existed.
export function forgeDeliveryReader(
  slug: RepositorySlug,
  subjectPath: string,
): ForgeDeliveryReader {
  let memo: Promise<readonly MergedPullRequest[] | null> | undefined

  return {
    read(signal: AbortSignal): Promise<readonly MergedPullRequest[] | null> {
      memo ??= readDeliveredChangesFor(slug, subjectPath, signal)
      return memo
    },
  }
}

// INVARIANT: `subjectActivityEnd` is the subject's own most recent commit, not this source's newest
// merge, so this reader measures the same period `ForgeContributorRosterAdapter`'s own commit walk
// does — both anchor the window on the same fact about the subject.
async function readDeliveredChangesFor(
  slug: RepositorySlug,
  subjectPath: string,
  signal: AbortSignal,
): Promise<readonly MergedPullRequest[] | null> {
  const subjectActivityEnd = await mostRecentCommitDate(subjectPath, signal)
  return readDeliveredChanges(slug, subjectActivityEnd, signal)
}
