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
    // An unrelated cwd with its own decoy aidd.yml forces the two resolutions apart.
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
    // INVARIANT: aidd.yml is absent from the package but present in an ancestor; the module is
    // copied in so the walk starts inside the package.
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

    // SAFETY: pins the error class and the offending directory, so an unrelated crash cannot pass
    // as this guard firing.
    expect(() => copiedCanonicalModelPath()).toThrow(Error)
    expect(() => copiedCanonicalModelPath()).toThrow(moduleDir)
  })
})
