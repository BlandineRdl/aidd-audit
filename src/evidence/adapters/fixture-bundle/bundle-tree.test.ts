import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { bundleTree } from './bundle-tree.js'

let bundles: string[] = []

afterEach(() => {
  for (const bundle of bundles) rmSync(bundle, { recursive: true, force: true })
  bundles = []
})

function bundleHolding(files: readonly string[]): string {
  const path = mkdtempSync(join(tmpdir(), 'aidd-tree-'))
  bundles.push(path)

  for (const name of files) {
    const absolute = join(path, name)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, `content of ${name}\n`)
  }

  return path
}

const unbounded = new AbortController().signal

async function pathsOf(bundle: string): Promise<readonly string[]> {
  return (await (await bundleTree(bundle, unbounded)).entries()).map((entry) => entry.path)
}

describe('the tree a bundle recorded', () => {
  it('reports a path under the recorded root without that root', async () => {
    const path = bundleHolding(['repo-context/docs/context/architecture.md'])

    expect(await pathsOf(path)).toEqual(['docs/context/architecture.md'])
  })

  it('leaves a path outside the recorded root as the bundle files it', async () => {
    const path = bundleHolding(['code/prompt-history.md', 'session.md'])

    expect(await pathsOf(path)).toEqual(['code/prompt-history.md', 'session.md'])
  })

  it('records no file mode, having none to record', async () => {
    const path = bundleHolding(['repo-context/scripts/retry.sh'])

    const [entry] = await (await bundleTree(path, unbounded)).entries()
    expect(entry).toEqual({ path: 'scripts/retry.sh', regularFile: true, executable: null })
  })

  it('reads a file back through the path it reported', async () => {
    const path = bundleHolding(['repo-context/CLAUDE.md'])

    const tree = await bundleTree(path, unbounded)
    expect(await tree.read('CLAUDE.md')).toContain('repo-context/CLAUDE.md')
  })

  it('answers null for a path it never reported, rather than throwing', async () => {
    const path = bundleHolding(['session.md'])

    const tree = await bundleTree(path, unbounded)
    expect(await tree.read('absent.md')).toBeNull()
    expect(await tree.probe('absent.md', 8)).toBeNull()
  })

  it('refuses to walk a spent budget', async () => {
    const path = bundleHolding(['repo-context/docs/context/architecture.md'])
    const controller = new AbortController()
    controller.abort()

    await expect(bundleTree(path, controller.signal)).rejects.toThrow()
  })
})
