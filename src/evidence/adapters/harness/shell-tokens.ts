export function endOfCall(code: string, open: number): number {
  let depth = 0

  for (let index = open; index < code.length; index++) {
    if (code[index] === '(') depth++
    else if (code[index] === ')') {
      depth--
      if (depth === 0) return index + 1
    }
  }

  return code.length
}

// COMPAT: The shell expands parameters inside double quotes and not inside single quotes, so
// single-quoted content is dropped whole while double-quoted content keeps its expansions and drops
// its words: an agent named in an echoed message is not an invocation, and `while [ "$rc" -ne 0 ]`
// — the quoting ShellCheck mandates — still reads as a loop hanging on a status. Line breaks
// survive either way; losing one would move a command position.
export function stripShellNoise(source: string): string {
  let out = ''
  let index = 0

  while (index < source.length) {
    const character = source[index] ?? ''

    if (character === '#' && startsAWord(source, index)) {
      while (index < source.length && source[index] !== '\n') index++
      continue
    }
    if (character === '\\') {
      // Also swallows a line continuation, which is what the shell does.
      out += ' '
      index += 2
      continue
    }
    if (character === "'" || character === '"') {
      const quoted =
        character === "'"
          ? readSingleQuoted(source, index + 1)
          : readDoubleQuoted(source, index + 1)
      out += quoted.text
      index = quoted.end
      continue
    }

    out += character
    index++
  }

  return out
}

interface Quoted {
  readonly text: string
  readonly end: number
}

function readSingleQuoted(source: string, from: number): Quoted {
  let breaks = ''
  let index = from

  while (index < source.length && source[index] !== "'") {
    if (source[index] === '\n') breaks += '\n'
    index++
  }

  return { text: ` ${breaks} `, end: index + 1 }
}

function readDoubleQuoted(source: string, from: number): Quoted {
  let text = ' '
  let index = from

  while (index < source.length && source[index] !== '"') {
    const character = source[index] ?? ''

    if (character === '\\') {
      index += 2
      continue
    }
    if (character === '\n') {
      text += '\n'
      index++
      continue
    }
    if (character === '$') {
      const expansion = readExpansion(source, index)
      text += expansion.text
      index = expansion.end
      continue
    }

    index++
  }

  return { text: `${text} `, end: index + 1 }
}

// Shaped as a reference to a name nothing assigns, so the unsettled-origin rule covers it.
const COMMAND_SUBSTITUTION = '$__command_substitution__'

// `$?`, `$name` and `${name}` are the references this module reads; the rest are noise.
function readExpansion(source: string, from: number): Quoted {
  const next = source[from + 1] ?? ''

  if (next === '?') return { text: ' $? ', end: from + 2 }
  if (next === '{') {
    const close = source.indexOf('}', from + 2)
    if (close === -1) return { text: ' ', end: source.length }
    return { text: ` ${source.slice(from, close + 1)} `, end: close + 1 }
  }
  if (next === '(') {
    // SAFETY: A header that ran `$( … )` is not one this module has read, so it leaves a mark. No
    // bracket: the tokeniser splits those, and a stray `)` in command position would read as the
    // very command the substitution was hiding.
    return { text: ` ${COMMAND_SUBSTITUTION} `, end: endOfCall(source, from + 1) }
  }
  if (/[A-Za-z_]/.test(next)) {
    let end = from + 1
    while (/[A-Za-z0-9_]/.test(source[end] ?? '')) end++
    return { text: ` ${source.slice(from, end)} `, end }
  }

  return { text: ' ', end: from + 1 }
}

