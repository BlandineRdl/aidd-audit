import { chmod, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readCommitHistory } from './commit-history.js'

// SAFETY: Integration against a stub `gh` on PATH, so the forge is the boundary under test and the
// suite never reaches it. The payloads are shaped like the GraphQL answer and copied from no real
// repository: the identity collapse is reproduced as its shape — two emails, two names, one login —
// and not as the subject's own addresses.

const A_LONG_TIME = 60_000
const SLUG = { owner: 'an-owner', name: 'a-repository' }
const DAY = (day: number): string => `2026-06-${String(day).padStart(2, '0')}T12:00:00Z`
const SUBJECT_ACTIVITY_END = Date.parse(DAY(30))

const workspaces: string[] = []
let restorePath: string | undefined

afterEach(async () => {
  if (restorePath !== undefined) process.env.PATH = restorePath
  restorePath = undefined
  await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

interface RecordedCommit {
  readonly authoredDate: string
  readonly name?: string
  readonly email?: string
  // `undefined` names the default account; `null` is a commit with no account at all.
  readonly login?: string | null
}

function commit(authoredDate: string, overrides: Partial<RecordedCommit> = {}): RecordedCommit {
  return {
    authoredDate,
    name: overrides.name ?? 'Someone',
    email: overrides.email ?? 'someone@example.com',
    login: overrides.login === undefined ? 'someone' : overrides.login,
  }
}

function page(nodes: readonly RecordedCommit[], endCursor: string | null): string {
  return JSON.stringify({
    data: {
      repository: {
        defaultBranchRef: {
          target: {
            history: {
              pageInfo: { hasNextPage: endCursor !== null, endCursor },
              nodes: nodes.map((node) => ({
                authoredDate: node.authoredDate,
                author: {
                  name: node.name,
                  email: node.email,
                  user: node.login === null ? null : { login: node.login },
                },
              })),
            },
          },
        },
      },
    },
  })
}

// INVARIANT: A `gh` that answers the nth invocation with the nth payload, and records each argument
// list in its own file. Invocations are counted by bytes in a tally file and never by lines in a
// shared log: the query itself spans several lines, so a line count reads one call as many.
async function ghAnswering(
  payloads: readonly string[],
  options: { readonly delayOnCall?: number; readonly delaySeconds?: number } = {},
): Promise<{ calls: () => Promise<string[]> }> {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'aidd-gh-commits-stub-'))
  workspaces.push(directory)

  const tally = join(directory, 'tally')
  for (const [index, payload] of payloads.entries()) {
    await writeFile(join(directory, `payload-${index}`), payload)
  }

  const script = [
    '#!/bin/sh',
    `printf 'x' >> "${tally}"`,
    `n=$(wc -c < "${tally}" | tr -d " ")`,
    `printf '%s' "$*" > "${directory}/call-$n"`,
    options.delayOnCall === undefined
      ? ''
      : `if [ "$n" -eq ${options.delayOnCall} ]; then sleep ${options.delaySeconds ?? 2}; fi`,
    `file="${directory}/payload-$((n - 1))"`,
    'if [ -f "$file" ]; then cat "$file"; else echo "no payload" >&2; exit 1; fi',
    '',
  ].join('\n')

  await writeFile(join(directory, 'gh'), script)
  await chmod(join(directory, 'gh'), 0o755)

  restorePath = process.env.PATH
  process.env.PATH = `${directory}:${process.env.PATH ?? ''}`

  return {
    async calls(): Promise<string[]> {
      const recorded: string[] = []
      for (let call = 1; ; call += 1) {
        try {
          recorded.push(await readFile(join(directory, `call-${call}`), 'utf8'))
        } catch {
          return recorded
        }
      }
    },
  }
}

