import { open, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runGit } from './git-process.js'

/**
 * The `harness` scan of a local working copy. Its domain is the tracked tree (`git ls-files`),
 * never the working directory, and matching is by exact name: `prompt-*.md` would let
 * `prompt-toolkit-notes.md` prove `prompts`.
 *
 * A member is undecidable when a source that could have proven it, and that no other route has
 * proven, could not be read or parsed. Undecidable costs the whole axis as UNKNOWN, an honest
 * evidence gap; a CONFIRMED set with a member silently missing reads as NOT_MET, a practice
 * gap nobody observed and the outcome the brief forbids outright. Every closed table and
 * conservative branch below is weighed against that cost.
 */
export interface HarnessScan {
  /** Proven capability members, as a union set. Incomplete while `undecidable` names any. */
  readonly capabilities: readonly string[]
  /**
   * Members a source refused to answer for, in `capabilities`' vocabulary and order. A list,
   * because undecidability arrives by several routes at once.
   */
  readonly undecidable: readonly string[]
}

/** Every table below and every parser table further down is closed: widening one is a plan edit. */

/** A named file matches anywhere in the tracked tree: an artifact counts wherever it sits. */
const TRANSCRIPT_FILES = ['session.md', 'prompt-history.md', '.aider.chat.history.md']
/** A named directory matches at the root only. */
const TRANSCRIPT_DIRECTORIES = ['.specstory/', '.claude/history/']

const CONTEXT_FILES = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.github/copilot-instructions.md']
const CONTEXT_DIRECTORIES = ['aidd_docs/memory/', 'docs/context/', '.ai/']

const BEHAVIOR_DIRECTORIES = [
  '.claude/rules/',
  '.claude/agents/',
  '.claude/hooks/',
  '.claude/skills/',
  '.cursor/rules/',
  '.github/agents/',
]
const BEHAVIOR_FILES = ['.cursorrules', '.windsurfrules']
/** JSON only: a name here promises the recogniser below can read the file, schema and all. */
const SETTINGS_FILES = [
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.cursor/environment.json',
  '.gemini/settings.json',
]

const AGENT_COMMANDS = ['claude', 'codex', 'gemini', 'aider', 'cursor-agent']

/** Only shell is reliably recognisable, so only shell is decidable. */
const SHELL_INTERPRETERS = ['sh', 'bash', 'zsh']
const SHELL_EXTENSIONS = ['.sh', '.bash', '.zsh']

/** Enough to hold any shebang line; a script is only read in full once it is a candidate. */
const SHEBANG_PROBE_BYTES = 256

type HarnessMember = 'prompts' | 'context-engineering' | 'behavior' | 'loops'

/** The vocabulary, and the order both lists are reported in. */
const HARNESS_MEMBERS: readonly HarnessMember[] = [
  'prompts',
  'context-engineering',
  'behavior',
  'loops',
]

/**
 * `hasAiAttributionTrailer` comes from the commit walk with three answers: `true` proves
 * `prompts` on its own, with no transcript file in the tree; `false` is a history read and
 * holding none; `null` is a history unread, which makes `prompts` undecidable unless the tree
 * proves it another way.
 */
export async function scanHarness(
  path: string,
  hasAiAttributionTrailer: boolean | null,
  signal: AbortSignal,
): Promise<HarnessScan> {
  signal.throwIfAborted()

  // The subject may name a subdirectory, and `git ls-files` lists only what sits under its
  // working directory while the Git-derived axes walk the whole history: left to disagree, a
  // root `CLAUDE.md` goes unseen from `packages/api`. Reading from the root keeps listed paths
  // and opened paths in one frame; listing repository-wide would make every root file unread.
  const root = await repositoryRoot(path, signal)

  const tracked = await listTrackedEntries(root, signal)
  const paths = tracked.map((entry) => entry.path)

  const capabilities: string[] = []
  const undecidable = new Set<HarnessMember>()

  if (hasAiAttributionTrailer === true || provesPrompts(paths)) capabilities.push('prompts')
  if (hasAiAttributionTrailer === null) undecidable.add('prompts')

  if (provesContextEngineering(paths)) capabilities.push('context-engineering')

  signal.throwIfAborted()
  const behavior = await provesBehavior(root, tracked, signal)
  if (behavior.proven) capabilities.push('behavior')
  if (behavior.undecidable) undecidable.add('behavior')

  signal.throwIfAborted()
  const scripts = await scanScripts(root, tracked, signal)
  if (scripts.proven) capabilities.push('loops')
  if (scripts.undecidable) undecidable.add('loops')

  // A member already proven by another route suppresses undecidability about it: nothing is
  // hidden once the set is known to contain it.
  return {
    capabilities,
    undecidable: HARNESS_MEMBERS.filter(
      (member) => undecidable.has(member) && !capabilities.includes(member),
    ),
  }
}

