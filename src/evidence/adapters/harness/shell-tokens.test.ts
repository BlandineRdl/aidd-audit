import { describe, expect, it } from 'vitest'
import {
  basenameOf,
  endOfCall,
  findFunctionBodies,
  markAt,
  markCommandPositions,
  startsAWord,
  stripArithmetic,
  stripShellNoise,
  tokenAt,
  tokenize,
} from './shell-tokens.js'

// INVARIANT: This layer is driven directly because nothing else drives it. `harness-scan.test.ts`
// proves the scan above it and reaches the tokeniser only through a whole tree, which a mutation
// sweep showed: 105 mutants survived here and 43 were never covered at all, under 1588 lines of
// suite. The behaviours below are facts about shell, not about this file's shape — what the shell
// expands, what it hides, and where a command may begin.

const marksOf = (source: string): readonly boolean[] =>
  markCommandPositions(tokenize(stripArithmetic(stripShellNoise(source))))

const tokensOf = (source: string): readonly string[] =>
  tokenize(stripArithmetic(stripShellNoise(source)))

function commandsIn(source: string): readonly string[] {
  const tokens = tokensOf(source)
  const marks = markCommandPositions(tokens)
  return tokens.filter((_token, index) => markAt(marks, index))
}

describe('what the shell hides', () => {
  it('drops a comment from the # that starts a word to the end of that line', () => {
    expect(tokensOf('claude -p go # then rest\npnpm check')).toEqual([
      'claude',
      '-p',
      'go',
      ';',
      'pnpm',
      'check',
    ])
  })

  it('keeps a # that does not start a word, since the shell does not read it as a comment', () => {
    expect(tokensOf('echo abc#def')).toEqual(['echo', 'abc#def'])
  })

  it('drops single-quoted content whole: an agent named in a message is not an invocation', () => {
    expect(tokensOf("echo 'run claude -p go by hand'")).toEqual(['echo'])
  })

  it('drops a double-quoted message but keeps the expansions inside it', () => {
    expect(tokensOf('echo "claude said $rc about ${status}"')).toEqual(['echo', '$rc', '${status}'])
  })

  it('keeps $? through double quotes, which is how ShellCheck-clean code writes a status test', () => {
    expect(tokensOf('while [ "$?" -ne 0 ]; do :; done')).toContain('$?')
  })

  it('replaces a command substitution with a reference nothing assigns, never its contents', () => {
    const tokens = tokensOf('while [ "$(pnpm check)" = ok ]; do :; done')

    expect(tokens).not.toContain('pnpm')
    expect(tokens.some((token) => token.startsWith('$__'))).toBe(true)
  })

  it('preserves line breaks inside quotes, because losing one would move a command position', () => {
    expect(commandsIn("echo 'a\nb'\npnpm check")).toContain('pnpm')
  })

  it('swallows a backslash and the character behind it, as the shell does', () => {
    // A real backslash reaches the reader here: `\\;` in TypeScript is one, `\;` would be none.
    expect(tokensOf('echo a\\;b')).toEqual(['echo', 'a', 'b'])
  })

  it('swallows a line continuation, so the two halves read as one command', () => {
    expect(commandsIn('timeout 300 \\\n  claude -p go')).toEqual(['timeout', 'claude'])
  })

  it('reads an unterminated quote to the end of the file rather than looping', () => {
    expect(tokensOf('echo "never closed')).toEqual(['echo'])
  })

  it('reads an unterminated ${ to the end of the file rather than looping', () => {
    expect(tokensOf('echo "${never')).toEqual(['echo'])
  })

  it('drops a $ that names nothing', () => {
    expect(tokensOf('echo "$ and $1"')).toEqual(['echo'])
  })

  it('reads arithmetic as a command that decides nothing', () => {
    expect(stripArithmetic('i=$((i + 1))').includes('(')).toBe(false)
  })
})