describe('readCommitHistory', () => {
  it(
    'counts one entry per account, and leaves a commit outside the window out of every count',
    async () => {
      await ghAnswering([
        page(
          [
            ...[1, 2, 3].map((day) => commit(DAY(day), { login: 'perceval' })),
            ...[4, 5].map((day) => commit(DAY(day), { login: 'karadoc' })),
            commit('2024-01-01T12:00:00Z', { login: 'perceval' }),
          ],
          null,
        ),
      ])

      const history = await readCommitHistory(
        SLUG,
        SUBJECT_ACTIVITY_END,
        new AbortController().signal,
      )

      expect(history?.commitsByAccount.get('perceval')).toBe(3)
      expect(history?.commitsByAccount.get('karadoc')).toBe(2)
    },
    A_LONG_TIME,
  )

  it(
    'follows the cursor rather than reading the first page alone',
    async () => {
      const stub = await ghAnswering([
        page([commit(DAY(1), { login: 'perceval' })], 'CURSOR'),
        page([commit(DAY(2), { login: 'perceval' })], null),
      ])

      const history = await readCommitHistory(
        SLUG,
        SUBJECT_ACTIVITY_END,
        new AbortController().signal,
      )

      expect(history?.commitsByAccount.get('perceval')).toBe(2)
      const calls = await stub.calls()
      expect(calls).toHaveLength(2)
      expect(calls[1]).toContain('after=CURSOR')
    },
    A_LONG_TIME,
  )

  it(
    'collapses two emails and two names under one login into one entry',
    async () => {
      await ghAnswering([
        page(
          [
            commit(DAY(1), { login: 'BlandineRdl', name: 'Black Sun', email: 'black@example.com' }),
            commit(DAY(2), { login: 'BlandineRdl', name: 'BlackSun', email: 'sun@example.com' }),
          ],
          null,
        ),
      ])

      const history = await readCommitHistory(
        SLUG,
        SUBJECT_ACTIVITY_END,
        new AbortController().signal,
      )

      // INVARIANT: neither name string matches the login, and the row is still one — the collapse is
      // GitHub's account, never the commit's own identity strings.
      expect(history?.commitsByAccount.get('BlandineRdl')).toBe(2)
      expect(history?.accountByEmail.get('black@example.com')).toBe('BlandineRdl')
      expect(history?.accountByEmail.get('sun@example.com')).toBe('BlandineRdl')
      expect(history?.emailAddressesByAccount.get('BlandineRdl')).toBe(2)
    },
    A_LONG_TIME,
  )

  it(
    'lands a commit with no account in the unattributed bucket, merged into nobody',
    async () => {
      await ghAnswering([
        page(
          [
            commit(DAY(1), { login: 'perceval' }),
            commit(DAY(2), { login: null, email: 'ghost@example.com' }),
          ],
          null,
        ),
      ])

      const history = await readCommitHistory(
        SLUG,
        SUBJECT_ACTIVITY_END,
        new AbortController().signal,
      )

      expect(history?.commitsByAccount.get(null)).toBe(1)
      expect([...(history?.commitsByAccount.keys() ?? [])]).not.toContain('ghost@example.com')
      expect(history?.accountByEmail.get('ghost@example.com')).toBeUndefined()
    },
    A_LONG_TIME,
  )

  it(
    'drops a bot login from every count and the dictionary',
    async () => {
      await ghAnswering([
        page(
          [
            commit(DAY(1), { login: 'perceval' }),
            commit(DAY(2), {
              login: 'dependabot[bot]',
              email: 'dependabot@example.com',
            }),
          ],
          null,
        ),
      ])

      const history = await readCommitHistory(
        SLUG,
        SUBJECT_ACTIVITY_END,
        new AbortController().signal,
      )

      expect([...(history?.commitsByAccount.keys() ?? [])]).not.toContain('dependabot[bot]')
      expect(history?.accountByEmail.get('dependabot@example.com')).toBeUndefined()
      // INVARIANT: the exclusion is total — a dropped bot's commit is not even counted as
      // unattributed, so the null bucket does not silently absorb its work either.
      expect(history?.commitsByAccount.get(null)).toBeUndefined()
    },
    A_LONG_TIME,
  )

  it(
    'drops an email resolving to two accounts from the dictionary, and keeps both rows',
    async () => {
      await ghAnswering([
        page(
          [
            commit(DAY(1), { login: 'perceval', email: 'shared@example.com' }),
            commit(DAY(2), { login: 'karadoc', email: 'shared@example.com' }),
          ],
          null,
        ),
      ])

      const history = await readCommitHistory(
        SLUG,
        SUBJECT_ACTIVITY_END,
        new AbortController().signal,
      )

      expect(history?.accountByEmail.get('shared@example.com')).toBeUndefined()
      expect(history?.commitsByAccount.get('perceval')).toBe(1)
      expect(history?.commitsByAccount.get('karadoc')).toBe(1)
      expect(history?.emailAddressesByAccount.get('perceval')).toBe(1)
      expect(history?.emailAddressesByAccount.get('karadoc')).toBe(1)
    },
    A_LONG_TIME,
  )

  it(
    'answers null when the page cap is reached with more still offered',
    async () => {
      const pages = Array.from({ length: 25 }, (_, index) =>
        page([commit(DAY(1), { login: 'perceval' })], `CURSOR-${index}`),
      )
      await ghAnswering(pages)

      await expect(
        readCommitHistory(SLUG, SUBJECT_ACTIVITY_END, new AbortController().signal),
      ).resolves.toBeNull()
    },
    A_LONG_TIME,
  )

  it(
    'answers null rather than the pages that did arrive when a page does not parse',
    async () => {
      await ghAnswering(['not json'])

      await expect(
        readCommitHistory(SLUG, SUBJECT_ACTIVITY_END, new AbortController().signal),
      ).resolves.toBeNull()
    },
    A_LONG_TIME,
  )

  it(
    'answers null rather than an empty walk when the payload carries no connection',
    async () => {
      await ghAnswering(['{"data":{"repository":null},"errors":[{"type":"NOT_FOUND"}]}'])

      await expect(
        readCommitHistory(SLUG, SUBJECT_ACTIVITY_END, new AbortController().signal),
      ).resolves.toBeNull()
    },
    A_LONG_TIME,
  )

  it(
    'answers null rather than a second period when the subject has no window end',
    async () => {
      await expect(readCommitHistory(SLUG, null, new AbortController().signal)).resolves.toBeNull()
    },
    A_LONG_TIME,
  )

  it(
    'answers null rather than a window of unknown length when the window end is not an instant',
    async () => {
      await expect(
        readCommitHistory(SLUG, Number.NaN, new AbortController().signal),
      ).resolves.toBeNull()
    },
    A_LONG_TIME,
  )

  it(
    'rejects rather than resolving when the signal is already aborted',
    async () => {
      await ghAnswering([page([], null)])

      await expect(
        readCommitHistory(SLUG, SUBJECT_ACTIVITY_END, AbortSignal.abort()),
      ).rejects.toThrow(/abort/i)
    },
    A_LONG_TIME,
  )

  it(
    'rejects rather than resolving a partial dictionary when the budget expires between two pages',
    async () => {
      await ghAnswering(
        [page([commit(DAY(1), { login: 'perceval' })], 'CURSOR'), page([commit(DAY(2))], null)],
        { delayOnCall: 2, delaySeconds: 2 },
      )

      const controller = new AbortController()
      const result = readCommitHistory(SLUG, SUBJECT_ACTIVITY_END, controller.signal)
      setTimeout(() => controller.abort(), 200)

      await expect(result).rejects.toThrow()
    },
    A_LONG_TIME,
  )

  it(
    'rejects rather than resolving when the forge refuses',
    async () => {
      await ghAnswering([])

      await expect(
        readCommitHistory(SLUG, SUBJECT_ACTIVITY_END, new AbortController().signal),
      ).rejects.toThrow(/gh api graphql/)
    },
    A_LONG_TIME,
  )
})
