/**
 * A dependency-cruiser rule that matches nothing reports success, so a green
 * `pnpm architecture` is ambiguous: the wall may be intact, or absent. This
 * writes one deliberate violation per rule and fails unless every rule fired.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const PREFIX = '__boundary-sentinel__'
const SRC = 'src'

/**
 * Matched on the pair (`rule`, `from`), never the rule name alone: that is what
 * stops one sentinel from vouching for another. A rule may need several.
 */
const SENTINELS = [
  {
    rule: 'maturity-is-a-peer',
    from: 'src/maturity/usecases/__boundary-sentinel__peer.ts',
    files: {
      'src/evidence/models/__boundary-sentinel__target.ts': 'export const target = 1\n',
      'src/maturity/usecases/__boundary-sentinel__peer.ts':
        "import { target } from '../../evidence/models/__boundary-sentinel__target.js'\nexport const breach = target\n",
    },
  },
  {
    rule: 'evidence-is-a-peer',
    from: 'src/evidence/usecases/__boundary-sentinel__peer.ts',
    files: {
      'src/maturity/models/__boundary-sentinel__target.ts': 'export const target = 1\n',
      'src/evidence/usecases/__boundary-sentinel__peer.ts':
        "import { target } from '../../maturity/models/__boundary-sentinel__target.js'\nexport const breach = target\n",
    },
  },
  {
    rule: 'assessment-composes-never-adapts',
    from: 'src/assessment/usecases/__boundary-sentinel__adapter.ts',
    files: {
      'src/maturity/adapters/__boundary-sentinel__target.ts': 'export const target = 1\n',
      'src/assessment/usecases/__boundary-sentinel__adapter.ts':
        "import { target } from '../../maturity/adapters/__boundary-sentinel__target.js'\nexport const breach = target\n",
    },
  },
  {
    // The rule reaches adapters/ and loading/; a sentinel in one proves
    // nothing about the other.
    rule: 'assessment-composes-never-adapts',
    from: 'src/assessment/usecases/__boundary-sentinel__loading.ts',
    files: {
      'src/maturity/loading/__boundary-sentinel__target.ts': 'export const target = 1\n',
      'src/assessment/usecases/__boundary-sentinel__loading.ts':
        "import { target } from '../../maturity/loading/__boundary-sentinel__target.js'\nexport const breach = target\n",
    },
  },
  {
    rule: 'assessment-never-depends-on-cli',
    from: 'src/assessment/usecases/__boundary-sentinel__cli.ts',
    files: {
      'src/cli/__boundary-sentinel__target.ts': 'export const target = 1\n',
      'src/assessment/usecases/__boundary-sentinel__cli.ts':
        "import { target } from '../../cli/__boundary-sentinel__target.js'\nexport const breach = target\n",
    },
  },
  {
    rule: 'domain-has-no-filesystem',
    from: 'src/maturity/usecases/__boundary-sentinel__fs.ts',
    files: {
      'src/maturity/usecases/__boundary-sentinel__fs.ts':
        "import { readFileSync } from 'node:fs'\nexport const breach = readFileSync\n",
    },
  },
  {
    rule: 'domain-has-no-processes',
    from: 'src/maturity/usecases/__boundary-sentinel__proc.ts',
    files: {
      'src/maturity/usecases/__boundary-sentinel__proc.ts':
        "import { execSync } from 'node:child_process'\nexport const breach = execSync\n",
    },
  },
  {
    rule: 'domain-has-no-vendor-sdk',
    from: 'src/maturity/usecases/__boundary-sentinel__vendor.ts',
    files: {
      'src/maturity/usecases/__boundary-sentinel__vendor.ts':
        "import { parse } from 'yaml'\nexport const breach = parse\n",
    },
  },
  {
    // A devDependency resolves to `npm-dev`, not `npm`. Without this case the
    // rule can be narrowed back to `['npm']` and still look proven.
    rule: 'domain-has-no-vendor-sdk',
    from: 'src/maturity/usecases/__boundary-sentinel__vendor-dev.ts',
    files: {
      'src/maturity/usecases/__boundary-sentinel__vendor-dev.ts':
        "import ts from 'typescript'\nexport const breach = ts\n",
    },
  },
  {
    // Every rule widened into a folder needs its own sentinel there: one rule's
    // sentinel proves nothing about the others sharing that path.
    rule: 'domain-has-no-filesystem',
    from: 'src/maturity/engine/__boundary-sentinel__fs.ts',
    files: {
      'src/maturity/engine/__boundary-sentinel__fs.ts':
        "import { readFileSync } from 'node:fs'\nexport const breach = readFileSync\n",
    },
  },
  {
    rule: 'domain-has-no-processes',
    from: 'src/maturity/engine/__boundary-sentinel__proc.ts',
    files: {
      'src/maturity/engine/__boundary-sentinel__proc.ts':
        "import { execSync } from 'node:child_process'\nexport const breach = execSync\n",
    },
  },
  {
    rule: 'domain-has-no-vendor-sdk',
    from: 'src/maturity/engine/__boundary-sentinel__vendor.ts',
    files: {
      'src/maturity/engine/__boundary-sentinel__vendor.ts':
        "import { parse } from 'yaml'\nexport const breach = parse\n",
    },
  },
  {
    rule: 'domain-has-no-filesystem',
    from: 'src/evidence/resolution/__boundary-sentinel__fs.ts',
    files: {
      'src/evidence/resolution/__boundary-sentinel__fs.ts':
        "import { readFileSync } from 'node:fs'\nexport const breach = readFileSync\n",
    },
  },
  {
    rule: 'domain-has-no-processes',
    from: 'src/evidence/resolution/__boundary-sentinel__proc.ts',
    files: {
      'src/evidence/resolution/__boundary-sentinel__proc.ts':
        "import { execSync } from 'node:child_process'\nexport const breach = execSync\n",
    },
  },
  {
    rule: 'domain-has-no-vendor-sdk',
    from: 'src/evidence/resolution/__boundary-sentinel__vendor.ts',
    files: {
      'src/evidence/resolution/__boundary-sentinel__vendor.ts':
        "import { parse } from 'yaml'\nexport const breach = parse\n",
    },
  },
  {
    rule: 'no-circular',
    from: 'src/maturity/models/__boundary-sentinel__a.ts',
    files: {
      'src/maturity/models/__boundary-sentinel__a.ts':
        "import { b } from './__boundary-sentinel__b.js'\nexport const a = b\n",
      'src/maturity/models/__boundary-sentinel__b.ts':
        "import { a } from './__boundary-sentinel__a.js'\nexport const b = a\n",
    },
  },
]

