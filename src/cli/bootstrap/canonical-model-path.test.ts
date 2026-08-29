import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { canonicalModelPath } from './canonical-model-path.js'

describe('canonicalModelPath', () => {
  let tempDir: string | undefined
  let originalCwd: string | undefined

  afterEach(() => {
    if (originalCwd !== undefined) {
      process.chdir(originalCwd)
      originalCwd = undefined
    }
    if (tempDir !== undefined) {
      rmSync(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
  })

  it('resolves the packaged aidd.yml relative to this module, not to process.cwd()', () => {
    // A cwd-based resolution is indistinguishable from this one at the repo
    // root. An unrelated cwd with its own decoy forces them apart.
    tempDir = mkdtempSync(join(tmpdir(), 'aidd-audit-cwd-'))
    const decoyModel = join(tempDir, 'aidd.yml')
    writeFileSync(decoyModel, 'schemaVersion: 1\nid: decoy\n')

    originalCwd = process.cwd()
    process.chdir(tempDir)

    const resolved = canonicalModelPath()

    // Computed independently, so the assertion does not restate the walk.
    const expected = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'aidd.yml')

    expect(resolved).toBe(expected)
    expect(resolved).not.toBe(decoyModel)
    expect(existsSync(resolved)).toBe(true)
  })

  it('bounds the walk at the nearest package.json and refuses a foreign aidd.yml above it', async () => {
    // `aidd.yml` missing from the package, one present in an ancestor by
    // coincidence. The module is copied in so the walk starts inside it.
    tempDir = mkdtempSync(join(tmpdir(), 'aidd-audit-package-'))
    writeFileSync(join(tempDir, 'aidd.yml'), 'schemaVersion: 1\nid: foreign-ancestor\n')

    const packageRoot = join(tempDir, 'pkg')
    const moduleDir = join(packageRoot, 'dist')
    mkdirSync(moduleDir, { recursive: true })
    writeFileSync(join(packageRoot, 'package.json'), '{"name":"pkg","private":true}')

    const sourcePath = fileURLToPath(new URL('./canonical-model-path.ts', import.meta.url))
    const copiedModulePath = join(moduleDir, 'canonical-model-path.ts')
    copyFileSync(sourcePath, copiedModulePath)

    const { canonicalModelPath: copiedCanonicalModelPath } = await import(
      /* @vite-ignore */ pathToFileURL(copiedModulePath).href
    )

    // Pins both the error class and a fragment naming the offending start
    // directory, so a bare `toThrow()` from an unrelated crash cannot pass
    // this in place of the guard actually firing.
    expect(() => copiedCanonicalModelPath()).toThrow(Error)
    expect(() => copiedCanonicalModelPath()).toThrow(moduleDir)
  })
})
