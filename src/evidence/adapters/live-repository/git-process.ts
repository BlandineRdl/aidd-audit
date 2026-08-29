import { execFile } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import { GitCommandFailedError } from './git-command-failed.error.js'

// The one place `git` is spawned; nothing here interprets output.

// Part of `runGit`'s contract: catching it reads "the source refused", not "it said no".
export { GitCommandFailedError }

// SAFETY: `process.env` is inherited, and three families of Git variable in it redirect this
// process's work. **Location**: they win over the working directory — a hook sets them, so running
// `pnpm check` from `pre-commit` would make every `git` below ignore its `cwd` and build fixtures in
// the repository being committed to. **Configuration**: `GIT_CONFIG_COUNT` and its pairs inject
// arbitrary config, which subsumes the first family and reaches the command keys below.
// **Command**: each one names a program `git` will execute. The list is closed, and it deliberately
// leaves author and committer identity alone — nothing here writes, and stripping identity would
// change whose name a future write carries. The subject is the working directory, always.
const REDIRECTING_GIT_VARIABLES = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_COMMON_DIR',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_NAMESPACE',
  'GIT_PREFIX',
  'GIT_CEILING_DIRECTORIES',
  'GIT_DISCOVERY_ACROSS_FILESYSTEM',
  'GIT_CONFIG',
  'GIT_CONFIG_COUNT',
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_SYSTEM',
  'GIT_EXTERNAL_DIFF',
  'GIT_SSH',
  'GIT_SSH_COMMAND',
  'GIT_ASKPASS',
  'GIT_PAGER',
  'GIT_EDITOR',
  'GIT_SEQUENCE_EDITOR',
] as const

// `process.env` with every inherited redirection removed.
export function gitEnvironment(additions: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const environment = { ...process.env, ...additions }
  for (const name of REDIRECTING_GIT_VARIABLES) delete environment[name]
  return environment
}

// SAFETY: The subject repository's own `.git/config` is in force for every command below, and it is
// not this project's config: several standard keys name a program `git` then runs — `core.fsmonitor`
// on any command that reads the index, `core.hooksPath` for hooks. A config does not survive a
// clone, so the exposure is a repository received as a directory: a tarball, a shared mount, a
// recorded bundle. Assessing one must never run what its author chose. Pinned here rather than at
// each call site so a new command cannot forget it. The `diff` family is disarmed on the invocation
// that produces a diff, since `--no-ext-diff` and `--no-textconv` have no config counterpart.
const HARDENED_CONFIGURATION = [
  '-c',
  'core.fsmonitor=false',
  '-c',
  'core.hooksPath=/dev/null',
] as const

// SAFETY: `signal` reaches the child, so an exceeded budget kills it rather than leaving it running
// behind a resolved promise — never a silent hang, never an empty successful run. Overflowing
// `maxBuffer` rejects rather than truncates: a truncated read would publish a confidently wrong
// median.
export function runGit(cwd: string, args: readonly string[], signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    // SAFETY: inside the executor, a promise-returning function that throws synchronously escapes
    // `.catch`. No test can hold this line — `execFile` refuses to spawn on a spent signal and the
    // branch below rejects with the same reason — so it states intent, nothing more.
    signal.throwIfAborted()

    execFile(
      'git',
      [...HARDENED_CONFIGURATION, ...args],
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

// SAFETY: both halves matter. Outside a work tree there is no tracked tree and no history; inside
// one but below the root, reading the enclosing checkout would attribute that repository's evidence
// to a directory that is a different subject.

// COMPAT: compared through `realpath` on both sides — `git` reports a resolved path and the subject
// may arrive through a symlink, as `/tmp` is on macOS.
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
