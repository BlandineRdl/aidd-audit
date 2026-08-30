import { chmod, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GhCommandFailedError, runGh } from './gh-process.js'

// Integration against a stub `gh` on PATH: the spawn is the boundary under test.

const NEVER_ABORTED = new AbortController().signal
const A_LONG_TIME = 15_000

const workspaces: string[] = []
let restorePath: string | undefined

afterEach(async () => {
  if (restorePath !== undefined) process.env.PATH = restorePath
  restorePath = undefined
  await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function ghRunning(script: string): Promise<void> {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'aidd-gh-process-'))
  workspaces.push(directory)
  await writeFile(join(directory, 'gh'), `#!/bin/sh\n${script}\n`)
  await chmod(join(directory, 'gh'), 0o755)

  restorePath = process.env.PATH
  process.env.PATH = `${directory}:${process.env.PATH ?? ''}`
}

describe('runGh', () => {
  it(
    'hands back what the forge wrote, untouched',
    async () => {
      await ghRunning('printf \'{"data":1}\'')

      await expect(runGh(['api', 'graphql'], NEVER_ABORTED)).resolves.toBe('{"data":1}')
    },
    A_LONG_TIME,
  )

  it(
    'names the command and the stderr when the forge refuses',
    async () => {
      await ghRunning('echo "HTTP 403: rate limit exceeded" >&2\nexit 1')

      // INVARIANT: a rejection test pins the error class *and* a fragment of the message. Without
      // the fragment it would pass for any throw at all, the TypeError from a missing guard
      // included.
      const refused = runGh(['api', 'graphql', '-f', 'query=x'], NEVER_ABORTED)
      await expect(refused).rejects.toBeInstanceOf(GhCommandFailedError)
      await expect(refused).rejects.toThrow(/rate limit exceeded/)
      await expect(refused).rejects.toThrow(/api graphql/)
    },
    A_LONG_TIME,
  )

  it(
    'still names the failure when the forge says nothing at all',
    async () => {
      await ghRunning('exit 4')

      // INVARIANT: this message is what `provenance` publishes as the reason a source refused, so a
      // silent non-zero exit must still carry the spawn's own account of it rather than the
      // placeholder every empty-stderr failure would otherwise share.
      const refused = runGh(['api'], NEVER_ABORTED)
      await expect(refused).rejects.toThrow(/gh api failed/)
      await expect(refused).rejects.not.toThrow(/no stderr/)
    },
    A_LONG_TIME,
  )

  it(
    'rejects rather than resolving when the budget is already spent',
    async () => {
      await ghRunning("printf '{}'")

      await expect(runGh(['api'], AbortSignal.abort())).rejects.toThrow(/abort/i)
    },
    A_LONG_TIME,
  )

  it(
    'kills a round trip still in flight when the budget expires, rather than hanging on it',
    async () => {
      // SAFETY: this is the failure a local `git` cannot produce and the forge can. The stub never
      // returns, so a spawn that ignored the signal would hang the suite rather than fail it.
      await ghRunning('while :; do sleep 0.05; done')

      const budget = new AbortController()
      const inFlight = runGh(['api', 'graphql'], budget.signal)
      setTimeout(() => budget.abort(new Error('budget spent')), 50)

      await expect(inFlight).rejects.toThrow(/budget spent/)
    },
    A_LONG_TIME,
  )

  it(
    'rejects rather than truncating when the answer overflows the buffer',
    async () => {
      // SAFETY: a truncated page of pull requests would publish a median computed from part of the
      // window, which reads exactly like a smaller repository.
      await ghRunning('head -c 1024 /dev/zero | tr "\\0" "x"')

      // INVARIANT: the class and a fragment, never a bare `toThrow()` — that would pass for any
      // rejection at all, the stub failing to find `tr` included.
      const overflowing = runGh(['api'], NEVER_ABORTED, 128)
      await expect(overflowing).rejects.toBeInstanceOf(GhCommandFailedError)
      await expect(overflowing).rejects.toThrow(/maxBuffer/i)
    },
    A_LONG_TIME,
  )
})
