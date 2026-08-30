import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ClaudeHarnessAdapter } from './claude-harness.adapter.js'

const unbounded = new AbortController().signal

let directories: string[] = []

afterEach(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true })
  directories = []
})

function directoryHolding(files: Readonly<Record<string, string>>): string {
  const path = mkdtempSync(join(tmpdir(), 'aidd-claude-harness-'))
  directories.push(path)

  for (const [name, content] of Object.entries(files)) {
    const absolute = join(path, name)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, content)
  }

  return path
}

function emptyMachineDirectory(): string {
  return directoryHolding({})
}

describe('reading a subject through the Claude loading convention', () => {
  it('publishes the context file and every file it imports as always-loaded, subject-scoped', async () => {
    const subject = directoryHolding({
      'CLAUDE.md': '@memory/architecture.md\n',
      'memory/architecture.md': 'the architecture memory\n',
    })
    const adapter = new ClaudeHarnessAdapter(emptyMachineDirectory())

    const { files } = await adapter.read(subject, unbounded)
    const byPath = new Map(files.map((file) => [file.path, file]))

    expect(byPath.get('CLAUDE.md')).toMatchObject({ tier: 'ALWAYS_LOADED', scope: 'SUBJECT' })
    expect(byPath.get('memory/architecture.md')).toMatchObject({
      tier: 'ALWAYS_LOADED',
      scope: 'SUBJECT',
    })
  })

  it('leaves a memory file nothing imports out of the always-loaded tier', async () => {
    const subject = directoryHolding({
      'CLAUDE.md': '@memory/architecture.md\n',
      'memory/architecture.md': 'imported\n',
      'memory/unused.md': 'never imported by anything\n',
    })
    const adapter = new ClaudeHarnessAdapter(emptyMachineDirectory())

    const { files } = await adapter.read(subject, unbounded)

    expect(files.some((file) => file.path === 'memory/unused.md')).toBe(false)
  })

  it('publishes a missing import as unread instead of silently treating it as absent', async () => {
    const subject = directoryHolding({ 'CLAUDE.md': '@memory/missing.md\n' })
    const adapter = new ClaudeHarnessAdapter(emptyMachineDirectory())

    const { unread } = await adapter.read(subject, unbounded)

    expect(unread).toContainEqual({
      path: 'memory/missing.md',
      scope: 'SUBJECT',
      reason: 'MISSING_IMPORT',
    })
  })

  it('reads an absolute ~/.claude import as a machine-scoped file', async () => {
    const machine = directoryHolding({ 'memory/global.md': 'machine import\n' })
    const subject = directoryHolding({ 'CLAUDE.md': '@~/.claude/memory/global.md\n' })
    const adapter = new ClaudeHarnessAdapter(machine)

    const { files } = await adapter.read(subject, unbounded)
    const imported = files.find((file) => file.content === 'machine import\n')

    expect(imported).toMatchObject({ scope: 'MACHINE', tier: 'ALWAYS_LOADED' })
    expect(imported?.path).toBe(join(machine, 'memory/global.md'))
  })

  it('places a rule declaring paths in the conditional tier and one without in the always-loaded tier', async () => {
    const subject = directoryHolding({
      'CLAUDE.md': 'no imports here\n',
      '.claude/rules/conditional.md': ['---', 'paths:', '  - "src/**/*.ts"', '---', 'body'].join(
        '\n',
      ),
      '.claude/rules/always.md': '# a rule with no frontmatter\n',
    })
    const adapter = new ClaudeHarnessAdapter(emptyMachineDirectory())

    const { files } = await adapter.read(subject, unbounded)
    const byPath = new Map(files.map((file) => [file.path, file]))

    expect(byPath.get('.claude/rules/conditional.md')?.tier).toBe('CONDITIONALLY_LOADED')
    expect(byPath.get('.claude/rules/always.md')?.tier).toBe('ALWAYS_LOADED')
  })

  it("publishes a skill's description as always-loaded and its body as conditionally loaded", async () => {
    const subject = directoryHolding({
      'CLAUDE.md': 'no imports here\n',
      '.claude/skills/my-skill.md': [
        '---',
        'name: my-skill',
        'description: what this skill does',
        '---',
        '',
        'the full body of the skill',
      ].join('\n'),
    })
    const adapter = new ClaudeHarnessAdapter(emptyMachineDirectory())

    const { files } = await adapter.read(subject, unbounded)
    const byPath = new Map(files.map((file) => [file.path, file]))

    const description = byPath.get('.claude/skills/my-skill.md')
    const body = byPath.get('.claude/skills/my-skill.md::body')

    expect(description).toMatchObject({ tier: 'ALWAYS_LOADED', content: 'what this skill does' })
    expect(body?.tier).toBe('CONDITIONALLY_LOADED')
    expect(body?.content).toContain('the full body of the skill')
  })

  it('tags every file with the scope it was read from, and mixes neither total across scopes', async () => {
    const subject = directoryHolding({ 'CLAUDE.md': 'subject prose\n' })
    const machine = directoryHolding({ 'CLAUDE.md': 'machine prose\n' })
    const adapter = new ClaudeHarnessAdapter(machine)

    const { files } = await adapter.read(subject, unbounded)

    const subjectScoped = files.filter((file) => file.scope === 'SUBJECT')
    const machineScoped = files.filter((file) => file.scope === 'MACHINE')

    expect(subjectScoped.map((file) => file.content)).toContain('subject prose\n')
    expect(machineScoped.map((file) => file.content)).toContain('machine prose\n')
    expect(subjectScoped.every((file) => file.content !== 'machine prose\n')).toBe(true)
  })

  it('reports nothing measured for a subject holding no harness at all', async () => {
    const subject = directoryHolding({})
    const adapter = new ClaudeHarnessAdapter(emptyMachineDirectory())

    expect((await adapter.read(subject, unbounded)).files).toEqual([])
  })

  it("walks the subject's ancestors as machine scope, never as subject scope", async () => {
    const outer = directoryHolding({
      'CLAUDE.md': '@ancestor-import.md\n',
      'ancestor-import.md': 'ancestor content\n',
    })
    const subject = join(outer, 'nested', 'repository')
    mkdirSync(subject, { recursive: true })
    writeFileSync(join(subject, 'CLAUDE.md'), 'subject prose\n')
    const adapter = new ClaudeHarnessAdapter(emptyMachineDirectory())

    const { files } = await adapter.read(subject, unbounded)
    const ancestorFile = files.find((file) => file.content === 'ancestor content\n')
    const ancestorContext = files.find((file) => file.content === '@ancestor-import.md\n')

    expect(ancestorFile?.scope).toBe('MACHINE')
    expect(ancestorContext?.scope).toBe('MACHINE')
  })

  it('names the tool whose loading convention was read', () => {
    expect(new ClaudeHarnessAdapter().tool).toBe('claude')
  })
})

