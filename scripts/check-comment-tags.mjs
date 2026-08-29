import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// `.claude/rules/01-standards/1-comments.md`, made mechanical — see `coding-assertions.md`.

const TAGS = ['INVARIANT', 'SAFETY', 'COMPAT', 'LIMITATION']
const TAGGED = new RegExp(`^//\\s*(${TAGS.join('|')}):`)
const GOVERNED = /^(src\/.*\.ts|tests\/.*\.ts|scripts\/.*\.mjs)$/

const git = (args) => execFileSync('git', args, { encoding: 'utf8' })
const lines = (output) => output.split('\n').filter((line) => line !== '')

function changedFiles() {
  const paths = [
    ...sinceMain(),
    ...lines(git(['diff', '--name-only', 'HEAD'])),
    ...lines(git(['ls-files', '--others', '--exclude-standard'])),
  ]
  return [...new Set(paths)].filter((path) => GOVERNED.test(path))
}

function sinceMain() {
  try {
    const base = git(['merge-base', 'HEAD', 'main']).trim()
    return lines(git(['diff', '--name-only', `${base}...HEAD`]))
  } catch {
    // LIMITATION: no main to compare against — a fresh clone, or another trunk.
    // The working tree alone is judged.
    return []
  }
}

function offencesIn(path) {
  let source
  try {
    source = readFileSync(path, 'utf8')
  } catch {
    return [] // deleted or renamed away
  }

  const found = []
  let block = null

  const close = () => {
    if (block !== null && block.length >= 2 && !TAGGED.test(block.first)) {
      found.push({ ...block, why: 'declares no purpose' })
    }
    block = null
  }

  for (const [index, raw] of source.split('\n').entries()) {
    const line = raw.trim()
    if (line.startsWith('/*')) {
      close()
      found.push({ line: index + 1, first: line, why: 'is a docblock' })
      continue
    }
    if (line.startsWith('//')) {
      block ??= { line: index + 1, first: line, length: 0 }
      block.length += 1
      continue
    }
    close()
  }
  close()
  return found
}

const offences = changedFiles().flatMap((path) =>
  offencesIn(path).map((offence) => ({ path, ...offence })),
)

if (offences.length === 0) {
  console.log('✔ comments in the changed files are `//`, and every block declares its purpose')
  process.exit(0)
}

console.error(`✖ ${offences.length} comment(s) break the rule\n`)
for (const offence of offences) {
  console.error(`  ${offence.path}:${offence.line}  ${offence.why} — ${offence.first.slice(0, 56)}`)
}
console.error(`\nComments are \`//\`. A block of two or more opens with one of:`)
console.error(`  ${TAGS.map((tag) => `${tag}:`).join(' ')}`)
console.error('Or cut it — see .claude/rules/01-standards/1-comments.md')
process.exit(1)
