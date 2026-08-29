import { describe, expect, it } from 'vitest'
import { readShellLoops } from './shell-loop.js'

// INVARIANT: Driven on a source string rather than through a tree, for the reason the mutation
// sweep gave: 73 mutants survived here and 30 were never covered, under a suite that reaches this
// decision only by walking a whole repository. The three answers below are the point — `loops`
// proven, decidably not a retry loop, and undecidable in between — and the middle one is what keeps
// an ordinary `for f in *.ts` from costing a developer the whole harness axis.

const PROVEN = { proven: true, undecidable: false }
const DECIDABLY_NOT_A_RETRY = { proven: false, undecidable: false }
const UNDECIDABLE = { proven: false, undecidable: true }

describe('a loop whose continuation hangs on an exit status proves loops', () => {
  it('reads until <command>, which re-runs the agent while that command fails', () => {
    expect(readShellLoops('until pnpm check; do claude -p fix; done')).toEqual(PROVEN)
  })

  it('reads while ! <command>, the same loop written the other way round', () => {
    expect(readShellLoops('while ! pnpm check; do claude -p fix; done')).toEqual(PROVEN)
  })

  it('reads an agent invoked in the header rather than the body', () => {
    expect(readShellLoops('while claude -p fix && ! pnpm check; do sleep 1; done')).toEqual(PROVEN)
  })

  it('reads a break chained on a command with &&', () => {
    expect(readShellLoops('while true; do claude -p fix; pnpm check && break; done')).toEqual(
      PROVEN,
    )
  })

  it('reads a break chained on a command with ||', () => {
    expect(readShellLoops('while true; do claude -p fix; pnpm check || break; done')).toEqual(
      PROVEN,
    )
  })

  it('reads a break guarded by a branch whose condition runs a command', () => {
    expect(
      readShellLoops('while true; do claude -p fix; if pnpm check; then break; fi; done'),
    ).toEqual(PROVEN)
  })

  it('reads a status captured one hop away as rc=$?', () => {
    expect(
      readShellLoops('while true; do claude -p fix; rc=$?; if [ $rc -eq 0 ]; then break; fi; done'),
    ).toEqual(PROVEN)
  })

  it('reads that same status through the quotes ShellCheck asks for', () => {
    expect(
      readShellLoops(
        'while true; do claude -p fix; rc="$?"; if [ "$rc" -eq 0 ]; then break; fi; done',
      ),
    ).toEqual(PROVEN)
  })

  it('reads an agent reached through a function the loop calls', () => {
    expect(
      readShellLoops('run_agent() { claude -p fix; }\nuntil pnpm check; do run_agent; done'),
    ).toEqual(PROVEN)
  })

  it('reads an agent under a wrapper that hands on the command position', () => {
    expect(readShellLoops('until pnpm check; do timeout 300 claude -p fix; done')).toEqual(PROVEN)
  })

  it('reads the outer loop of two, whose done is not the first one', () => {
    expect(
      readShellLoops('until pnpm check; do for f in a b; do claude -p "$f"; done; done'),
    ).toEqual(PROVEN)
  })
})

describe('a loop that iterates rather than retries is decided, not left open', () => {
  it('reads for <name> in <list> as running the agent once per item', () => {
    expect(readShellLoops('for f in a b c; do claude -p "$f"; done')).toEqual(DECIDABLY_NOT_A_RETRY)
  })

  it('reads a fail-fast inside a for as still re-running nothing', () => {
    expect(readShellLoops('for f in a b c; do claude -p "$f" || exit 1; done')).toEqual(
      DECIDABLY_NOT_A_RETRY,
    )
  })

  it('reads while read as consuming input, which is not re-running', () => {
    expect(readShellLoops('while read -r line; do claude -p "$line"; done')).toEqual(
      DECIDABLY_NOT_A_RETRY,
    )
  })

  it('reads a counter loop as counting, because arithmetic cannot carry an exit status', () => {
    expect(readShellLoops('i=0\nwhile [ $i -lt 3 ]; do claude -p fix; i=$((i + 1)); done')).toEqual(
      DECIDABLY_NOT_A_RETRY,
    )
  })

  it('says nothing at all about a loop that invokes no agent', () => {
    expect(readShellLoops('until pnpm check; do sleep 1; done')).toEqual(DECIDABLY_NOT_A_RETRY)
  })

  it('says nothing about a source holding no loop', () => {
    expect(readShellLoops('claude -p fix\npnpm check')).toEqual(DECIDABLY_NOT_A_RETRY)
  })
})