describe("honouring the caller's cancellation", () => {
  it('stops rather than reading the subject when the budget is already spent', async () => {
    const subject = directoryHolding({ 'CLAUDE.md': 'the context file\n' })
    const adapter = new ClaudeHarnessAdapter(emptyMachineDirectory())
    const controller = new AbortController()
    controller.abort(new Error('budget spent before the call'))

    await expect(adapter.read(subject, controller.signal)).rejects.toThrow(
      'budget spent before the call',
    )
  })

  it('stops when the budget is spent while it is still reading', async () => {
    const subject = directoryHolding({
      'CLAUDE.md': '@memory/one.md\n',
      'memory/one.md': 'the first memory\n',
      '.claude/rules/a.md': '---\npaths:\n  - "src/**"\n---\n\na rule\n',
    })
    const adapter = new ClaudeHarnessAdapter(emptyMachineDirectory())
    const controller = new AbortController()
    queueMicrotask(() => controller.abort(new Error('budget spent mid-read')))

    await expect(adapter.read(subject, controller.signal)).rejects.toThrow('budget spent mid-read')
  })
})

describe('a file the machine scan and the ancestor walk both reach', () => {
  it('counts it once, however differently the two spell its path', async () => {
    const home = directoryHolding({
      '.claude/CLAUDE.md': 'the machine context file\n',
      'project/CLAUDE.md': 'the subject context file\n',
    })
    const subject = join(home, 'project')
    const adapter = new ClaudeHarnessAdapter(join(home, '.claude'))

    const { files } = await adapter.read(subject, unbounded)
    const machine = files.filter((file) => file.scope === 'MACHINE')

    expect(machine).toHaveLength(1)
    expect(new Set(machine.map((file) => file.path)).size).toBe(1)
  })

  it('keeps a subject file distinct from a machine file of the same name', async () => {
    const home = directoryHolding({
      '.claude/CLAUDE.md': 'the machine context file\n',
      'project/CLAUDE.md': 'the subject context file\n',
    })
    const subject = join(home, 'project')
    const adapter = new ClaudeHarnessAdapter(join(home, '.claude'))

    const { files } = await adapter.read(subject, unbounded)
    const paths = files.map((file) => file.path)

    expect(new Set(paths).size).toBe(paths.length)
  })
})

