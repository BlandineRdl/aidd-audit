import { invokesAgent } from './agent-invocation.js'
import { DECIDED_PRESENT, type MemberScan } from './member-scan.js'
import {
  findFunctionBodies,
  KEYWORDS_BEFORE_COMMAND,
  markAt,
  markCommandPositions,
  NOT_A_COMMAND,
  SEPARATORS,
  stripArithmetic,
  stripShellNoise,
  tokenAt,
  tokenize,
} from './shell-tokens.js'

/**
 * A loop invoking an agent has three answers, not two: `loops` when the continuation is
 * positively recognised as hanging on a separate command's exit status; decidably no when it is
 * positively recognised as not — a list iterated, input consumed, a counter counted;
 * undecidable only in between. The middle answer keeps an ordinary `for f in *.ts` or
 * `while read -r line` from costing the whole axis.
 */
export function readShellLoops(source: string): MemberScan {
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
