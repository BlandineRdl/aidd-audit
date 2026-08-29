import {
  basenameOf,
  endOfCall,
  type FunctionBody,
  markAt,
  markCommandPositions,
  startsAWord,
  stripArithmetic,
  stripShellNoise,
  tokenAt,
  tokenize,
} from './shell-tokens.js'

// INVARIANT: Nothing here proves `loops`; it can only make it undecidable, an evidence gap. Nothing
// outside shell is parsed, so the only question is whether a file carries the shape of an
// invocation. Two shapes count: a literal beginning with an agent command, how every language
// writes an argv entry — `subprocess.run(["claude", "-p", "go"])`; and a literal handed to a
// recognised spawner or written between backticks, read as the command line it is — `system("cd
// repo && claude -p go")`. A bare token is neither: `require('anthropic')` binds a name and
// `gemini.generate_content()` calls a method, and a file whose tokens are not invocations was read
// fine and decides nothing, so it leaves the scan silent.

const AGENT_COMMANDS = ['claude', 'codex', 'gemini', 'aider', 'cursor-agent']

const AGENT_INVOCATION_HEAD = new RegExp(
  `^\\s*(?:[^\\s'"]*/)?(${AGENT_COMMANDS.join('|')})(\\s|$)`,
  'i',
)

// Matched on the name alone, so `subprocess.run` needs no entry — `run` reaches it.
const PROCESS_SPAWNERS = [
  'run',
  'execFile',
  'execFileSync',
  'execSync',
  'spawn',
  'spawnSync',
  'system',
  'popen',
  'Popen',
  'check_call',
  'check_output',
]

export function looksLikeAnAgentInvocation(content: string): boolean {
  const { code, literals } = stripCommentsAndLiterals(content)

  if (literals.some((literal) => beginsACommand(literal.text))) return true

  return spawnedCommandLines(code, literals).some(invokesAgentInCommandPosition)
}

// Two bare words are prose: `claude finished` is a log line, not an invocation.
function beginsACommand(literal: string): boolean {
  const head = AGENT_INVOCATION_HEAD.exec(literal)
  if (head === null) return false

  const rest = literal.slice(head[0].length).trim()
  return rest.length === 0 || COMMAND_LIKE.test(rest)
}

// A flag, or an operator joining commands. Either says the words around it are a command.
const COMMAND_LIKE = /(^|\s)-{1,2}[A-Za-z0-9]|&&|\|\||;|\|/

// A backtick is a command in Ruby and a template literal in JS, so it faces the same test.
function invokesAgentInCommandPosition(line: string): boolean {
  if (!COMMAND_LIKE.test(line) && !AGENT_COMMANDS.includes(basenameOf(line.trim()))) return false

  const tokens = tokenize(stripArithmetic(stripShellNoise(line)))
  return invokesAgent(tokens, markCommandPositions(tokens), 0, tokens.length, new Map())
}

// SAFETY: built once, not once per scanned file. Every name is word characters only, so none needs
// escaping; `matchAll` clones the pattern rather than advancing it, so sharing one is safe.
const SPAWNER_CALLS: readonly RegExp[] = PROCESS_SPAWNERS.map(
  (spawner) => new RegExp(`(^|[^A-Za-z0-9_$])${spawner}\\s*\\(`, 'g'),
)

function spawnedCommandLines(code: string, literals: readonly Literal[]): readonly string[] {
  const lines = literals.filter((literal) => literal.backQuoted).map((literal) => literal.text)

  for (const call of SPAWNER_CALLS) {
    for (const match of code.matchAll(call)) {
      const open = match.index + match[0].length - 1
      const region = code.slice(open, endOfCall(code, open))

      for (const [, index] of region.matchAll(PLACEHOLDER)) {
        const literal = literals[Number(index)]
        if (literal !== undefined) lines.push(literal.text)
      }
    }
  }

  return lines
}

interface Literal {
  readonly text: string
  readonly backQuoted: boolean
}

// Marks where a literal stood, so a spawner's arguments can be recovered from `code`.
const PLACEHOLDER = /\u0000(\d+)\u0000/g

const placeholderFor = (index: number): string => `\u0000${index}\u0000`

// Language-agnostic: it parses nothing, it removes where an agent's name carries no call.
function stripCommentsAndLiterals(source: string): { code: string; literals: Literal[] } {
  let code = ''
  const literals: Literal[] = []
  let index = 0

  while (index < source.length) {
    if (source.startsWith('//', index) || (source[index] === '#' && startsAWord(source, index))) {
      while (index < source.length && source[index] !== '\n') index++
      continue
    }

    if (source.startsWith('/*', index)) {
      const close = source.indexOf('*/', index + 2)
      index = close === -1 ? source.length : close + 2
      code += ' '
      continue
    }

    const triple = TRIPLE_QUOTES.find((quotes) => source.startsWith(quotes, index))
    if (triple !== undefined) {
      const close = source.indexOf(triple, index + triple.length)
      const end = close === -1 ? source.length : close
      code += placeholderFor(literals.length)
      literals.push({ text: source.slice(index + triple.length, end), backQuoted: false })
      index = close === -1 ? source.length : close + triple.length
      continue
    }

    const quote = source[index] ?? ''
    if (quote === "'" || quote === '"' || quote === '`') {
      let cursor = index + 1
      let literal = ''
      while (cursor < source.length && source[cursor] !== quote) {
        if (source[cursor] === '\\') {
          cursor += 2
          literal += ' '
          continue
        }
        literal += source[cursor]
        cursor++
      }
      code += placeholderFor(literals.length)
      literals.push({ text: literal, backQuoted: quote === '`' })
      index = cursor + 1
      continue
    }

    code += quote
    index++
  }

  return { code, literals }
}

const TRIPLE_QUOTES = ['"""', "'''"]

export function invokesAgent(
  tokens: readonly string[],
  marks: readonly boolean[],
  start: number,
  end: number,
  functions: ReadonlyMap<string, FunctionBody>,
  visited: ReadonlySet<string> = new Set(),
): boolean {
  for (let index = start; index < end; index++) {
    if (!markAt(marks, index)) continue

    const command = basenameOf(tokenAt(tokens, index))
    if (AGENT_COMMANDS.includes(command)) return true

    const body = functions.get(command)
    if (body === undefined || visited.has(command)) continue
    if (
      invokesAgent(tokens, marks, body.start, body.end, functions, new Set([...visited, command]))
    ) {
      return true
    }
  }
  return false
}
