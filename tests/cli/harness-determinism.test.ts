import { hostname } from 'node:os'
import { describe, expect, it } from 'vitest'
import { REPO_ROOT, runCli } from './spawn-cli.test-fixture.js'

// INVARIANT: the report claims byte-identical output across machines for the same subject and tool
// convention — no timestamp, no duration, no hostname, no absolute path the caller did not type. A
// claim nothing tests is a claim nobody has checked, so this suite runs the same subject under two
// path spellings and compares bytes rather than trusting the claim.

const HOSTNAME_PATTERN = new RegExp(hostname().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
const DURATION_PATTERN = /\b\d+(\.\d+)?\s?(ms|milliseconds|seconds?)\b/i
const TIMESTAMP_PATTERN =
  /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i

describe('the same subject spelled two ways produces byte-identical output', () => {
  it('renders identical prose for a bare relative path and the absolute path', () => {
    const bare = runCli('harness', '.')
    const absolute = runCli('harness', REPO_ROOT)

    expect(bare.status).toBe(0)
    expect(absolute.status).toBe(0)
    expect(bare.stdout).toBe(absolute.stdout)
  })

  it('renders identical JSON for a bare relative path and the absolute path', () => {
    const bare = runCli('harness', '.', '--json')
    const absolute = runCli('harness', REPO_ROOT, '--json')

    expect(bare.status).toBe(0)
    expect(absolute.status).toBe(0)
    expect(bare.stdout).toBe(absolute.stdout)
  })

  it('renders identical output for a dotted relative path and a bare one', () => {
    const dotted = runCli('harness', './.')
    const bare = runCli('harness', '.')

    expect(dotted.stdout).toBe(bare.stdout)
  })
})

describe('subject-scoped file paths never carry the operand or its resolution', () => {
  it('publishes subject-scoped paths as tree-relative names, whichever way the subject was spelled', () => {
    const report = JSON.parse(runCli('harness', REPO_ROOT, '--json').stdout) as {
      files: readonly { path: string; scope: string }[]
    }
    const subjectFiles = report.files.filter((file) => file.scope === 'SUBJECT')

    expect(subjectFiles.length).toBeGreaterThan(0)
    for (const file of subjectFiles) {
      expect(file.path).not.toContain(REPO_ROOT)
      expect(file.path.startsWith('/')).toBe(false)
    }
  })

  it('labels the machine section apart from the subject one rather than folding it in', () => {
    const output = runCli('harness', '.').stdout

    expect(output).toContain('Subject (same subject on any machine)')
    expect(output).toContain('Machine (unchanged machine configuration only)')
  })
})

describe('nothing machine-local or time-local leaks into the output', () => {
  it('carries no hostname', () => {
    const output = runCli('harness', '.').stdout

    expect(output).not.toMatch(HOSTNAME_PATTERN)
  })

  it('carries no duration', () => {
    const output = runCli('harness', '.').stdout

    expect(output).not.toMatch(DURATION_PATTERN)
  })

  it('carries no timestamp', () => {
    const output = runCli('harness', '.').stdout

    expect(output).not.toMatch(TIMESTAMP_PATTERN)
  })
})
