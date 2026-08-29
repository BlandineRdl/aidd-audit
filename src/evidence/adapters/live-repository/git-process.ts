import { execFile } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import { GitCommandFailedError } from './git-command-failed.error.js'

/**
 * The one place `git` is spawned, so cancellation and the "unreadable source" distinction
 * are decided once. Nothing here interprets output.
 */

/** Part of `runGit`'s contract: catching it reads "the source refused", not "it said no". */
export { GitCommandFailedError }

/**
 * Git tells a child process which repository to act on through the environment, and those
 * variables win over the working directory. A hook sets them: run `pnpm check` from
 * `pre-commit` and every `git` spawned below would ignore its `cwd` and operate on the
 * repository being committed to — building fixtures in it, and committing them.
 *
 * So the subject is the working directory, always, and never whatever the ambient
 * environment names. The list is closed and location-scoped: it strips what points `git` at
 * a repository, and leaves configuration, credentials and identity alone.
 */
const GIT_LOCATION_VARIABLES = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_COMMON_DIR',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_NAMESPACE',
  'GIT_PREFIX',
] as const

/** `process.env` with every inherited pointer to another repository removed. */
export function gitEnvironment(additions: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const environment = { ...process.env, ...additions }
  for (const name of GIT_LOCATION_VARIABLES) delete environment[name]
  return environment
}

/**
 * Runs `git` inside `cwd` and resolves its stdout.
 *
 * `signal` reaches the child process, so an exceeded budget kills it rather than leaving it
 * running behind a resolved promise, and rejects with the signal's reason — never a silent
 * hang, never an empty successful run.
 *
 * Overflowing the raised `maxBuffer` rejects rather than truncates, which is what this
 * adapter wants: a truncated read would publish a confidently wrong median.
 */
export function runGit(cwd: string, args: readonly string[], signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    // Inside the executor: a promise-returning function that throws synchronously escapes
    // `.catch`. No test can hold this line — `execFile` refuses to spawn on a spent signal
    // and the branch below rejects with the same reason — so it states intent, nothing more.
    signal.throwIfAborted()

    execFile(
      'git',
      [...args],
      {
        cwd,
        signal,
        env: gitEnvironment(),
        maxBuffer: 64 * 1024 * 1024,
        encoding: 'utf8',
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve(stdout)
          return
        }

        if (signal.aborted) {
          reject(signal.reason)
          return
        }

        reject(new GitCommandFailedError(args, stderr))
      },
    )
  })
}

/**
 * Whether `path` is the root of a Git work tree, and not merely somewhere inside one.
 *
 * Both halves matter. Outside a work tree there is no tracked tree and no history. Inside
 * one but below the root, the subject is a directory of a repository rather than the
 * repository, and reading the enclosing checkout would attribute its evidence to whatever
 * the subject actually is.
 *
 * Compared through `realpath` on both sides, because `git` reports a resolved path and the
 * subject may arrive through a symlink — on macOS `/tmp` is one.
 */
export async function isRepositoryRoot(path: string, signal: AbortSignal): Promise<boolean> {
  let toplevel: string
  try {
    toplevel = (await runGit(path, ['rev-parse', '--show-toplevel'], signal)).trim()
  } catch (error) {
    if (error instanceof GitCommandFailedError) return false
    throw error
  }

  if (toplevel === '') return false

  try {
    return (await realpath(toplevel)) === (await realpath(path))
  } catch {
    return false
  }
}
