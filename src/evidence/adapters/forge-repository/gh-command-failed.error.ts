// INVARIANT: a `gh` invocation asked and refused. Catching it means `UNKNOWN`, never that the
// repository lacks the practice it was asked about. It covers every way the forge can decline: the
// binary absent, no credentials, a revoked token, a rate limit, a repository that is not visible.
export class GhCommandFailedError extends Error {
  constructor(
    readonly args: readonly string[],
    readonly stderr: string,
  ) {
    super(`gh ${args.join(' ')} failed: ${stderr.trim() || 'no stderr'}`)
    this.name = 'GhCommandFailedError'
  }
}
