import { execFile } from 'node:child_process'
import { GhCommandFailedError } from './gh-command-failed.error.js'

// The one place `gh` is spawned; nothing here interprets output.

// Part of `runGh`'s contract: catching it reads "the forge refused", not "it said no".
export { GhCommandFailedError }

// SAFETY: `signal` reaches the child, so an exceeded budget kills it rather than leaving an HTTP
// call outstanding behind a resolved promise. This is the collector that made a real budget
// necessary: a local `git` returns or fails, a network round trip can hang until something stops
// it. Overflowing `maxBuffer` rejects rather than truncates, because a truncated page of pull
// requests would publish a median computed from part of the window.
export function runGh(args: readonly string[], signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()

    execFile(
      'gh',
      [...args],
      {
        signal,
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

        reject(new GhCommandFailedError(args, stderr))
      },
    )
  })
}
