import { chmod, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runGit } from '../live-repository/git-process.js'
import { trackedTree } from '../live-repository/tracked-tree.js'
import type { HarnessScan } from './harness-scan.js'
import { scanHarness } from './harness-scan.js'

// INVARIANT: Every existing expectation literal stays exactly as written; this projects the third
// field away rather than editing the seventy-seven `resolves.toEqual` call sites that predate it.
async function capabilitiesAndUndecidable(
  scan: Promise<HarnessScan>,
): Promise<Pick<HarnessScan, 'capabilities' | 'undecidable'>> {
  const { capabilities, undecidable } = await scan
  return { capabilities, undecidable }
}

// Integration: the tracked tree and the recorded file modes are the boundary under test.

const unbounded = new AbortController().signal
const NO_TRAILER = false
const A_TRAILER = true
// The commit history could not be read at all, which is not the same as holding no trailer.
const AN_UNREADABLE_HISTORY = null

interface FileSpec {
  readonly path: string
  readonly content?: string
  readonly executable?: boolean
  // `100755` in the index, no execute bit on disk: a clone with `core.fileMode=false`.
  readonly executableInTheIndexOnly?: boolean
  // Tracked, then removed from the working copy: listed by `ls-files`, unreadable on disk.
  readonly deletedFromTheWorkingCopy?: boolean
}

const created: string[] = []

afterEach(async () => {
  await Promise.all(created.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function writeInto(root: string, file: FileSpec): Promise<void> {
  const absolute = join(root, file.path)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, file.content ?? 'fixture\n', 'utf8')
  await chmod(absolute, file.executable === true ? 0o755 : 0o644)
}

// `os.tmpdir()` is a symlink on macOS, so the root is resolved before anything joins onto it.
async function repositoryWith(
  tracked: readonly FileSpec[],
  untracked: readonly FileSpec[] = [],
): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'aidd-harness-')))
  created.push(root)

  await runGit(root, ['-c', 'init.defaultBranch=main', 'init'], unbounded)
  await runGit(root, ['config', 'user.email', 'fixture@example.test'], unbounded)
  await runGit(root, ['config', 'user.name', 'Harness Fixture'], unbounded)
  await runGit(root, ['config', 'core.autocrlf', 'false'], unbounded)
  await runGit(root, ['config', 'commit.gpgsign', 'false'], unbounded)
  // A developer's global excludes must not decide what this fixture tracks.
  await runGit(root, ['config', 'core.excludesFile', join(root, '.no-global-excludes')], unbounded)

  for (const file of tracked) await writeInto(root, file)
  if (tracked.length > 0) {
    await runGit(root, ['add', '-f', '--', ...tracked.map((file) => file.path)], unbounded)

    for (const file of tracked) {
      if (file.executableInTheIndexOnly !== true) continue
      await runGit(root, ['update-index', '--chmod=+x', '--', file.path], unbounded)
    }

    await runGit(root, ['commit', '--no-verify', '-m', 'chore: fixture tree'], unbounded)
  }

  for (const file of tracked) {
    if (file.deletedFromTheWorkingCopy !== true) continue
    await rm(join(root, file.path))
  }

  for (const file of untracked) await writeInto(root, file)
  return root
}

const AGENT_LOOP_ON_EXIT_STATUS = `#!/usr/bin/env bash
until pnpm check; do
  claude -p "fix the failing check"
done
`

const AGENT_LOOP_BROKEN_ON_EXIT_STATUS = `#!/bin/bash
while true; do
  claude -p "fix the failing check"
  if pnpm check; then
    break
  fi
done
`

const AGENT_WITHOUT_A_LOOP = `#!/bin/bash
claude -p "write the migration"
`

const AGENT_IN_A_COUNTED_LOOP = `#!/bin/bash
for attempt in 1 2 3; do
  claude -p "try again"
done
`

const AGENT_ONLY_MENTIONED = `#!/bin/bash
# claude -p "fix" belongs here one day
until pnpm check; do
  echo "still red; claude will have to be run by hand"
done
`

const AGENT_IN_AN_UNGUARDED_ENDLESS_LOOP = `#!/bin/bash
while true; do
  claude -p "keep going"
done
`

const AGENT_NAMED_ONLY_AS_AN_ARGUMENT = `#!/bin/bash
until pnpm check; do
  grep -r claude src
done
`

const AGENT_IN_A_NON_SHELL_SCRIPT = `#!/usr/bin/env python3
import subprocess

while True:
    if subprocess.run(["pnpm", "check"]).returncode == 0:
        break
    subprocess.run(["claude", "-p", "fix the failing check"])
`

const AGENT_NAMED_ONLY_IN_A_NON_SHELL_COMMENT = `#!/usr/bin/env node
// runs on every claude edit
const { execFileSync } = require('node:child_process')
execFileSync('biome', ['format', '--write', process.argv[2]])
`

const AGENT_UNDER_A_TIMEOUT = `#!/bin/bash
until pnpm check; do
  timeout 300 claude -p "fix"
done
`

const AGENT_UNDER_NICE = `#!/bin/bash
until pnpm check; do
  nice claude -p "fix"
done
`

const AGENT_BEHIND_A_SHELL_FUNCTION = `#!/bin/bash
run_agent() {
  claude -p "fix"
}

until pnpm check; do
  run_agent
done
`

const AGENT_BROKEN_ON_A_CAPTURED_EXIT_STATUS = `#!/bin/bash
while true; do
  claude -p fix
  pnpm check
  status=$?
  if [ $status -eq 0 ]; then
    break
  fi
done
`

const AGENT_INVOKED_IN_THE_LOOP_HEADER = `#!/bin/bash
while claude -p "fix" && ! pnpm check; do
  sleep 1
done
`

const AGENT_IN_A_LOOP_ENDED_BY_SOMETHING_UNREADABLE = `#!/bin/bash
while true; do
  claude -p "fix"
  if [ -f .agent-done ]; then
    break
  fi
done
`

const A_PERMISSION_ALLOW_LIST = JSON.stringify({
  permissions: { allow: ['Bash(pnpm test:*)'] },
})

