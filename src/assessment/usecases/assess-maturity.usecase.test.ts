import { describe, expect, it } from 'vitest'
import { FailingContributorRoster } from '../../evidence/adapters/failing-contributor-roster.test-adapter.js'
import { FailingEvidenceCollector } from '../../evidence/adapters/failing-evidence-collector.test-adapter.js'
import { FakeInMemoryContributorRoster } from '../../evidence/adapters/fake-in-memory-contributor-roster.test-adapter.js'
import { FakeInMemoryEvidenceCollector } from '../../evidence/adapters/fake-in-memory-evidence-collector.test-adapter.js'
import type { Observation } from '../../evidence/models/observation.model.js'
import type { ContributorRosterRun } from '../../evidence/ports/contributor-roster.port.js'
import { validModel as model } from '../../maturity/engine/maturity-model.test-fixture.js'
import { assessMaturity } from './assess-maturity.usecase.js'

const subjectPath = '/fixtures/subject'

function observationsFrom(collector: string): readonly Observation[] {
  const sustained = {
    reading: 'SUSTAINED',
    kind: 'OBSERVED',
    collector,
    basis: 'test',
    demonstration: null,
  } as const
  return [
    { axis: 'size', value: 'L', ...sustained },
    { axis: 'harness', value: ['prompts', 'context-engineering'], ...sustained },
    { axis: 'parallelism', value: 3, ...sustained },
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

  it('reports contributors as null when no roster is passed', async () => {
    const report = await assessMaturity({
      subjectPath,
      model,
      collectors: [],
      signal: new AbortController().signal,
    })

    expect(report.contributors).toBeNull()
  })

  it('sequences a roster after collection, over the same subject and vocabulary', async () => {
    const run: ContributorRosterRun = {
      status: 'COMPLETED',
      windowDays: 180,
      harnessObserved: null,
      harnessPaths: 0,
      records: [],
    }
    const roster = new FakeInMemoryContributorRoster('fake-roster', run)

    const report = await assessMaturity({
      subjectPath,
      model,
      collectors: [],
      roster,
      signal: new AbortController().signal,
    })

    expect(report.contributors).toEqual({
      status: 'COMPLETED',
      windowDays: 180,
      harnessObserved: null,
      harnessPaths: 0,
      rows: [],
    })
    expect(roster.contexts).toHaveLength(1)
    expect(roster.contexts[0]?.path).toBe(subjectPath)
    expect(roster.contexts[0]?.vocabulary).toEqual([
      { axis: 'size', kind: 'ordinal', values: ['none', 'S', 'M', 'L'] },
      {
        axis: 'harness',
        kind: 'set',
        members: ['prompts', 'context-engineering', 'behavior'],
      },
      { axis: 'parallelism', kind: 'numeric' },
    ])
  })

  it('reports contributors FAILED with the reason, and still returns a report, when the roster throws', async () => {
    const roster = new FailingContributorRoster('failing-roster', new Error('boom'))

    const report = await assessMaturity({
      subjectPath,
      model,
      collectors: [],
      roster,
      signal: new AbortController().signal,
    })

    expect(report.contributors?.status).toBe('FAILED')
    expect(report.contributors).toMatchObject({ status: 'FAILED', rows: [], reason: 'boom' })
  })
})