/**
 * The mode is the one Git recorded, never the one the working copy carries: a clone with
 * `core.fileMode=false` reads `0644` off a `100755` file, failing the candidate gate below.
 */
interface TrackedEntry {
  readonly path: string
  readonly mode: string
}

async function repositoryRoot(path: string, signal: AbortSignal): Promise<string> {
  return (await runGit(path, ['rev-parse', '--show-toplevel'], signal)).trim()
}

async function listTrackedEntries(
  path: string,
  signal: AbortSignal,
): Promise<readonly TrackedEntry[]> {
  const listing = await runGit(path, ['ls-files', '-s', '-z'], signal)

  return listing
    .split('\0')
    .filter((entry) => entry.length > 0)
    .flatMap((entry) => {
      // `<mode> <object> <stage>\t<path>`, and `-z` leaves the path unquoted.
      const separator = entry.indexOf('\t')
      const mode = entry.slice(0, entry.indexOf(' '))
      if (separator === -1 || mode.length === 0) return []
      return [{ path: entry.slice(separator + 1), mode }]
    })
}

/** `100644` and `100755` are blobs in this tree; `120000` is a symlink, `160000` a submodule. */
const isRegularFileMode = (mode: string): boolean => mode.startsWith('100')
const isExecutableMode = (mode: string): boolean => mode === '100755'

function provesPrompts(tracked: readonly string[]): boolean {
  return (
    holdsFileNamedAnywhere(tracked, TRANSCRIPT_FILES) ||
    holdsPathUnderRootDirectory(tracked, TRANSCRIPT_DIRECTORIES)
  )
}

function provesContextEngineering(tracked: readonly string[]): boolean {
  return (
    holdsFileNamedAnywhere(tracked, CONTEXT_FILES) ||
    holdsPathUnderRootDirectory(tracked, CONTEXT_DIRECTORIES)
  )
}

interface MemberScan {
  readonly proven: boolean
  readonly undecidable: boolean
}

const DECIDED_PRESENT: MemberScan = { proven: true, undecidable: false }

async function provesBehavior(
  root: string,
  tracked: readonly TrackedEntry[],
  signal: AbortSignal,
): Promise<MemberScan> {
  const paths = tracked.map((entry) => entry.path)
  if (holdsPathUnderRootDirectory(paths, BEHAVIOR_DIRECTORIES)) return DECIDED_PRESENT
  if (holdsFileNamedAnywhere(paths, BEHAVIOR_FILES)) return DECIDED_PRESENT
  return declaresPermissions(root, paths, signal)
}

/** An empty allow/deny list is an observation; an unreadable or unparseable file is not. */
async function declaresPermissions(
  root: string,
  tracked: readonly string[],
  signal: AbortSignal,
): Promise<MemberScan> {
  let undecidable = false

  for (const settings of SETTINGS_FILES) {
    if (!tracked.includes(settings)) continue
    signal.throwIfAborted()

    const content = await readTextFile(join(root, settings))
    if (content === null) {
      undecidable = true
      continue
    }

    const document = parseSettings(content)
    if (!document.parsed) {
      undecidable = true
      continue
    }

    if (declaresPermissionList(document.value)) return DECIDED_PRESENT
  }

  return { proven: false, undecidable }
}

type ParsedSettings =
  | { readonly parsed: true; readonly value: unknown }
  | { readonly parsed: false }

function parseSettings(content: string): ParsedSettings {
  try {
    return { parsed: true, value: JSON.parse(content) }
  } catch {
    return { parsed: false }
  }
}

/** By shape, not by any tool's schema: covering another takes its filename and its shape. */
function declaresPermissionList(settings: unknown): boolean {
  if (typeof settings !== 'object' || settings === null) return false

  const permissions = (settings as { permissions?: unknown }).permissions
  if (typeof permissions !== 'object' || permissions === null) return false

  const { allow, deny } = permissions as { allow?: unknown; deny?: unknown }
  return isNonEmptyArray(allow) || isNonEmptyArray(deny)
}