/** Directories that did not exist before this run, deepest first for removal. */
const createdDirs = []

const ensureDir = (dir) => {
  if (existsSync(dir)) return
  ensureDir(dirname(dir))
  mkdirSync(dir)
  createdDirs.unshift(dir)
}

const sweepStaleSentinels = (dir) => {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) sweepStaleSentinels(path)
    else if (entry.name.startsWith(PREFIX)) rmSync(path)
  }
}

const write = () => {
  for (const { files } of SENTINELS) {
    for (const [path, content] of Object.entries(files)) {
      ensureDir(dirname(path))
      writeFileSync(path, content)
    }
  }
}

const cleanup = () => {
  for (const { files } of SENTINELS) {
    for (const path of Object.keys(files)) rmSync(path, { force: true })
  }
  for (const dir of createdDirs) {
    if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true })
  }
}

const cruise = () => {
  // The local bin, not the PATH: this script must run identically whether it is
  // invoked by a pnpm script or by hand.
  const run = spawnSync(join('node_modules', '.bin', 'depcruise'), [SRC, '--output-type', 'json'], {
    encoding: 'utf8',
  })
  if (!run.stdout) {
    throw new Error(`depcruise produced no output.\n${run.stderr ?? ''}`)
  }
  return new Set(
    (JSON.parse(run.stdout).summary?.violations ?? []).map(
      (violation) => `${violation.rule.name}|${violation.from}`,
    ),
  )
}

/**
 * `finally` does not run on a signal, and a surviving sentinel deadlocks the
 * gate: `pnpm architecture` cruises before it sweeps, so the leftover makes
 * depcruise exit 1 and the sweep below never gets its turn.
 */
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    cleanup()
    process.exit(130)
  })
}

sweepStaleSentinels(SRC)

let fired
try {
  write()
  fired = cruise()
} finally {
  cleanup()
}

const dead = SENTINELS.filter(({ rule, from }) => !fired.has(`${rule}|${from}`))

if (dead.length > 0) {
  console.error(
    `\n✖ ${dead.length} deliberate violation(s) did not trip their rule:\n` +
      dead.map(({ rule, from }) => `    ${rule}  (${from})`).join('\n') +
      '\n\n  Each rule matches nothing where its sentinel sits, so `pnpm architecture`\n' +
      '  proves nothing about the rule in that folder.\n' +
      '  Check .dependency-cruiser.cjs: `to.path` matches the RESOLVED module\n' +
      "  (`node:fs` resolves to `fs`), and `dependencyTypes: ['npm']` excludes `npm-dev`.\n",
  )
  process.exit(1)
}

const provenRules = new Set(SENTINELS.map(({ rule }) => rule)).size

console.log(`✔ ${provenRules} boundary rules proven with ${SENTINELS.length} deliberate violations`)