describe('the machine scope holds its rules and declarations at its own root', () => {
  it('reads a personal rule and a personal skill, which sit beside CLAUDE.md, not under .claude/', async () => {
    const machine = directoryHolding({
      'CLAUDE.md': 'the machine context file\n',
      'rules/always.md': 'a personal rule with no paths\n',
      'rules/scoped.md': '---\npaths:\n  - "src/**"\n---\n\na scoped personal rule\n',
      'skills/deploy.md': '---\nname: deploy\ndescription: ship it\n---\n\nthe body\n',
    })
    const subject = directoryHolding({ 'CLAUDE.md': 'the subject context file\n' })
    const adapter = new ClaudeHarnessAdapter(machine)

    const { files } = await adapter.read(subject, unbounded)
    const machineFiles = files.filter((file) => file.scope === 'MACHINE')
    const named = (name: string) => machineFiles.some((file) => file.path.endsWith(name))

    expect(named('rules/always.md')).toBe(true)
    expect(named('rules/scoped.md')).toBe(true)
    expect(named('skills/deploy.md')).toBe(true)
  })

  it('publishes malformed rules and declarations without a description as unread', async () => {
    const subject = directoryHolding({
      'CLAUDE.md': 'context\n',
      '.claude/rules/broken.md': '---\npaths: [\n---\nbody\n',
      '.claude/skills/no-description.md': '---\nname: no-description\n---\nbody\n',
    })
    const adapter = new ClaudeHarnessAdapter(emptyMachineDirectory())

    const { unread } = await adapter.read(subject, unbounded)

    expect(unread).toContainEqual({
      path: '.claude/rules/broken.md',
      scope: 'SUBJECT',
      reason: 'INVALID_RULE_FRONT_MATTER',
    })
    expect(unread).toContainEqual({
      path: '.claude/skills/no-description.md',
      scope: 'SUBJECT',
      reason: 'MISSING_DECLARATION_DESCRIPTION',
    })
  })

  it('tiers a personal rule by its own paths declaration, as it does a subject rule', async () => {
    const machine = directoryHolding({
      'CLAUDE.md': 'the machine context file\n',
      'rules/always.md': 'a personal rule with no paths\n',
      'rules/scoped.md': '---\npaths:\n  - "src/**"\n---\n\na scoped personal rule\n',
    })
    const subject = directoryHolding({ 'CLAUDE.md': 'the subject context file\n' })
    const adapter = new ClaudeHarnessAdapter(machine)

    const { files } = await adapter.read(subject, unbounded)
    const tierOf = (name: string) => files.find((file) => file.path.endsWith(name))?.tier

    expect(tierOf('rules/always.md')).toBe('ALWAYS_LOADED')
    expect(tierOf('rules/scoped.md')).toBe('CONDITIONALLY_LOADED')
  })
})
