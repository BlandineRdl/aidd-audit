import { describe, expect, it } from 'vitest'
import { invokesAgent, looksLikeAnAgentInvocation } from './agent-invocation.js'

describe('looksLikeAnAgentInvocation', () => {
  it('recognises an agent command passed through a process spawner', () => {
    expect(looksLikeAnAgentInvocation('subprocess.run("cd repo && claude -p fix")')).toBe(true)
  })

  it('does not treat an agent name in comments or a bare value as an invocation', () => {
    expect(looksLikeAnAgentInvocation('// claude -p fix\nconst tool = "claude finished"')).toBe(
      false,
    )
  })

  it('recognises an agent command inside a triple-quoted argv literal', () => {
    expect(looksLikeAnAgentInvocation('command = """codex --full-auto fix"""')).toBe(true)
  })

  it('preserves the command boundary across escaped characters in literals', () => {
    expect(looksLikeAnAgentInvocation('execSync("claude -p \\"fix\\"")')).toBe(true)
  })
})

describe('invokesAgent', () => {
  it('follows a command-position function and terminates a cycle without an agent', () => {
    const tokens = ['retry', 'helper', 'claude']
    const marks = [true, true, true]
    const functionCallingAnAgent = new Map([
      ['retry', { start: 1, end: 2 }],
      ['helper', { start: 2, end: 3 }],
    ])
    const cycleWithoutAnAgent = new Map([
      ['retry', { start: 1, end: 2 }],
      ['helper', { start: 0, end: 1 }],
    ])

    expect(invokesAgent(tokens, marks, 0, 1, functionCallingAnAgent)).toBe(true)
    expect(invokesAgent(tokens, marks, 0, 1, cycleWithoutAnAgent)).toBe(false)
  })
})