const isNonEmptyArray = (value: unknown): boolean => Array.isArray(value) && value.length > 0

/**
 * A file is a candidate when it is executable in the recorded mode or carries a shell shebang,
 * and decidable when it is shell. Three routes make `loops` undecidable rather than absent,
 * each a source that could have proven it: an unreadable tracked file; a non-shell script that
 * looks like it invokes an agent; and a shell script invoking an agent inside a loop whose
 * continuation could not be classified. Reporting absence would tell a developer who built a
 * loop to go build a loop.
 */
async function scanScripts(
  root: string,
  tracked: readonly TrackedEntry[],
  signal: AbortSignal,
): Promise<MemberScan> {
  let loops = false
  let undecidable = false

  for (const entry of tracked) {
    signal.throwIfAborted()

    if (!isRegularFileMode(entry.mode)) continue

    const candidate = await readScriptCandidate(join(root, entry.path), entry.mode)
    if (candidate.outcome === 'not-a-script') continue
    if (candidate.outcome === 'unreadable') {
      undecidable = true
      continue
    }

    if (candidate.shell || hasShellExtension(entry.path)) {
      const shell = readShellLoops(candidate.content)
      if (shell.proven) loops = true
      if (shell.undecidable) undecidable = true
    } else if (looksLikeAnAgentInvocation(candidate.content)) {
      undecidable = true
    }
  }

  return { proven: loops, undecidable }
}

type ScriptCandidate =
  | { readonly outcome: 'not-a-script' }
  | { readonly outcome: 'unreadable' }
  | { readonly outcome: 'script'; readonly content: string; readonly shell: boolean }

/**
 * The probe comes first, so most of a tree is never read in full. One `try` covers everything,
 * so any failure is one unreadable source rather than a silently absent one.
 */
async function readScriptCandidate(absolute: string, mode: string): Promise<ScriptCandidate> {
  let handle: Awaited<ReturnType<typeof open>> | null = null
  try {
    handle = await open(absolute, 'r')
    const buffer = Buffer.alloc(SHEBANG_PROBE_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, SHEBANG_PROBE_BYTES, 0)
    const shell = hasShellShebang(buffer.subarray(0, bytesRead).toString('utf8'))

    if (!shell && !isExecutableMode(mode)) return { outcome: 'not-a-script' }

    return { outcome: 'script', content: await readFile(absolute, 'utf8'), shell }
  } catch {
    return { outcome: 'unreadable' }
  } finally {
    try {
      await handle?.close()
    } catch {
      // A file that cannot be closed cleanly still told us what we read.
    }
  }
}

function hasShellShebang(head: string): boolean {
  const firstLine = head.split('\n', 1)[0] ?? ''
  if (!firstLine.startsWith('#!')) return false

  return firstLine
    .slice(2)
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .some((word) => SHELL_INTERPRETERS.includes(basenameOf(word)))
}

const hasShellExtension = (file: string): boolean =>
  SHELL_EXTENSIONS.some((extension) => file.endsWith(extension))

/*
 * Nothing outside shell is parsed, so the only question is whether a file carries the shape of
 * an invocation. Two shapes count: a literal beginning with an agent command, how every
 * language writes an argv entry — `subprocess.run(["claude", "-p", "go"])`; and a literal
 * handed to a recognised spawner or written between backticks, read as the command line it is
 * — `system("cd repo && claude -p go")`. A bare token is neither: `require('anthropic')` binds
 * a name and `gemini.generate_content()` calls a method, and a file whose tokens are not
 * invocations was read fine and decides nothing, so it leaves the scan silent.
 */

const AGENT_INVOCATION_HEAD = new RegExp(
  `^\\s*(?:[^\\s'"]*/)?(${AGENT_COMMANDS.join('|')})(\\s|$)`,
  'i',
)

/** Matched on the name alone, so `subprocess.run` needs no entry — `run` reaches it. */
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

function looksLikeAnAgentInvocation(content: string): boolean {
  const { code, literals } = stripCommentsAndLiterals(content)

  if (literals.some((literal) => beginsACommand(literal.text))) return true

  return spawnedCommandLines(code, literals).some(invokesAgentInCommandPosition)
}