describe('what it refuses to decide, rather than reporting a practice absent', () => {
  it('leaves a header hanging on a command substitution undecidable', () => {
    expect(readShellLoops('while [ "$(cat flag)" = go ]; do claude -p fix; done')).toEqual(
      UNDECIDABLE,
    )
  })

  it('leaves a header hanging on a variable of unsettled origin undecidable', () => {
    expect(readShellLoops('n=$other\nwhile [ $n -gt 0 ]; do claude -p fix; done')).toEqual(
      UNDECIDABLE,
    )
  })

  it('leaves an early stop it cannot attribute to any exit status undecidable', () => {
    expect(readShellLoops('while true; do claude -p fix; if true; then break; fi; done')).toEqual(
      UNDECIDABLE,
    )
  })

  it('leaves a break sitting after a closed branch undecidable rather than reading it as guarded', () => {
    expect(
      readShellLoops('while true; do claude -p fix; if pnpm check; then :; fi; break; done'),
    ).toEqual(UNDECIDABLE)
  })

  it('leaves a break with no branch and no chain undecidable', () => {
    expect(readShellLoops('while true; do claude -p fix; break; done')).toEqual(UNDECIDABLE)
  })

  it('leaves an exit it cannot attribute undecidable, as it does a break', () => {
    expect(readShellLoops('while true; do claude -p fix; if true; then exit 0; fi; done')).toEqual(
      UNDECIDABLE,
    )
  })

  it('leaves a return it cannot attribute undecidable, as it does a break', () => {
    expect(readShellLoops('while true; do claude -p fix; if true; then return; fi; done')).toEqual(
      UNDECIDABLE,
    )
  })
})

describe('what a header may test without running anything', () => {
  it.each([
    ['a colon', 'while :; do claude -p fix; done'],
    ['true', 'while true; do claude -p fix; done'],
    ['false', 'while false; do claude -p fix; done'],
    ['the test builtin', 'while test -f flag; do claude -p fix; done'],
    ['a single bracket', 'while [ -f flag ]; do claude -p fix; done'],
    ['a double bracket', 'while [[ -f flag ]]; do claude -p fix; done'],
  ])('reads %s as running no command of the project’s', (_what, source) => {
    expect(readShellLoops(source)).toEqual(DECIDABLY_NOT_A_RETRY)
  })

  it('reads an ordinary command in the header as the status the loop hangs on', () => {
    expect(readShellLoops('while pnpm check; do claude -p fix; done')).toEqual(PROVEN)
  })
})

describe('reaching the branch that guards a break', () => {
  it('reads an elif condition, not only an if', () => {
    expect(
      readShellLoops(
        'while true; do claude -p fix; if false; then :; elif pnpm check; then break; fi; done',
      ),
    ).toEqual(PROVEN)
  })

  it('reads a break nested inside an inner loop of the retrying one', () => {
    expect(
      readShellLoops(
        'while true; do for f in a b; do claude -p "$f"; done; pnpm check && break; done',
      ),
    ).toEqual(PROVEN)
  })
})

describe('a loop it cannot even delimit decides nothing', () => {
  it('finds no loop where do never comes', () => {
    expect(readShellLoops('while pnpm check\nclaude -p fix')).toEqual(DECIDABLY_NOT_A_RETRY)
  })

  it('finds no loop where done never comes', () => {
    expect(readShellLoops('until pnpm check; do claude -p fix')).toEqual(DECIDABLY_NOT_A_RETRY)
  })
})
