import { runGit } from '../live-repository/git-process.js'

export interface RepositorySlug {
  readonly owner: string
  readonly name: string
}

// SAFETY: The forms `git remote get-url` reports for GitHub, and nothing else. A remote on another
// host, or none at all, yields `null` and the collector stays silent — which is an evidence gap and
// never a statement about the subject. The trailing `.git` is optional, and a `/` may end the path.
const GITHUB_REMOTE =
  /^(?:git@github\.com:|ssh:\/\/git@github\.com\/|https:\/\/(?:[^@/]*@)?github\.com\/)([^/]+)\/(.+?)(?:\.git)?\/?$/

// INVARIANT: `null` whenever the subject does not declare a GitHub origin, including when `git`
// itself refuses. Cancellation is the one thing that propagates: it is the caller's budget, not a
// missing remote.
export async function repositorySlug(
  path: string,
  signal: AbortSignal,
): Promise<RepositorySlug | null> {
  let url: string
  try {
    url = (await runGit(path, ['remote', 'get-url', 'origin'], signal)).trim()
  } catch (error) {
    if (signal.aborted) throw error
    return null
  }

  const match = GITHUB_REMOTE.exec(url)
  const owner = match?.[1]
  const name = match?.[2]
  if (owner === undefined || name === undefined || owner === '' || name === '') return null

  return { owner, name }
}
