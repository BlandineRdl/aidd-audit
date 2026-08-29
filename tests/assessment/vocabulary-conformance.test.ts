import { describe, expect, it } from 'vitest'
import type {
  EvidenceStatus as ContractEvidenceStatus,
  ObservedValue as ContractObservedValue,
  Threshold,
} from '../../src/assessment/contracts/assessment-report.contract.js'
import {
  EVIDENCE_STATUSES,
  type EvidenceStatus,
  type ObservedValue,
} from '../../src/evidence/models/observation.model.js'
import {
  EVIDENCE_CONFIDENCES,
  type EvidenceConfidence,
  type ObservedValue as AxisObservedValue,
} from '../../src/maturity/models/axis-observation.model.js'
import type { MinRequirement, SetRequirement } from '../../src/maturity/models/maturity.model.js'

type Identical<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

// The contract must be able to publish every threshold a model can express.
type ModelThreshold = MinRequirement['min'] | SetRequirement['includes']

// INVARIANT: AssertTrue accepts only the literal `true`, so a false Identical<A, B> fails tsc on
// the line that names it; kept outside every it() so nothing here is misread as a passing test that
// isn't one.
type AssertTrue<T extends true> = T
type _StatusesAgree = AssertTrue<Identical<EvidenceStatus, EvidenceConfidence>>
type _ContractAgreesOnStatuses = AssertTrue<Identical<EvidenceStatus, ContractEvidenceStatus>>
type _ValuesAgree = AssertTrue<Identical<ObservedValue, AxisObservedValue>>
type _ContractAgreesOnValues = AssertTrue<Identical<ObservedValue, ContractObservedValue>>
type _ThresholdsAgree = AssertTrue<Identical<Threshold, ModelThreshold>>

// Fails to compile the day the contract's union gains or loses a member.
const contractStatuses: Readonly<Record<ContractEvidenceStatus, true>> = {
  CONFIRMED: true,
  CLAIMED: true,
  CONFLICTING: true,
  UNKNOWN: true,
}

describe('the three evidence vocabularies stay compatible', () => {
  it('declares the same four statuses in evidence, in maturity and in the contract', () => {
    expect([...EVIDENCE_STATUSES].sort()).toEqual([...EVIDENCE_CONFIDENCES].sort())
    expect(Object.keys(contractStatuses).sort()).toEqual([...EVIDENCE_STATUSES].sort())
  })
})
