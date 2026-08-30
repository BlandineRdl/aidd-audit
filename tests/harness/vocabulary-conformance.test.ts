import { describe, expect, it } from 'vitest'
import type {
  LoadingTier as ContractLoadingTier,
  ReadingScope as ContractReadingScope,
} from '../../src/harness/contracts/harness-audit-report.contract.js'
import { LOADING_TIERS, type LoadingTier } from '../../src/harness/models/loading-tier.model.js'
import { READING_SCOPES, type ReadingScope } from '../../src/harness/models/reading-scope.model.js'

// INVARIANT: mirrors tests/assessment/vocabulary-conformance.test.ts — the one place allowed to
// import both a harness model declaration and the harness contract's own copy of it. Peers never
// import each other and the contract is self-contained on purpose, so the two closed sets are
// declared twice; a member added to one and not the other compiles today and drifts silently unless
// something asserts them identical.

type Identical<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

// INVARIANT: AssertTrue accepts only the literal `true`, so a false Identical<A, B> fails tsc on the
// line that names it — kept outside every it() so nothing here is misread as a passing test that
// isn't one.
type AssertTrue<T extends true> = T
type _TiersAgree = AssertTrue<Identical<LoadingTier, ContractLoadingTier>>
type _ScopesAgree = AssertTrue<Identical<ReadingScope, ContractReadingScope>>

// Fails to compile the day the contract's union gains or loses a member.
const contractTiers: Readonly<Record<ContractLoadingTier, true>> = {
  ALWAYS_LOADED: true,
  CONDITIONALLY_LOADED: true,
}

const contractScopes: Readonly<Record<ContractReadingScope, true>> = {
  SUBJECT: true,
  MACHINE: true,
}

describe('the loading tier and reading scope vocabularies stay compatible', () => {
  it('declares the same two loading tiers in the model and in the contract', () => {
    expect(Object.keys(contractTiers).sort()).toEqual([...LOADING_TIERS].sort())
  })

  it('declares the same two reading scopes in the model and in the contract', () => {
    expect(Object.keys(contractScopes).sort()).toEqual([...READING_SCOPES].sort())
  })
})