/** Two bare words are prose: `claude finished` is a log line, not an invocation. */
function beginsACommand(literal: string): boolean {
  const head = AGENT_INVOCATION_HEAD.exec(literal)
  if (head === null) return false

  const rest = literal.slice(head[0].length).trim()
  return rest.length === 0 || COMMAND_LIKE.test(rest)
}

/** A flag, or an operator joining commands. Either says the words around it are a command. */
const COMMAND_LIKE = /(^|\s)-{1,2}[A-Za-z0-9]|&&|\|\||;|\|/

/** A backtick is a command in Ruby and a template literal in JS, so it faces the same test. */
function invokesAgentInCommandPosition(line: string): boolean {
  if (!COMMAND_LIKE.test(line) && !AGENT_COMMANDS.includes(basenameOf(line.trim()))) return false

  const tokens = tokenize(stripArithmetic(stripShellNoise(line)))
  return invokesAgent(tokens, markCommandPositions(tokens), 0, tokens.length, new Map())
}

function spawnedCommandLines(code: string, literals: readonly Literal[]): readonly string[] {
  const lines = literals.filter((literal) => literal.backQuoted).map((literal) => literal.text)

  for (const spawner of PROCESS_SPAWNERS) {
    const call = new RegExp(`(^|[^A-Za-z0-9_$])${spawner.replace('.', '\\.')}\\s*\\(`, 'g')

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

function endOfCall(code: string, open: number): number {
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

interface Literal {
  readonly text: string
  readonly backQuoted: boolean
}

/** Marks where a literal stood, so a spawner's arguments can be recovered from `code`. */
const PLACEHOLDER = /\u0000(\d+)\u0000/g
const placeholderFor = (index: number): string => `\u0000${index}\u0000`

/** Language-agnostic: it parses nothing, it removes where an agent's name carries no call. */
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

/**
 * A loop invoking an agent has three answers, not two: `loops` when the continuation is
 * positively recognised as hanging on a separate command's exit status; decidably no when it is
 * positively recognised as not — a list iterated, input consumed, a counter counted;
 * undecidable only in between. The middle answer keeps an ordinary `for f in *.ts` or
 * `while read -r line` from costing the whole axis.
 */
function readShellLoops(source: string): MemberScan {
  const noise = stripShellNoise(source)
  const tokens = tokenize(stripArithmetic(noise))
  const commandPositions = markCommandPositions(tokens)
  const functions = findFunctionBodies(tokens, commandPositions)
  // Read before the arithmetic is stripped: `i=$((i+1))` is how a counter says what it is.
  const origins = readVariableOrigins(tokenize(noise))

  let undecidable = false

  for (const loop of findLoops(tokens, commandPositions)) {
    // The header is scanned with the body: `while claude -p fix && ! pnpm check; do` invokes
    // the agent in the condition, which is still an agent invoked by the loop.
    if (!invokesAgent(tokens, commandPositions, loop.headerStart, loop.bodyEnd, functions)) {
      continue
    }
    if (continuationDependsOnExitStatus(tokens, commandPositions, loop, origins.status)) {
      return DECIDED_PRESENT
    }
    // `for x in <list>` runs the agent once per item and no exit status decides whether it
    // runs again. `|| exit 1` inside one is fail-fast, which re-runs nothing either.
    if (loop.keyword === 'for') continue
    if (iterates(tokens, commandPositions, loop, origins)) continue

    undecidable = true
  }

  return { proven: false, undecidable }
}

/**
 * The header must reference nothing of unsettled origin — a counter, a `read` variable and a
 * literal qualify, a command substitution does not — and the body must hold no early stop,
 * since an unattributable `break` is where a retry may hide.
 */
function iterates(
  tokens: readonly string[],
  marks: readonly boolean[],
  loop: Loop,
  origins: VariableOrigins,
): boolean {
  if (holdsAnEarlyStop(tokens, marks, loop)) return false

  for (let index = loop.headerStart; index < loop.headerEnd; index++) {
    // Only references. A command check here could not fire, so no test could hold one:
    // `continuationDependsOnExitStatus` already returned `loops` for every header it rejects.
    if (!isSettledReference(tokenAt(tokens, index), origins)) return false
  }

  return true
}

const LOOP_TERMINATORS = new Set(['break', 'exit', 'return'])

function holdsAnEarlyStop(
  tokens: readonly string[],
  marks: readonly boolean[],
  loop: Loop,
): boolean {
  for (let index = loop.bodyStart; index < loop.bodyEnd; index++) {
    if (markAt(marks, index) && LOOP_TERMINATORS.has(tokenAt(tokens, index))) return true
  }
  return false
}

function isSettledReference(token: string, origins: VariableOrigins): boolean {
  if (token.includes('$?')) return false

  for (const [, name] of token.matchAll(VARIABLE_REFERENCE)) {
    if (name === undefined || !origins.settled.has(name)) return false
  }

  return true
}

const VARIABLE_REFERENCE = /\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g

/**
 * The shell expands parameters inside double quotes and not inside single quotes, so
 * single-quoted content is dropped whole while double-quoted content keeps its expansions and
 * drops its words: an agent named in an echoed message is not an invocation, and
 * `while [ "$rc" -ne 0 ]` — the quoting ShellCheck mandates — still reads as a loop hanging on
 * a status. Line breaks survive either way; losing one would move a command position.
 */
function stripShellNoise(source: string): string {
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

/** Shaped as a reference to a name nothing assigns, so the unsettled-origin rule covers it. */
const COMMAND_SUBSTITUTION = '$__command_substitution__'

/** `$?`, `$name` and `${name}` are the references this module reads; the rest are noise. */
function readExpansion(source: string, from: number): Quoted {
  const next = source[from + 1] ?? ''

  if (next === '?') return { text: ' $? ', end: from + 2 }
  if (next === '{') {
    const close = source.indexOf('}', from + 2)
    if (close === -1) return { text: ' ', end: source.length }
    return { text: ` ${source.slice(from, close + 1)} `, end: close + 1 }
  }
  if (next === '(') {
    // A header that ran `$( … )` is not one this module has read, so it leaves a mark. No
    // bracket: the tokeniser splits those, and a stray `)` in command position would read as
    // the very command the substitution was hiding.
    return { text: ` ${COMMAND_SUBSTITUTION} `, end: endOfCall(source, from + 1) }
  }
  if (/[A-Za-z_]/.test(next)) {
    let end = from + 1
    while (/[A-Za-z0-9_]/.test(source[end] ?? '')) end++
    return { text: ` ${source.slice(from, end)} `, end }
  }

  return { text: ' ', end: from + 1 }
}

function startsAWord(source: string, index: number): boolean {
  if (index === 0) return true
  const previous = source[index - 1] ?? ''
  return /[\s;&|(]/.test(previous)
}

/** `((...))` is arithmetic, not a command whose exit status gates anything. */
const stripArithmetic = (code: string): string => code.replace(/\(\([^()]*\)\)/g, ' : ')

const TOKEN_PATTERN = /&&|\|\||;;|;|\||&|\(|\)|\n|[^\s;|&()\n]+/g

function tokenize(code: string): readonly string[] {
  return (code.match(TOKEN_PATTERN) ?? []).map((token) =>
    token === '\n' || token === ';;' ? ';' : token,
  )
}

const SEPARATORS = new Set([';', '&&', '||', '|', '&', '(', ')'])
const KEYWORDS_BEFORE_COMMAND = new Set([
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
/**
 * A prefix runs the word after it, so the command position passes through — past the prefix's
 * own operands, as `timeout 300 claude` needs. An unlisted wrapper hides the call behind it.
 */
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
/** An option, or a duration or a niceness: a prefix's own operand, never its command. */
const OPERAND_OF_A_PREFIX = /^-|^\d+(\.\d+)?[smhd]?$/
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
const SHELL_NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/
/**
 * Constructs a loop may hang on without any separate command of the project's being run.
 * `read` belongs here: `while read -r line` consumes input, and iterating is not re-running.
 * Closing brackets never reach a command position, so no test could hold an entry for them.
 */
const NOT_A_COMMAND = new Set(['true', 'false', ':', '[', '[[', 'test', 'read', '!'])

function markCommandPositions(tokens: readonly string[]): readonly boolean[] {
  const marks: boolean[] = tokens.map((_token, index) => {
    if (index === 0) return true
    const previous = tokenAt(tokens, index - 1)
    return SEPARATORS.has(previous) || KEYWORDS_BEFORE_COMMAND.has(previous)
  })

  // An assignment or a prefix such as `env` hands the command position on, always to the
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

interface Loop {
  readonly keyword: string
  readonly headerStart: number
  readonly headerEnd: number
  readonly bodyStart: number
  readonly bodyEnd: number
}

function findLoops(tokens: readonly string[], marks: readonly boolean[]): readonly Loop[] {
  const loops: Loop[] = []

  for (let index = 0; index < tokens.length; index++) {
    if (!markAt(marks, index)) continue

    const keyword = tokenAt(tokens, index)
    if (keyword !== 'while' && keyword !== 'until' && keyword !== 'for') continue

    const doIndex = indexOfCommand(tokens, marks, 'do', index + 1)
    if (doIndex === -1) continue

    const doneIndex = indexOfMatchingDone(tokens, marks, doIndex + 1)
    if (doneIndex === -1) continue

    loops.push({
      keyword,
      headerStart: index + 1,
      headerEnd: doIndex,
      bodyStart: doIndex + 1,
      bodyEnd: doneIndex,
    })
  }

  return loops
}

function indexOfCommand(
  tokens: readonly string[],
  marks: readonly boolean[],
  word: string,
  from: number,
): number {
  for (let index = from; index < tokens.length; index++) {
    if (markAt(marks, index) && tokenAt(tokens, index) === word) return index
  }
  return -1
}

function indexOfMatchingDone(
  tokens: readonly string[],
  marks: readonly boolean[],
  from: number,
): number {
  let depth = 0

  for (let index = from; index < tokens.length; index++) {
    if (!markAt(marks, index)) continue

    const token = tokenAt(tokens, index)
    if (token === 'do') depth++
    else if (token === 'done') {
      if (depth === 0) return index
      depth--
    }
  }

  return -1
}

interface FunctionBody {
  readonly start: number
  readonly end: number
}

/**
 * A loop calling a function defined beside it invokes whatever that function invokes, so
 * `run_agent() { claude -p fix; }` with `until pnpm check; do run_agent; done` is a retry loop.
 */
function findFunctionBodies(
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

function invokesAgent(
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

function continuationDependsOnExitStatus(
  tokens: readonly string[],
  marks: readonly boolean[],
  loop: Loop,
  statusVariables: ReadonlySet<string>,
): boolean {
  // A `for` header iterates a list; nothing about it is an exit status.
  if (
    loop.keyword !== 'for' &&
    runsACommand(tokens, marks, loop.headerStart, loop.headerEnd, statusVariables)
  ) {
    return true
  }
  return breaksOnAnExitStatus(tokens, marks, loop.bodyStart, loop.bodyEnd, statusVariables)
}

/**
 * `status` is what the exit-status analysis reads: `rc=$?` is that status one hop away.
 * `settled` is why a counter loop is decidable — arithmetic, a literal and `read` cannot carry
 * an exit status. A name from anything else is in neither set, and unknown stays undecidable.
 */
interface VariableOrigins {
  readonly status: ReadonlySet<string>
  readonly settled: ReadonlySet<string>
}

const EXIT_STATUS_ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=\$\?$/
const ASSIGNMENT_VALUE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/

function readVariableOrigins(tokens: readonly string[]): VariableOrigins {
  const status = new Set<string>()
  const settled = new Set<string>()
  const unknown = new Set<string>()

  for (let index = 0; index < tokens.length; index++) {
    const token = tokenAt(tokens, index)

    // `read a b` names every variable it fills, and a line of input is not an exit status.
    if (token === 'read') {
      for (let next = index + 1; next < tokens.length; next++) {
        const word = tokenAt(tokens, next)
        if (SEPARATORS.has(word)) break
        if (!word.startsWith('-')) settled.add(word)
      }
      continue
    }

    const assigned = EXIT_STATUS_ASSIGNMENT.exec(token)?.[1]
    if (assigned !== undefined) {
      status.add(assigned)
      continue
    }

    const assignment = ASSIGNMENT_VALUE.exec(token)
    if (assignment === null) continue

    const name = assignment[1] ?? ''
    const value = assignment[2] ?? ''
    const next = tokenAt(tokens, index + 1)

    // `rc="$?"`: the quoted expansion survives as its own token, so the assignment is a pair.
    if (value === '' && next.includes('$?')) status.add(name)
    // `i=$((i + 1))`: arithmetic, read before it was stripped. A count is not a status.
    else if (value === '$' && next === '(' && tokenAt(tokens, index + 2) === '(') settled.add(name)
    // `i=0`, and `msg="hello"` whose words the quote reader already dropped.
    else if (value === '' ? !next.includes('$') : !value.includes('$')) settled.add(name)
    else unknown.add(name)
  }

  // Only the unknown origins. Subtracting `status` too could not fire, so no test could hold
  // it: `runsACommand` decides the loop `loops` before `iterates` is ever asked.
  for (const name of unknown) settled.delete(name)

  return { status, settled }
}

/** `true`, `false`, `:` and the test builtins run no command; `$?` and its aliases are one. */
function runsACommand(
  tokens: readonly string[],
  marks: readonly boolean[],
  start: number,
  end: number,
  statusVariables: ReadonlySet<string>,
): boolean {
  for (let index = start; index < end; index++) {
    if (referencesExitStatus(tokenAt(tokens, index), statusVariables)) return true
    if (!markAt(marks, index)) continue

    const token = tokenAt(tokens, index)
    if (token.length > 0 && !NOT_A_COMMAND.has(token)) return true
  }
  return false
}

function referencesExitStatus(token: string, statusVariables: ReadonlySet<string>): boolean {
  if (token.includes('$?')) return true

  for (const name of statusVariables) {
    if (token.includes(`$${name}`) || token.includes(`\${${name}}`)) return true
  }
  return false
}

function breaksOnAnExitStatus(
  tokens: readonly string[],
  marks: readonly boolean[],
  start: number,
  end: number,
  statusVariables: ReadonlySet<string>,
): boolean {
  for (let index = start; index < end; index++) {
    if (!markAt(marks, index) || tokenAt(tokens, index) !== 'break') continue
    if (isChainedOnACommand(tokens, marks, index, start, statusVariables)) return true
    if (isGuardedByABranch(tokens, marks, index, start, statusVariables)) return true
  }
  return false
}

/** `pnpm check && break` — the break is reached only on that command's exit status. */
function isChainedOnACommand(
  tokens: readonly string[],
  marks: readonly boolean[],
  breakIndex: number,
  start: number,
  statusVariables: ReadonlySet<string>,
): boolean {
  const operator = tokenAt(tokens, breakIndex - 1)
  if (operator !== '&&' && operator !== '||') return false

  let listStart = breakIndex - 1
  while (listStart > start) {
    const previous = tokenAt(tokens, listStart - 1)
    if (previous === ';' || previous === '(' || KEYWORDS_BEFORE_COMMAND.has(previous)) break
    listStart--
  }

  return runsACommand(tokens, marks, listStart, breakIndex - 1, statusVariables)
}

/** `if pnpm check; then break; fi` — the branch is taken on that command's exit status. */
function isGuardedByABranch(
  tokens: readonly string[],
  marks: readonly boolean[],
  breakIndex: number,
  start: number,
  statusVariables: ReadonlySet<string>,
): boolean {
  let thenIndex = -1
  for (let index = breakIndex - 1; index >= start; index--) {
    if (!markAt(marks, index)) continue
    const token = tokenAt(tokens, index)
    if (token === 'fi') return false
    if (token === 'then') {
      thenIndex = index
      break
    }
  }
  if (thenIndex === -1) return false

  let branchIndex = -1
  for (let index = thenIndex - 1; index >= start; index--) {
    if (!markAt(marks, index)) continue
    const token = tokenAt(tokens, index)
    if (token === 'if' || token === 'elif') {
      branchIndex = index
      break
    }
  }
  if (branchIndex === -1) return false

  return runsACommand(tokens, marks, branchIndex + 1, thenIndex, statusVariables)
}

const basenameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** Matched on whole path segments, so `prompt-toolkit-notes.md` is not `prompt-history.md`. */
const holdsFileNamedAnywhere = (tracked: readonly string[], names: readonly string[]): boolean =>
  tracked.some((file) => names.some((name) => file === name || file.endsWith(`/${name}`)))

const holdsPathUnderRootDirectory = (
  tracked: readonly string[],
  directories: readonly string[],
): boolean => tracked.some((file) => directories.some((directory) => file.startsWith(directory)))

const tokenAt = (tokens: readonly string[], index: number): string => tokens[index] ?? ''
const markAt = (marks: readonly boolean[], index: number): boolean => marks[index] ?? false

/** `null` is "could not be read", never "read and found empty": the two are not the same. */
async function readTextFile(absolute: string): Promise<string | null> {
  try {
    return await readFile(absolute, 'utf8')
  } catch {
    return null
  }
}