describe('where a word may be a command', () => {
  it('marks the first token', () => {
    expect(markAt(marksOf('claude -p go'), 0)).toBe(true)
  })

  it('marks what follows a separator, and not a bare operand', () => {
    expect(commandsIn('claude -p go && pnpm check')).toEqual(['claude', 'pnpm'])
  })

  it('marks what follows a keyword that opens a command', () => {
    expect(commandsIn('if pnpm check; then claude -p go; fi')).toContain('claude')
  })

  it('hands the command position past an assignment prefix', () => {
    expect(commandsIn('CI=1 claude -p go')).toContain('claude')
  })

  it('hands it past a wrapper and that wrapper’s own operands', () => {
    expect(commandsIn('timeout 300 claude -p go')).toContain('claude')
    expect(commandsIn('nice -n 5 claude -p go')).toContain('claude')
    expect(commandsIn('env FOO=1 claude -p go')).toContain('claude')
  })

  it('hands it nowhere when the wrapper ends the line', () => {
    expect(commandsIn('pnpm check; timeout')).toEqual(['pnpm', 'timeout'])
  })

  it('hands it nowhere when only the wrapper’s operands follow it', () => {
    expect(commandsIn('timeout 300; pnpm check')).toEqual(['timeout', 'pnpm'])
  })

  it('does not mark an assignment’s value when a separator follows it', () => {
    expect(commandsIn('CI=1; pnpm check')).toEqual(['CI=1', 'pnpm'])
  })

  it.each([
    ['a pipe', 'echo x | claude -p go'],
    ['a background operator', 'echo x & claude -p go'],
    ['a subshell open', 'echo x; ( claude -p go )'],
    ['a negation', 'if ! claude -p go; then :; fi'],
    ['a block open', 'run() { claude -p go; }'],
    ['an else', 'if false; then :; else claude -p go; fi'],
    ['an elif', 'if false; then :; elif claude -p go; then :; fi'],
  ])('marks what follows %s', (_what, source) => {
    expect(commandsIn(source)).toContain('claude')
  })

  it.each(['command', 'exec', 'sudo', 'xargs', 'npx', 'env', 'nohup', 'stdbuf'])(
    'hands the command position past the wrapper %s',
    (wrapper) => {
      expect(commandsIn(`${wrapper} claude -p go`)).toContain('claude')
    },
  )

  it('reads a duration with a unit as the wrapper’s operand, not its command', () => {
    expect(commandsIn('timeout 5m claude -p go')).toContain('claude')
  })

  it('normalises a case terminator to an ordinary separator', () => {
    expect(tokensOf('case $x in a) claude -p go;; esac')).toContain(';')
    expect(tokensOf('case $x in a) claude -p go;; esac')).not.toContain(';;')
  })
})

describe('a function body is what the loop calling it runs', () => {
  it('finds the body of name() { … }', () => {
    const tokens = tokensOf('run_agent() { claude -p fix; }')
    const bodies = findFunctionBodies(tokens, markCommandPositions(tokens))

    expect([...bodies.keys()]).toEqual(['run_agent'])
    expect(tokens.slice(bodies.get('run_agent')?.start, bodies.get('run_agent')?.end)).toContain(
      'claude',
    )
  })

  it('finds the body of function name { … }', () => {
    const tokens = tokensOf('function run_agent { claude -p fix; }')

    expect([...findFunctionBodies(tokens, markCommandPositions(tokens)).keys()]).toEqual([
      'run_agent',
    ])
  })

  it('finds the body of function name() { … }, which is both forms at once', () => {
    const tokens = tokensOf('function run_agent() { claude -p fix; }')

    expect([...findFunctionBodies(tokens, markCommandPositions(tokens)).keys()]).toEqual([
      'run_agent',
    ])
  })

  it('matches the closing brace across a nested block', () => {
    const tokens = tokensOf('run_agent() { if true; then { claude -p fix; }; fi; }\npnpm check')
    const bodies = findFunctionBodies(tokens, markCommandPositions(tokens))
    const body = bodies.get('run_agent')

    expect(tokens.slice(body?.start, body?.end)).toContain('claude')
    expect(tokens.slice(body?.start, body?.end)).not.toContain('pnpm')
  })

  it('defines no body when the brace never closes', () => {
    const tokens = tokensOf('run_agent() { claude -p fix')

    expect(findFunctionBodies(tokens, markCommandPositions(tokens)).size).toBe(0)
  })

  it('defines no body for a call, which is a name followed by nothing that opens one', () => {
    const tokens = tokensOf('run_agent()')

    expect(findFunctionBodies(tokens, markCommandPositions(tokens)).size).toBe(0)
  })
})

describe('reading to the end of a call', () => {
  it('stops at the parenthesis that closes the one it was given', () => {
    const code = 'run(a, b) after'

    expect(code.slice(code.indexOf('('), endOfCall(code, code.indexOf('(')))).toBe('(a, b)')
  })

  it('reads past a nested parenthesis', () => {
    const code = 'run(f(a), b) after'

    expect(code.slice(code.indexOf('('), endOfCall(code, code.indexOf('(')))).toBe('(f(a), b)')
  })

  it('reads to the end when the call never closes', () => {
    const code = 'run(a, b'

    expect(endOfCall(code, code.indexOf('('))).toBe(code.length)
  })
})

describe('reading off the end of a token list', () => {
  it('answers an empty word for a token that is not there', () => {
    expect(tokenAt(['claude'], 7)).toBe('')
    expect(tokenAt(['claude'], -1)).toBe('')
  })

  it('answers not-a-command for a mark that is not there', () => {
    expect(markAt([true], 7)).toBe(false)
  })

  it('answers nothing for a source with no word in it', () => {
    expect(tokenize('   ')).toEqual([])
  })
})

describe('naming a command by its last path segment', () => {
  it('reads the name out of a path', () => {
    expect(basenameOf('/usr/local/bin/claude')).toBe('claude')
  })

  it('leaves a bare name alone', () => {
    expect(basenameOf('claude')).toBe('claude')
  })
})

describe('what starts a word', () => {
  it('counts the start of the source', () => {
    expect(startsAWord('#!/bin/sh', 0)).toBe(true)
  })

  it('counts a position after whitespace or an operator, and not one inside a word', () => {
    expect(startsAWord('a #b', 2)).toBe(true)
    expect(startsAWord('a;#b', 2)).toBe(true)
    expect(startsAWord('a#b', 1)).toBe(false)
  })
})