export function startsAWord(source: string, index: number): boolean {
  if (index === 0) return true
  const previous = source[index - 1] ?? ''
  return /[\s;&|(]/.test(previous)
}

// `((...))` is arithmetic, not a command whose exit status gates anything.
export const stripArithmetic = (code: string): string => code.replace(/\(\([^()]*\)\)/g, ' : ')

const TOKEN_PATTERN = /&&|\|\||;;|;|\||&|\(|\)|\n|[^\s;|&()\n]+/g

export function tokenize(code: string): readonly string[] {
  return (code.match(TOKEN_PATTERN) ?? []).map((token) =>
    token === '\n' || token === ';;' ? ';' : token,
  )
}

export const SEPARATORS = new Set([';', '&&', '||', '|', '&', '(', ')'])

export const KEYWORDS_BEFORE_COMMAND = new Set([
  'do',
  'then',
  'else',
  'elif',
  'if',
  'while',
  'until',
  '!',
  '{',
  '}',
])

// SAFETY: A prefix runs the word after it, so the command position passes through — past the
// prefix's own operands, as `timeout 300 claude` needs. An unlisted wrapper hides the call behind
// it.
const COMMAND_PREFIXES = new Set([
  'env',
  'command',
  'exec',
  'nohup',
  'sudo',
  'time',
  'timeout',
  'nice',
  'stdbuf',
  'setsid',
  'xargs',
  'npx',
  'bunx',
  'pnpx',
  'uvx',
  'dlx',
])

// An option, or a duration or a niceness: a prefix's own operand, never its command.
const OPERAND_OF_A_PREFIX = /^-|^\d+(\.\d+)?[smhd]?$/

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/

const SHELL_NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/

// INVARIANT: Constructs a loop may hang on without any separate command of the project's being run.
// `read` belongs here: `while read -r line` consumes input, and iterating is not re-running.
// Closing brackets never reach a command position, so no test could hold an entry for them.
export const NOT_A_COMMAND = new Set(['true', 'false', ':', '[', '[[', 'test', 'read', '!'])

export function markCommandPositions(tokens: readonly string[]): readonly boolean[] {
  const marks: boolean[] = tokens.map((_token, index) => {
    if (index === 0) return true
    const previous = tokenAt(tokens, index - 1)
    return SEPARATORS.has(previous) || KEYWORDS_BEFORE_COMMAND.has(previous)
  })

  // INVARIANT: An assignment or a prefix such as `env` hands the command position on, always to the
  // right, so one forward pass resolves a chain of them.
  for (let index = 0; index < tokens.length; index++) {
    if (!markAt(marks, index)) continue
    const token = tokenAt(tokens, index)

    if (COMMAND_PREFIXES.has(token)) {
      const target = indexOfPrefixTarget(tokens, index + 1)
      if (target !== -1) marks[target] = true
      continue
    }
    if (!ASSIGNMENT.test(token)) continue

    const next = index + 1
    if (next < tokens.length && !SEPARATORS.has(tokenAt(tokens, next))) marks[next] = true
  }

  return marks
}

function indexOfPrefixTarget(tokens: readonly string[], from: number): number {
  for (let index = from; index < tokens.length; index++) {
    const token = tokenAt(tokens, index)
    if (SEPARATORS.has(token)) return -1
    if (OPERAND_OF_A_PREFIX.test(token)) continue
    return index
  }
  return -1
}

export interface FunctionBody {
  readonly start: number
  readonly end: number
}

// INVARIANT: A loop calling a function defined beside it invokes whatever that function invokes, so
// `run_agent() { claude -p fix; }` with `until pnpm check; do run_agent; done` is a retry loop.
export function findFunctionBodies(
  tokens: readonly string[],
  marks: readonly boolean[],
): ReadonlyMap<string, FunctionBody> {
  const bodies = new Map<string, FunctionBody>()

  for (let index = 0; index < tokens.length; index++) {
    let nameIndex = -1
    let braceIndex = -1

    if (
      tokenAt(tokens, index) === '(' &&
      tokenAt(tokens, index + 1) === ')' &&
      index >= 1 &&
      markAt(marks, index - 1) &&
      SHELL_NAME.test(tokenAt(tokens, index - 1))
    ) {
      nameIndex = index - 1
      braceIndex = index + 2
    } else if (
      markAt(marks, index) &&
      tokenAt(tokens, index) === 'function' &&
      SHELL_NAME.test(tokenAt(tokens, index + 1))
    ) {
      nameIndex = index + 1
      braceIndex = index + 2
      if (tokenAt(tokens, braceIndex) === '(' && tokenAt(tokens, braceIndex + 1) === ')') {
        braceIndex += 2
      }
    }

    if (nameIndex === -1 || tokenAt(tokens, braceIndex) !== '{') continue

    const end = indexOfMatchingBrace(tokens, braceIndex + 1)
    if (end === -1) continue

    bodies.set(tokenAt(tokens, nameIndex), { start: braceIndex + 1, end })
  }

  return bodies
}

function indexOfMatchingBrace(tokens: readonly string[], from: number): number {
  let depth = 0

  for (let index = from; index < tokens.length; index++) {
    const token = tokenAt(tokens, index)
    if (token === '{') depth++
    else if (token === '}') {
      if (depth === 0) return index
      depth--
    }
  }

  return -1
}

export const basenameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

export const tokenAt = (tokens: readonly string[], index: number): string => tokens[index] ?? ''

export const markAt = (marks: readonly boolean[], index: number): boolean => marks[index] ?? false
