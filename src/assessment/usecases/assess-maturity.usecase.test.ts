import { describe, expect, it } from 'vitest'
import { FailingEvidenceCollector } from '../../evidence/adapters/failing-evidence-collector.test-adapter.js'
import { FakeInMemoryEvidenceCollector } from '../../evidence/adapters/fake-in-memory-evidence-collector.test-adapter.js'
import type { Observation } from '../../evidence/models/observation.model.js'
import { validModel as model } from '../../maturity/engine/maturity-model.test-fixture.js'
import { assessMaturity } from './assess-maturity.usecase.js'

const subjectPath = '/fixtures/subject'

function observationsFrom(collector: string): readonly Observation[] {
  return [
    { axis: 'size', value: 'L', kind: 'OBSERVED', collector, basis: 'test' },
    {
      axis: 'harness',
      value: ['prompts', 'context-engineering'],
      kind: 'OBSERVED',
      collector,
      basis: 'test',
    },
    { axis: 'parallelism', value: 3, kind: 'OBSERVED', collector, basis: 'test' },
  ]
}

describe('assessMaturity', () => {
  it('names the proven level and COMPLETED provenance when a collector observes every axis', async () => {
    const collector = new FakeInMemoryEvidenceCollector(
      'full-collector',
      ['size', 'harness', 'parallelism'],
      observationsFrom('full-collector'),
    )

    const report = await assessMaturity({
      subjectPath,
      model,
      collectors: [collector],
      signal: new AbortController().signal,
    })

    expect(report.proven?.id).toBe('high')
    expect(report.provenance).toEqual([
      {
        collector: 'full-collector',
        status: 'COMPLETED',
        axes: ['size', 'harness', 'parallelism'],
      },
    ])
  })

  it('leaves every axis UNKNOWN and proven null when the collector set is empty', async () => {
    const report = await assessMaturity({
      subjectPath,
      model,
      collectors: [],
      signal: new AbortController().signal,
    })

    expect(report.proven).toBeNull()
    expect(report.coverage.axesObserved).toBe(0)
    expect(report.provenance).toEqual([])

    expect(report.next?.axes).toHaveLength(model.axes.length)
    for (const axis of report.next?.axes ?? []) {
      for (const requirement of axis.requirements) {
        expect(requirement.evidence).toBe('UNKNOWN')
        expect(requirement.observed).toBeNull()
        expect(requirement.outcome).toBe('UNPROVEN')
      }
    }
  })

  it('still returns a report, with a FAILED provenance entry, when a collector fails', async () => {
    const failing = new FailingEvidenceCollector('failing-collector', ['size'], new Error('boom'))

    const report = await assessMaturity({
      subjectPath,
      model,
      collectors: [failing],
      signal: new AbortController().signal,
    })

    expect(report.provenance).toEqual([
      { collector: 'failing-collector', status: 'FAILED', axes: ['size'], reason: 'boom' },
    ])
  })

  it('hands each scale to the collector as its matching AxisVocabulary kind, carrying the model’s own values', async () => {
    const capturing = new FakeInMemoryEvidenceCollector(
      'capturing-collector',
      ['size', 'harness', 'parallelism'],
      [],
    )

    await assessMaturity({
      subjectPath,
      model,
      collectors: [capturing],
      signal: new AbortController().signal,
    })

    expect(capturing.contexts).toHaveLength(1)
    expect(capturing.contexts[0]?.vocabulary).toEqual([
      { axis: 'size', kind: 'ordinal', values: ['none', 'S', 'M', 'L'] },
      {
        axis: 'harness',
        kind: 'set',
        members: ['prompts', 'context-engineering', 'behavior'],
      },
      { axis: 'parallelism', kind: 'numeric' },
    ])
  })
})
