// INVARIANT: a `git` invocation asked and refused. Catching it means `UNKNOWN`, never that the
// repository lacks the practice it was asked about.
export class GitCommandFailedError extends Error {
  constructor(
    readonly args: readonly string[],
    readonly stderr: string,
  ) {
    super(`git ${args.join(' ')} failed: ${stderr.trim() || 'no stderr'}`)
    this.name = 'GitCommandFailedError'
  }
}
