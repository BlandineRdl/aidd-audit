import type {
  AssessmentReport,
  AxisReport,
  BlockingRequirement,
  EvidenceStatus,
  EvidenceGapDiagnostic,
  LevelReport,
  ObservedValue,
  ProvenanceEntry,
  RequirementReport,
  Threshold,
} from '../../assessment/contracts/assessment-report.contract.js'
import { ASSESSMENT_REPORT_SCHEMA_VERSION } from '../../assessment/contracts/assessment-report.contract.js'

type Unproven = Exclude<EvidenceStatus, 'CONFIRMED'>

export const metRequirement = (
  axis: string,
  threshold: Threshold,
  observed: ObservedValue,
): RequirementReport => ({ axis, threshold, observed, evidence: 'CONFIRMED', outcome: 'MET' })

export const notMetRequirement = (
  axis: string,
  threshold: Threshold,
  observed: ObservedValue,
): RequirementReport => ({
  axis,
  threshold,
  observed,
  evidence: 'CONFIRMED',
  outcome: 'NOT_MET',
})

export const unprovenRequirement = (
  axis: string,
  threshold: Threshold,
  evidence: Unproven,
  observed: ObservedValue | null = null,
  diagnostic?: EvidenceGapDiagnostic,
): RequirementReport => ({
  axis,
  threshold,
  observed,
  evidence,
  outcome: 'UNPROVEN',
  ...(diagnostic === undefined ? {} : { diagnostic }),
})

export const axisReport = (overrides: Partial<AxisReport> = {}): AxisReport => ({
  axis: 'size',
  label: 'Taille',
  outcome: 'MET',
  requirements: [metRequirement('size', 'L', 'L')],
  ...overrides,
})

export const levelReport = (overrides: Partial<LevelReport> = {}): LevelReport => ({
  id: 'blue',
  rank: 1,
  label: 'Blue',
  outcome: 'MET',
  axes: [
    axisReport(),
    axisReport({
      axis: 'harness',
      label: 'Harness',
      requirements: [metRequirement('harness', ['prompts'], ['prompts'])],
    }),
    axisReport({
      axis: 'parallelism',
      label: 'En parallèle',
      requirements: [metRequirement('parallelism', 1, 3)],
    }),
  ],
  ...overrides,
})

export const practiceBlocker = (level: string, axis: string): BlockingRequirement => ({
  level,
  axis,
  evidence: 'CONFIRMED',
  outcome: 'NOT_MET',
  gap: 'PRACTICE',
})

export const evidenceBlocker = (
  level: string,
  axis: string,
  evidence: Unproven = 'UNKNOWN',
): BlockingRequirement => ({ level, axis, evidence, outcome: 'UNPROVEN', gap: 'EVIDENCE' })

export const failedProvenance = (
  collector: string,
  axes: readonly string[],
  reason: string,
  status: Exclude<ProvenanceEntry['status'], 'COMPLETED'> = 'FAILED',
): ProvenanceEntry => ({ collector, status, axes, reason })

const provenLevel = levelReport()

const validReport: AssessmentReport = {
  schemaVersion: ASSESSMENT_REPORT_SCHEMA_VERSION,
  model: { id: 'aidd', schemaVersion: 1 },
  subject: { path: '/repo/example' },
  proven: provenLevel,
  next: null,
  demonstrated: null,
  levels: [provenLevel],
  blocking: [],
  vocabulary: [
    {
      axis: 'size',
      kind: 'ordinal',
      values: ['none', 'S', 'M', 'L'],
      descriptions: { none: 'none', S: 'small', M: 'medium', L: 'large' },
    },
    {
      axis: 'harness',
      kind: 'set',
      members: ['prompts', 'behavior'],
      descriptions: { prompts: 'prompts', behavior: 'guardrails' },
    },
    { axis: 'parallelism', kind: 'numeric', description: 'active work per day' },
  ],
  coverage: { axesRequested: 3, axesObserved: 3, axesConfirmed: 3 },
  provenance: [
    {
      collector: 'fixture-collector',
      status: 'COMPLETED',
      axes: ['size', 'harness', 'parallelism'],
    },
  ],
}

export function assessmentReport(overrides: Partial<AssessmentReport> = {}): AssessmentReport {
  return { ...validReport, ...overrides }
}