describe('scanHarness', () => {
  it('reports an empty capability set for a tracked tree holding none of the harness artifacts', async () => {
    const root = await repositoryWith([{ path: 'README.md' }, { path: 'src/index.ts' }])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('scans the whole repository even when handed one of its subdirectories', async () => {
    const root = await repositoryWith([
      { path: 'CLAUDE.md' },
      { path: '.claude/rules/style.md' },
      { path: 'packages/api/index.ts' },
    ])

    // SAFETY: Bare `ls-files` under `packages/api` would miss the root `CLAUDE.md`, and the set
    // would publish without `context-engineering` — a practice gap on a repository that has it.
    await expect(
      capabilitiesAndUndecidable(
        scanHarness(
          await trackedTree(join(root, 'packages/api'), unbounded),
          NO_TRAILER,
          unbounded,
        ),
      ),
    ).resolves.toEqual({
      capabilities: ['context-engineering', 'behavior'],
      undecidable: [],
    })
  })

  it('proves context-engineering from a CLAUDE.md nested below the root, because a named file counts wherever it sits', async () => {
    const root = await repositoryWith([{ path: 'packages/api/CLAUDE.md' }])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['context-engineering'],
      undecidable: [],
    })
  })

  it('proves nothing from an untracked CLAUDE.md, because an unversioned file records no practice', async () => {
    const root = await repositoryWith([{ path: 'README.md' }], [{ path: 'CLAUDE.md' }])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('proves nothing from prompt-toolkit-notes.md, because names are matched exactly and never as a pattern', async () => {
    const root = await repositoryWith([{ path: 'prompt-toolkit-notes.md' }])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('proves prompts from a session.md nested deep in the tree, because a named file counts wherever it sits', async () => {
    const root = await repositoryWith([{ path: 'code/notes/2026/session.md' }])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['prompts'],
      undecidable: [],
    })
  })

  it('proves nothing from a .specstory directory found below the root, because a named directory counts at the root only', async () => {
    const root = await repositoryWith([{ path: 'docs/.specstory/2026-08-01.md' }])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('proves prompts from an AI attribution trailer alone, with no transcript file in the tree', async () => {
    const root = await repositoryWith([{ path: 'README.md' }])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), A_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['prompts'],
      undecidable: [],
    })
  })

  // INVARIANT: every entry is the only proof its repository holds, so removing it from the table
  // turns its case red. The entries are written out rather than read from the module, which would
  // only shrink with it.
  describe('the closed tables, each entry pinned by the capability it alone proves', () => {
    it.each(['session.md', 'prompt-history.md', '.aider.chat.history.md'])(
      'proves prompts from a tracked %s',
      async (transcript) => {
        const root = await repositoryWith([{ path: transcript }])

        await expect(
          capabilitiesAndUndecidable(
            scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
          ),
        ).resolves.toEqual({
          capabilities: ['prompts'],
          undecidable: [],
        })
      },
    )

    it.each(['.specstory/', '.claude/history/'])(
      'proves prompts from a tracked file under a root %s',
      async (directory) => {
        const root = await repositoryWith([{ path: `${directory}2026-08-01.md` }])

        await expect(
          capabilitiesAndUndecidable(
            scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
          ),
        ).resolves.toEqual({
          capabilities: ['prompts'],
          undecidable: [],
        })
      },
    )

    it.each(['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.github/copilot-instructions.md'])(
      'proves context-engineering from a tracked %s',
      async (context) => {
        const root = await repositoryWith([{ path: context }])

        await expect(
          capabilitiesAndUndecidable(
            scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
          ),
        ).resolves.toEqual({
          capabilities: ['context-engineering'],
          undecidable: [],
        })
      },
    )

    it.each(['aidd_docs/memory/', 'docs/context/', '.ai/'])(
      'proves context-engineering from a tracked file under a root %s',
      async (directory) => {
        const root = await repositoryWith([{ path: `${directory}architecture.md` }])

        await expect(
          capabilitiesAndUndecidable(
            scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
          ),
        ).resolves.toEqual({
          capabilities: ['context-engineering'],
          undecidable: [],
        })
      },
    )

    it.each([
      '.claude/rules/',
      '.claude/agents/',
      '.claude/hooks/',
      '.claude/skills/',
      '.cursor/rules/',
      '.github/agents/',
    ])('proves behavior from a tracked file under a root %s', async (directory) => {
      const root = await repositoryWith([{ path: `${directory}style.md` }])

      await expect(
        capabilitiesAndUndecidable(
          scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
        ),
      ).resolves.toEqual({
        capabilities: ['behavior'],
        undecidable: [],
      })
    })

    it.each(['.cursorrules', '.windsurfrules'])(
      'proves behavior from a tracked %s',
      async (rules) => {
        const root = await repositoryWith([{ path: rules }])

        await expect(
          capabilitiesAndUndecidable(
            scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
          ),
        ).resolves.toEqual({
          capabilities: ['behavior'],
          undecidable: [],
        })
      },
    )

    it.each([
      ['.claude/settings.json', A_PERMISSION_ALLOW_LIST],
      ['.claude/settings.local.json', A_PERMISSION_ALLOW_LIST],
      ['.cursor/environment.json', A_PERMISSION_ALLOW_LIST],
      ['.gemini/settings.json', A_PERMISSION_ALLOW_LIST],
    ])(
      'proves behavior from a permission allow list in a tracked %s',
      async (settings, content) => {
        const root = await repositoryWith([{ path: settings, content }])

        await expect(
          capabilitiesAndUndecidable(
            scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
          ),
        ).resolves.toEqual({
          capabilities: ['behavior'],
          undecidable: [],
        })
      },
    )

    it('proves nothing from a tracked .aider.conf.yml and does not cost the axis, because the list names no file the recogniser cannot read', async () => {
      const aiderConfiguration = 'read:\n  - CONVENTIONS.md\nauto-commits: false\n'
      // INVARIANT: the fixture only means anything if the document is not JSON: listing it would
      // make every repository holding one an unparseable source, and the harness axis UNKNOWN.
      expect(() => JSON.parse(aiderConfiguration)).toThrow(SyntaxError)

      const root = await repositoryWith([{ path: '.aider.conf.yml', content: aiderConfiguration }])

      await expect(
        capabilitiesAndUndecidable(
          scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
        ),
      ).resolves.toEqual({
        capabilities: [],
        undecidable: [],
      })
    })

    it('proves behavior from a deny list alone, because a guardrail is a guardrail either way', async () => {
      const root = await repositoryWith([
        {
          path: '.claude/settings.json',
          content: JSON.stringify({ permissions: { deny: ['Bash(rm -rf:*)'] } }),
        },
      ])

      await expect(
        capabilitiesAndUndecidable(
          scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
        ),
      ).resolves.toEqual({
        capabilities: ['behavior'],
        undecidable: [],
      })
    })

    it.each(['claude', 'codex', 'gemini', 'aider', 'cursor-agent'])(
      'proves loops from a shell script re-running %s until another command exits zero',
      async (agent) => {
        const root = await repositoryWith([
          {
            path: 'scripts/retry.sh',
            content: `#!/bin/bash\nuntil pnpm check; do\n  ${agent} -p "fix"\ndone\n`,
            executable: true,
          },
        ])

        await expect(
          capabilitiesAndUndecidable(
            scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
          ),
        ).resolves.toEqual({
          capabilities: ['loops'],
          undecidable: [],
        })
      },
    )

    it.each(['sh', 'bash', 'zsh'])(
      'decides a script carrying a #!/bin/%s shebang, which is what makes it shell',
      async (interpreter) => {
        const root = await repositoryWith([
          {
            path: 'scripts/retry',
            content: `#!/bin/${interpreter}\nuntil pnpm check; do\n  claude -p "fix"\ndone\n`,
            executable: true,
          },
        ])

        await expect(
          capabilitiesAndUndecidable(
            scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
          ),
        ).resolves.toEqual({
          capabilities: ['loops'],
          undecidable: [],
        })
      },
    )

    it.each(['.sh', '.bash', '.zsh'])(
      'decides an executable script named %s carrying no shebang, on its extension alone',
      async (extension) => {
        const withoutShebang = AGENT_LOOP_ON_EXIT_STATUS.split('\n').slice(1).join('\n')
        expect(withoutShebang.startsWith('#!')).toBe(false)

        const root = await repositoryWith([
          { path: `scripts/retry${extension}`, content: withoutShebang, executable: true },
        ])

        await expect(
          capabilitiesAndUndecidable(
            scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
          ),
        ).resolves.toEqual({
          capabilities: ['loops'],
          undecidable: [],
        })
      },
    )
  })

  it('proves loops from an endless loop broken on another command exit status', async () => {
    const root = await repositoryWith([
      { path: 'scripts/retry.sh', content: AGENT_LOOP_BROKEN_ON_EXIT_STATUS, executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: [],
    })
  })

  it('proves loops when the agent runs under a timeout, because a wrapper still runs the command after it', async () => {
    const root = await repositoryWith([
      { path: 'scripts/retry.sh', content: AGENT_UNDER_A_TIMEOUT, executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: [],
    })
  })

  it('proves loops when the agent runs under nice', async () => {
    const root = await repositoryWith([
      { path: 'scripts/retry.sh', content: AGENT_UNDER_NICE, executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: [],
    })
  })

  it('proves loops when the loop calls a shell function defined beside it that invokes the agent', async () => {
    const root = await repositoryWith([
      { path: 'scripts/retry.sh', content: AGENT_BEHIND_A_SHELL_FUNCTION, executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: [],
    })
  })

  it('proves loops when the break is guarded by an exit status the script captured into a variable', async () => {
    const root = await repositoryWith([
      {
        path: 'scripts/retry.sh',
        content: AGENT_BROKEN_ON_A_CAPTURED_EXIT_STATUS,
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: [],
    })
  })

  it('proves loops when the agent is invoked in the loop header rather than its body', async () => {
    const root = await repositoryWith([
      { path: 'scripts/retry.sh', content: AGENT_INVOKED_IN_THE_LOOP_HEADER, executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: [],
    })
  })

  it('proves no loops from a shell script invoking an agent outside any loop, because a script read and holding no loop is an observation', async () => {
    const root = await repositoryWith([
      { path: 'scripts/generate.sh', content: AGENT_WITHOUT_A_LOOP, executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('proves no loops from a loop whose continuation depends on a counter rather than a command exit status', async () => {
    const root = await repositoryWith([
      { path: 'scripts/retry.sh', content: AGENT_IN_A_COUNTED_LOOP, executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('proves no loops from an endless loop nothing ever breaks out of, because nothing gates its continuation', async () => {
    const root = await repositoryWith([
      { path: 'scripts/retry.sh', content: AGENT_IN_AN_UNGUARDED_ENDLESS_LOOP, executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('proves no loops when an agent is named as an argument rather than invoked', async () => {
    const root = await repositoryWith([
      { path: 'scripts/retry.sh', content: AGENT_NAMED_ONLY_AS_AN_ARGUMENT, executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('proves no loops from a script naming an agent only in a comment and in a string', async () => {
    const root = await repositoryWith([
      { path: 'scripts/retry.sh', content: AGENT_ONLY_MENTIONED, executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('cannot decide a loop that invokes an agent and ends on something it could not classify, rather than reporting no loop', async () => {
    const root = await repositoryWith([
      {
        path: 'scripts/retry.sh',
        content: AGENT_IN_A_LOOP_ENDED_BY_SOMETHING_UNREADABLE,
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: ['loops'],
    })
  })

  it('proves nothing from a shell script carrying neither an execute bit nor a shebang', async () => {
    const withoutShebang = AGENT_LOOP_ON_EXIT_STATUS.split('\n').slice(1).join('\n')
    expect(withoutShebang.startsWith('#!')).toBe(false)

    const root = await repositoryWith([
      { path: 'scripts/retry.sh', content: withoutShebang, executable: false },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('proves loops from a shebanged shell script carrying no execute bit, because a shebang makes it a script', async () => {
    const root = await repositoryWith([
      { path: 'scripts/retry.sh', content: AGENT_LOOP_ON_EXIT_STATUS, executable: false },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: [],
    })
  })

  it('reads the execute bit Git recorded, not the one the working copy carries', async () => {
    const withoutShebang = AGENT_LOOP_ON_EXIT_STATUS.split('\n').slice(1).join('\n')
    expect(withoutShebang.startsWith('#!')).toBe(false)

    const root = await repositoryWith([
      {
        path: 'scripts/retry.sh',
        content: withoutShebang,
        executable: false,
        executableInTheIndexOnly: true,
      },
    ])

    // The fixture only means anything if the two disagree, which is the whole of the case.
    const recorded = await runGit(root, ['ls-files', '-s', '--', 'scripts/retry.sh'], unbounded)
    expect(recorded.startsWith('100755 ')).toBe(true)
    const onDisk = await stat(join(root, 'scripts/retry.sh'))
    expect(onDisk.mode & 0o111).toBe(0)

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: [],
    })
  })

  it('cannot decide the harness of an executable non-shell script invoking an agent, rather than publishing a set without loops', async () => {
    const root = await repositoryWith([
      { path: 'scripts/retry.py', content: AGENT_IN_A_NON_SHELL_SCRIPT, executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: ['loops'],
    })
  })

  it('decides the harness of a non-shell hook naming an agent only in a comment, because a mention has to look like an invocation', async () => {
    const root = await repositoryWith([
      { path: 'CLAUDE.md' },
      { path: '.claude/rules/style.md' },
      {
        path: '.claude/hooks/format.js',
        content: AGENT_NAMED_ONLY_IN_A_NON_SHELL_COMMENT,
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['context-engineering', 'behavior'],
      undecidable: [],
    })
  })

  it('cannot decide the harness when a tracked file could not be read at all, rather than reading it as holding nothing', async () => {
    const root = await repositoryWith([
      {
        path: 'scripts/gone.sh',
        content: AGENT_LOOP_ON_EXIT_STATUS,
        deletedFromTheWorkingCopy: true,
      },
    ])

    // The fixture only means anything if the file is tracked and unreadable, both at once.
    const listed = await runGit(root, ['ls-files', '--', 'scripts/gone.sh'], unbounded)
    expect(listed.trim()).toBe('scripts/gone.sh')
    await expect(readFile(join(root, 'scripts/gone.sh'), 'utf8')).rejects.toThrow(/ENOENT/)

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: ['loops'],
    })
  })

  it('cannot decide behavior when a tracked settings file could not be read, even once loops is proven elsewhere', async () => {
    const root = await repositoryWith([
      {
        path: '.claude/settings.json',
        content: A_PERMISSION_ALLOW_LIST,
        deletedFromTheWorkingCopy: true,
      },
      { path: 'scripts/retry.sh', content: AGENT_LOOP_ON_EXIT_STATUS, executable: true },
    ])

    await expect(readFile(join(root, '.claude/settings.json'), 'utf8')).rejects.toThrow(/ENOENT/)

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: ['behavior'],
    })
  })

  it('cannot decide behavior from a settings file whose document does not parse, rather than reading it as declaring no guardrail', async () => {
    const malformed = '{ "permissions": { "allow": ['
    expect(() => JSON.parse(malformed)).toThrow(SyntaxError)

    const root = await repositoryWith([{ path: '.claude/settings.json', content: malformed }])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: ['behavior'],
    })
  })

  it('proves nothing from an empty permission list, because a list with no entry was read and declares no guardrail', async () => {
    const root = await repositoryWith([
      {
        path: '.claude/settings.local.json',
        content: JSON.stringify({ permissions: { allow: [], deny: [] } }),
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('cannot decide prompts when the commit history could not be read and the tree proves it by no other route', async () => {
    const root = await repositoryWith([{ path: 'README.md' }])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), AN_UNREADABLE_HISTORY, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: ['prompts'],
    })
  })

  it('decides prompts anyway when the commit history could not be read but a transcript file already proves it', async () => {
    const root = await repositoryWith([{ path: 'session.md' }])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), AN_UNREADABLE_HISTORY, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['prompts'],
      undecidable: [],
    })
  })

  it('names every member it could not decide, in the vocabulary order, rather than one flag for all of them', async () => {
    const root = await repositoryWith([
      {
        path: '.claude/settings.json',
        content: A_PERMISSION_ALLOW_LIST,
        deletedFromTheWorkingCopy: true,
      },
    ])

    // INVARIANT: The unreadable settings file was the only route to `behavior`, and it is also a
    // tracked file that could have held the loop; the history answered for neither.
    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), AN_UNREADABLE_HISTORY, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: ['prompts', 'behavior', 'loops'],
    })
  })

  it('names no member it could not decide when every source answered', async () => {
    const root = await repositoryWith([
      { path: 'session.md' },
      { path: 'CLAUDE.md' },
      { path: '.claude/rules/style.md' },
      { path: 'scripts/retry.sh', content: AGENT_LOOP_ON_EXIT_STATUS, executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['prompts', 'context-engineering', 'behavior', 'loops'],
      undecidable: [],
    })
  })

  it('decides the harness anyway when a shell script already proves the loops an undecidable script may hold', async () => {
    const root = await repositoryWith([
      { path: 'scripts/retry.py', content: AGENT_IN_A_NON_SHELL_SCRIPT, executable: true },
      { path: 'scripts/retry.sh', content: AGENT_LOOP_ON_EXIT_STATUS, executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: [],
    })
  })

  it('accumulates every capability the tracked tree proves at once', async () => {
    const root = await repositoryWith([
      { path: '.specstory/2026-08-01.md' },
      { path: 'CLAUDE.md' },
      { path: '.claude/rules/style.md' },
      { path: 'scripts/retry.sh', content: AGENT_LOOP_ON_EXIT_STATUS, executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['prompts', 'context-engineering', 'behavior', 'loops'],
      undecidable: [],
    })
  })

  // INVARIANT: the scan checks the budget before each piece of work, so an abort raised at any
  // point surfaces as a rejection rather than a completed scan on a half-read tree. The counts
  // below are what pins each check: drop one and the highest checkpoint stops existing.

  // A real signal exhausted on its `nth` check, so a checkpoint is addressable by position.
  function signalExhaustedAt(
    nth: number,
    reason: Error,
  ): { signal: AbortSignal; checks: () => number } {
    const controller = new AbortController()
    const signal = controller.signal
    const original = signal.throwIfAborted.bind(signal)
    let checks = 0

    Object.defineProperty(signal, 'throwIfAborted', {
      value: () => {
        original()
        if (checks++ === nth) controller.abort(reason)
        original()
      },
    })

    return { signal, checks: () => checks }
  }

  const countChecks = async (root: string): Promise<number> => {
    const counted = signalExhaustedAt(Number.POSITIVE_INFINITY, new Error('never'))
    await scanHarness(await trackedTree(root, counted.signal), NO_TRAILER, counted.signal)
    return counted.checks()
  }

  const A_TREE_WITH_A_SETTINGS_FILE: readonly FileSpec[] = [
    { path: '.claude/settings.json', content: A_PERMISSION_ALLOW_LIST },
    { path: 'README.md' },
  ]

  // Integration: the tracked tree and the recorded file modes are the boundary under test.
  const EXPECTED_CHECKS = 4 + 2 + A_TREE_WITH_A_SETTINGS_FILE.length

  it('checks the budget at every phase boundary it owns', async () => {
    const root = await repositoryWith(A_TREE_WITH_A_SETTINGS_FILE)

    await expect(countChecks(root)).resolves.toBe(EXPECTED_CHECKS)
  })

  it('checks the budget once more for each tracked file it walks', async () => {
    const two = await repositoryWith([{ path: 'a.md' }, { path: 'b.md' }])
    const three = await repositoryWith([{ path: 'a.md' }, { path: 'b.md' }, { path: 'c.md' }])

    expect((await countChecks(three)) - (await countChecks(two))).toBe(1)
  })

  it('checks the budget once more when a tracked settings file has to be opened', async () => {
    const withSettings = await repositoryWith(A_TREE_WITH_A_SETTINGS_FILE)
    const without = await repositoryWith([{ path: '.claude/other.json' }, { path: 'README.md' }])

    expect((await countChecks(withSettings)) - (await countChecks(without))).toBe(1)
  })

  it.each(Array.from({ length: EXPECTED_CHECKS }, (_value, index) => index))(
    'rejects with the abort reason when the budget runs out at checkpoint %i, rather than resolving on a half-read tree',
    async (checkpoint) => {
      const root = await repositoryWith(A_TREE_WITH_A_SETTINGS_FILE)
      const exhausted = signalExhaustedAt(checkpoint, new Error('harness scan budget exhausted'))

      const scan = scanHarness(
        await trackedTree(root, exhausted.signal),
        NO_TRAILER,
        exhausted.signal,
      )

      await expect(scan).rejects.toThrow(Error)
      await expect(scan).rejects.toThrow(/harness scan budget exhausted/)
    },
  )

  it('rejects with the abort reason when the budget is already exhausted, rather than resolving on an unread tree', async () => {
    const root = await repositoryWith([{ path: 'CLAUDE.md' }])
    const controller = new AbortController()
    controller.abort(new Error('harness scan budget exhausted'))

    const scan = scanHarness(
      await trackedTree(root, controller.signal),
      NO_TRAILER,
      controller.signal,
    )

    await expect(scan).rejects.toThrow(Error)
    await expect(scan).rejects.toThrow(/harness scan budget exhausted/)
  })

  // SAFETY: the shell expands parameters inside double quotes and not inside single ones, so
  // reading both as opaque costs `loops` on the better-written of two identical scripts.
  const retryOn = (condition: string, capture = 'rc=$?'): string =>
    `#!/bin/bash\nrc=1\nwhile ${condition}; do\n  claude -p "fix"\n  pnpm check\n  ${capture}\ndone\n`

  it.each([
    ['a quoted status variable', '[ "$rc" -ne 0 ]'],
    ['a braced status variable', '[ "${rc}" -ne 0 ]'],
    ['an unbraced status variable', '[ $rc -ne 0 ]'],
    ['a status variable inside [[ ]]', '[[ "$rc" -ne 0 ]]'],
    ['a quoted $? read directly', '[ "$?" -ne 0 ]'],
  ])('proves loops from a while loop continued on %s', async (_shape, condition) => {
    const root = await repositoryWith([
      { path: 'scripts/retry.sh', content: retryOn(condition), executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: [],
    })
  })

  it('proves loops when the exit status was captured through a quoted assignment', async () => {
    const root = await repositoryWith([
      {
        path: 'scripts/retry.sh',
        content: retryOn('[ "$rc" -ne 0 ]', 'rc="$?"'),
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: [],
    })
  })

  it('reads no exit status through single quotes, where the same condition double-quoted proves loops', async () => {
    const single = await repositoryWith([
      { path: 'scripts/retry.sh', content: retryOn("[ '$rc' -ne 0 ]"), executable: true },
    ])
    const double = await repositoryWith([
      { path: 'scripts/retry.sh', content: retryOn('[ "$rc" -ne 0 ]'), executable: true },
    ])

    // INVARIANT: The contrast is the assertion: `'$rc'` is three characters and `"$rc"` is a
    // reference, so one loop hangs on an exit status and the other hangs on a constant.
    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(single, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(double, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: [],
    })
  })

  it('still reads no invocation in an agent named inside a double-quoted message', async () => {
    const root = await repositoryWith([
      { path: 'scripts/retry.sh', content: AGENT_ONLY_MENTIONED, executable: true },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('cannot decide a loop whose condition names a status variable inside a command substitution, because that substitution runs something of its own', async () => {
    const root = await repositoryWith([
      {
        path: 'scripts/retry.sh',
        content:
          '#!/bin/bash\nrc=1\nwhile [ "$(exit_code_of $rc)" -ne 0 ]; do\n  claude -p "fix"\n  rc=$?\ndone\n',
        executable: true,
      },
    ])

    // SAFETY: `$( … )` is another command's exit status, not this loop's test of `rc`. Reading the
    // name through it would prove a retry on a coincidence of spelling.
    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: ['loops'],
    })
  })

  it('proves loops from an until loop continued on a negated command', async () => {
    const root = await repositoryWith([
      {
        path: 'scripts/retry.sh',
        content: '#!/bin/bash\nuntil ! grep -q FAIL results.txt; do\n  claude -p "fix"\ndone\n',
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: [],
    })
  })

  it('proves loops from a retry nested inside an iteration, because the inner loop is the one that re-runs', async () => {
    const root = await repositoryWith([
      {
        path: 'scripts/retry.sh',
        content:
          '#!/bin/bash\nfor f in *.ts; do\n  until pnpm check "$f"; do\n    claude -p "fix $f"\n  done\ndone\n',
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: [],
    })
  })

  it('proves no loops from an iteration nested inside an endless loop nothing breaks out of', async () => {
    const root = await repositoryWith([
      {
        path: 'scripts/retry.sh',
        content:
          '#!/bin/bash\nwhile true; do\n  for f in *.ts; do\n    claude -p "doc $f"\n  done\ndone\n',
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('proves loops when the function the loop calls is defined after it, because a script is read whole', async () => {
    const root = await repositoryWith([
      {
        path: 'scripts/retry.sh',
        content:
          '#!/bin/bash\nuntil pnpm check; do\n  run_agent\ndone\n\nrun_agent() {\n  claude -p "fix"\n}\n',
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['loops'],
      undecidable: [],
    })
  })

  it('reads only the arguments a spawner is handed, not every literal that follows the call', async () => {
    const root = await repositoryWith([
      {
        path: 'bin/check.js',
        content:
          '#!/usr/bin/env node\nexecSync("pnpm check")\nconsole.log("done; claude ran earlier")\n',
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('proves no loops from a for-in loop over a list, and does not call it undecidable, because the agent runs once per item', async () => {
    const root = await repositoryWith([
      {
        path: 'scripts/document.sh',
        content: '#!/bin/bash\nfor f in *.ts; do\n  claude -p "doc $f" || exit 1\ndone\n',
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('proves no loops from a while read loop, because consuming input is not re-running', async () => {
    const root = await repositoryWith([
      {
        path: 'scripts/batch.sh',
        content: '#!/bin/bash\nwhile read -r line; do\n  claude -p "$line"\ndone < tasks.txt\n',
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('proves no loops from a counter loop, because a count is decidably not an exit status', async () => {
    const root = await repositoryWith([
      {
        path: 'scripts/attempts.sh',
        content:
          '#!/bin/bash\ni=0\nwhile [ "$i" -lt 5 ]; do\n  claude -p "go"\n  i=$((i + 1))\ndone\n',
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('cannot decide a counter whose starting value came out of a command substitution', async () => {
    const root = await repositoryWith([
      {
        path: 'scripts/attempts.sh',
        content:
          '#!/bin/bash\ni=$(compute_start)\nwhile [ "$i" -lt 5 ]; do\n  claude -p "go"\n  i=$((i + 1))\ndone\n',
        executable: true,
      },
    ])

    // INVARIANT: known-not-status is decidable; unknown origin is not. `compute_start` may well
    // return the exit code this loop is retrying on, and nothing here says otherwise.
    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: ['loops'],
    })
  })

  it('proves no loops from a read loop whose header also tests the line it read', async () => {
    const root = await repositoryWith([
      {
        path: 'scripts/batch.sh',
        content:
          '#!/bin/bash\nwhile read -r line && [ "$line" != stop ]; do\n  claude -p "$line"\ndone < tasks.txt\n',
        executable: true,
      },
    ])

    // INVARIANT: The header references `line`, and `read` is where `line` came from: a line of
    // input is not an exit status, so the continuation is positively recognised as iteration.
    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('reads nothing at all from a while read loop that never invokes an agent', async () => {
    const root = await repositoryWith([
      {
        path: 'scripts/batch.sh',
        content: '#!/bin/bash\nwhile read -r line; do\n  echo "$line"\ndone < tasks.txt\n',
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it.each(['break', 'exit 0', 'return 0'])(
    'cannot decide a loop stopped early by %s on something it could not attribute',
    async (terminator) => {
      const root = await repositoryWith([
        {
          path: 'scripts/retry.sh',
          content: `#!/bin/bash\nwhile true; do\n  claude -p fix\n  if [ -f .agent-done ]; then\n    ${terminator}\n  fi\ndone\n`,
          executable: true,
        },
      ])

      // SAFETY: an early stop is where a retry can hide: the loop runs the agent again unless
      // something ends it, and what ends it here was not read.
      await expect(
        capabilitiesAndUndecidable(
          scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
        ),
      ).resolves.toEqual({
        capabilities: [],
        undecidable: ['loops'],
      })
    },
  )

  it('keeps the whole harness axis when an executable script binds an agent SDK to a name', async () => {
    const root = await repositoryWith([
      { path: 'CLAUDE.md' },
      { path: '.claude/rules/style.md' },
      {
        path: 'bin/gen.js',
        content:
          '#!/usr/bin/env node\nconst claude = require("anthropic")\nmodule.exports = claude\n',
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: ['context-engineering', 'behavior'],
      undecidable: [],
    })
  })

  it('keeps the whole harness axis when an executable script calls an agent SDK method', async () => {
    const root = await repositoryWith([
      {
        path: 'bin/summarise.py',
        content:
          '#!/usr/bin/env python3\nimport agents\nprint(agents.gemini.generate_content("hi"))\n',
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('cannot decide a non-shell script spawning a command line the agent sits inside rather than begins', async () => {
    const root = await repositoryWith([
      {
        path: 'bin/fix.py',
        content: '#!/usr/bin/env python3\nimport os\nos.system("cd repo && claude -p go")\n',
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: ['loops'],
    })
  })

  it('cannot decide a non-shell script invoking an agent between backticks', async () => {
    const root = await repositoryWith([
      {
        path: 'bin/fix.rb',
        content: '#!/usr/bin/env ruby\nputs `cd repo && claude -p go`\n',
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: ['loops'],
    })
  })

  it('reads no invocation in a log line that begins with an agent name, because two bare words are prose', async () => {
    const root = await repositoryWith([
      {
        path: 'bin/log.js',
        content: '#!/usr/bin/env node\nconsole.log(`claude finished`)\n',
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  it('reads no invocation in a template literal that names an agent mid-sentence', async () => {
    const root = await repositoryWith([
      {
        path: 'bin/log.js',
        content: '#!/usr/bin/env node\nconst f = "x"\nconsole.log(`ran claude on ${f}`)\n',
        executable: true,
      },
    ])

    await expect(
      capabilitiesAndUndecidable(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ),
    ).resolves.toEqual({
      capabilities: [],
      undecidable: [],
    })
  })

  // The parser tables are closed lists too: an entry nothing holds is a guard nobody checked.
  describe('the parser tables, each entry pinned by the reading it alone makes possible', () => {
    it.each([
      'env',
      'command',
      'exec',
      'nohup',
      'sudo',
      'time',
      'timeout 300',
      'nice',
      'stdbuf -oL',
      'setsid',
      'xargs',
      'npx',
      'bunx',
      'pnpx',
      'uvx',
      'dlx',
    ])(
      'sees the agent a %s prefix runs, because the command position passes through it',
      async (prefix) => {
        const root = await repositoryWith([
          {
            path: 'scripts/retry.sh',
            content: `#!/bin/bash\nuntil pnpm check; do\n  ${prefix} claude -p "fix"\ndone\n`,
            executable: true,
          },
        ])

        await expect(
          capabilitiesAndUndecidable(
            scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
          ),
        ).resolves.toEqual({
          capabilities: ['loops'],
          undecidable: [],
        })
      },
    )

    it('decides against loops for a flag-file loop, and that decision is deliberate', async () => {
      const root = await repositoryWith([
        {
          path: 'scripts/agent.sh',
          content: '#!/bin/bash\nwhile [ -f .migration-lock ]; do\n  claude -p "continue"\ndone\n',
          executable: true,
        },
      ])

      // SAFETY: The rare branch that answers a decided NO rather than "undecidable", and a decided
      // NO becomes NOT_MET downstream — a practice gap. It is right under the product's own
      // definition: `loops` is "a script re-runs the AI until a project command passes", and `[ -f
      // .migration-lock ]` tests a file, not the outcome of a build, test or check. Admitting
      // `test` as a project command instead would let `while [ $i -lt 10 ]` grant Silver to a
      // repository that never built a retry loop.
      await expect(
        capabilitiesAndUndecidable(
          scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
        ),
      ).resolves.toEqual({
        capabilities: [],
        undecidable: [],
      })
    })

    it.each([
      ['true', 'while true'],
      ['false', 'until false'],
      [':', 'while :'],
      ['[', 'while [ -f .keep ]'],
      ['[[', 'while [[ -f .keep ]]'],
      ['test', 'while test -f .keep'],
      ['read', 'while read -r line'],
      ['!', 'while ! :'],
    ])(
      'does not mistake %s for a project command whose exit status the loop hangs on',
      async (_entry, header) => {
        const root = await repositoryWith([
          {
            path: 'scripts/retry.sh',
            content: `#!/bin/bash\n${header}; do\n  claude -p "go"\ndone\n`,
            executable: true,
          },
        ])

        // The header runs nothing of the project's, so nothing gates the continuation.
        await expect(
          capabilitiesAndUndecidable(
            scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
          ),
        ).resolves.toEqual({
          capabilities: [],
          undecidable: [],
        })
      },
    )

    // INVARIANT: every keyword sits on the same line as the word it opens a command position for: a
    // newline is a separator and would mark that word anyway, so a fixture wrapping after the
    // keyword pins nothing.
    const KEYWORD_SHAPES = [
      ['do', '#!/bin/bash\nuntil pnpm check; do claude -p "fix"; done\n'],
      ['if', '#!/bin/bash\nwhile true; do claude -p fix; if pnpm check; then break; fi; done\n'],
      ['then', '#!/bin/bash\nwhile true; do claude -p fix; if pnpm check; then break; fi; done\n'],
      [
        'else',
        '#!/bin/bash\nwhile true; do claude -p fix; if grep -q x f; then :; else break; fi; done\n',
      ],
      [
        'elif',
        '#!/bin/bash\nwhile true; do claude -p fix; if grep -q x f; then :; elif pnpm check; then break; fi; done\n',
      ],
      ['until', '#!/bin/bash\nuntil pnpm check; do claude -p "fix"; done\n'],
      ['while', '#!/bin/bash\nwhile claude -p "fix" && ! pnpm check; do sleep 1; done\n'],
      ['!', '#!/bin/bash\nwhile ! pnpm check; do claude -p "fix"; done\n'],
      ['{', '#!/bin/bash\nf() { claude -p "fix"; }\nuntil pnpm check; do f; done\n'],
      ['}', '#!/bin/bash\nuntil pnpm check; do { claude -p "fix"; } done\n'],
    ] as const

    it.each(KEYWORD_SHAPES)(
      'reads the command position %s opens, and proves the retry that hangs on it',
      async (_keyword, script) => {
        const root = await repositoryWith([
          { path: 'scripts/retry.sh', content: script, executable: true },
        ])

        await expect(
          capabilitiesAndUndecidable(
            scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
          ),
        ).resolves.toEqual({
          capabilities: ['loops'],
          undecidable: [],
        })
      },
    )

    it('reads an argv list no recognised spawner is handed, because a literal that begins with an agent is one', async () => {
      const root = await repositoryWith([
        {
          // No spawner call anywhere, so the argv entry's shape is the only route left.
          path: 'bin/argv.js',
          content:
            '#!/usr/bin/env node\nconst argv = ["claude", "-p", "go"]\nmodule.exports = argv\n',
          executable: true,
        },
      ])

      await expect(
        capabilitiesAndUndecidable(
          scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
        ),
      ).resolves.toEqual({
        capabilities: [],
        undecidable: ['loops'],
      })
    })

    const PY = '#!/usr/bin/env python3\nimport subprocess, os\n'
    const JS = '#!/usr/bin/env node\n'
    const LINE = '("cd r && claude -p go")'

    it.each([
      ['run', `${PY}subprocess.run${LINE}\n`, 'bin/a.py'],
      ['execFile', `${JS}execFile${LINE}\n`, 'bin/b.js'],
      ['execFileSync', `${JS}execFileSync${LINE}\n`, 'bin/c.js'],
      ['execSync', `${JS}execSync${LINE}\n`, 'bin/d.js'],
      ['spawn', `${JS}spawn${LINE}\n`, 'bin/e.js'],
      ['spawnSync', `${JS}spawnSync${LINE}\n`, 'bin/f.js'],
      ['system', `${PY}os.system${LINE}\n`, 'bin/g.py'],
      ['popen', `${PY}os.popen${LINE}\n`, 'bin/h.py'],
      ['Popen', `${PY}subprocess.Popen${LINE}\n`, 'bin/i.py'],
      ['check_call', `${PY}subprocess.check_call${LINE}\n`, 'bin/j.py'],
      ['check_output', `${PY}subprocess.check_output${LINE}\n`, 'bin/k.py'],
    ])('reads a command line handed to %s', async (_spawner, content, path) => {
      const root = await repositoryWith([{ path, content, executable: true }])

      await expect(
        capabilitiesAndUndecidable(
          scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
        ),
      ).resolves.toEqual({
        capabilities: [],
        undecidable: ['loops'],
      })
    })
  })

  describe('provenBy, the paths that earned each member', () => {
    it('names the path that proved each of the four members on a fully proven tree', async () => {
      const root = await repositoryWith([
        { path: 'session.md' },
        { path: 'CLAUDE.md' },
        { path: '.claude/rules/style.md' },
        { path: 'scripts/retry.sh', content: AGENT_LOOP_ON_EXIT_STATUS, executable: true },
      ])

      await expect(
        scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded),
      ).resolves.toEqual({
        capabilities: ['prompts', 'context-engineering', 'behavior', 'loops'],
        undecidable: [],
        provenBy: {
          prompts: { kind: 'files', paths: ['session.md'] },
          'context-engineering': { kind: 'files', paths: ['CLAUDE.md'] },
          behavior: { kind: 'files', paths: ['.claude/rules/style.md'] },
          loops: { kind: 'files', paths: ['scripts/retry.sh'] },
        },
      })
    })

    it('proves prompts by the commit trailer alone when no transcript sits in the tree', async () => {
      const root = await repositoryWith([{ path: 'README.md' }])

      const scan = await scanHarness(await trackedTree(root, unbounded), A_TRAILER, unbounded)

      expect(scan.capabilities).toContain('prompts')
      expect(scan.provenBy.prompts).toEqual({ kind: 'commit-trailer' })
    })

    it('proves prompts by a tracked session.md, never by the trailer, when no trailer is present', async () => {
      const root = await repositoryWith([{ path: 'session.md' }])

      const scan = await scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded)

      expect(scan.capabilities).toContain('prompts')
      expect(scan.provenBy.prompts).toEqual({ kind: 'files', paths: ['session.md'] })
    })

    it('names the file, never the trailer, when both a tracked transcript and a commit trailer prove prompts', async () => {
      const root = await repositoryWith([{ path: 'session.md' }])

      const scan = await scanHarness(await trackedTree(root, unbounded), A_TRAILER, unbounded)

      expect(scan.capabilities).toContain('prompts')
      expect(scan.provenBy.prompts).toEqual({ kind: 'files', paths: ['session.md'] })
    })

    it('names every path that proves context-engineering, in tree order', async () => {
      const root = await repositoryWith([
        { path: 'CLAUDE.md' },
        { path: 'aidd_docs/memory/architecture.md' },
      ])

      const scan = await scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded)

      expect(scan.provenBy['context-engineering']).toEqual({
        kind: 'files',
        paths: ['CLAUDE.md', 'aidd_docs/memory/architecture.md'],
      })
    })

    it('names only the first of two scripts that both prove loops, in tree order', async () => {
      const root = await repositoryWith([
        { path: 'scripts/a-retry.sh', content: AGENT_LOOP_ON_EXIT_STATUS, executable: true },
        { path: 'scripts/b-retry.sh', content: AGENT_LOOP_ON_EXIT_STATUS, executable: true },
      ])

      const scan = await scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded)

      expect(scan.provenBy.loops).toEqual({ kind: 'files', paths: ['scripts/a-retry.sh'] })
    })

    it('reports nothing for behavior when a tracked settings file cannot be read and no other guardrail is tracked', async () => {
      const root = await repositoryWith([
        {
          path: '.claude/settings.json',
          content: A_PERMISSION_ALLOW_LIST,
          deletedFromTheWorkingCopy: true,
        },
      ])

      const scan = await scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded)

      expect(scan.capabilities).not.toContain('behavior')
      expect(scan.undecidable).toContain('behavior')
      expect(scan.provenBy.behavior).toEqual({ kind: 'nothing' })
    })

    const PROVEN_BY_INVARIANT_TREES: ReadonlyArray<readonly [string, readonly FileSpec[]]> = [
      [
        'a fully proven tree',
        [
          { path: 'session.md' },
          { path: 'CLAUDE.md' },
          { path: '.claude/rules/style.md' },
          { path: 'scripts/retry.sh', content: AGENT_LOOP_ON_EXIT_STATUS, executable: true },
        ],
      ],
      ['an empty tree', [{ path: 'README.md' }]],
    ]

    it.each(PROVEN_BY_INVARIANT_TREES)(
      'carries a proof other than nothing exactly when the member is in capabilities, on %s',
      async (_label, files) => {
        const root = await repositoryWith(files)

        const scan = await scanHarness(await trackedTree(root, unbounded), NO_TRAILER, unbounded)

        for (const member of ['prompts', 'context-engineering', 'behavior', 'loops'] as const) {
          expect(scan.provenBy[member].kind !== 'nothing').toBe(scan.capabilities.includes(member))
        }
      },
    )
  })
})
