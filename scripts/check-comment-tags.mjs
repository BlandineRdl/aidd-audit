import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// `.claude/rules/01-standards/1-comments.md`, made mechanical — see `coding-assertions.md`.

const TAGS = ['INVARIANT', 'SAFETY', 'COMPAT', 'LIMITATION']
const TAGGED = new RegExp(`^//\\s*(${TAGS.join('|')}):`)
const GOVERNED = /^(src\/.*\.ts|tests\/.*\.ts|scripts\/.*\.mjs)$/

// `--others` so a new file is judged before it is ever tracked.
function governedFiles() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter((path) => GOVERNED.test(path))
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
      // A single-line `/* ... */` carrying code after it is a pragma, not a docblock.
      const spans = !line.includes('*/')
      if (line.startsWith('/**') || spans) {
        found.push({ line: index + 1, first: line, why: 'is a docblock' })
      }
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

const offences = governedFiles().flatMap((path) =>
  offencesIn(path).map((offence) => ({ path, ...offence })),
)

if (offences.length === 0) {
  console.log('✔ comments are `//`, and every block declares its purpose')
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
