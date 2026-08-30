import { describe, expect, it } from 'vitest'
import type { AxisVocabulary } from '../models/axis.model.js'
import type { Observation } from '../models/observation.model.js'
import { collectEvidence } from './collect-evidence.usecase.js'
import { FailingEvidenceCollector } from '../adapters/failing-evidence-collector.test-adapter.js'
import { FakeInMemoryEvidenceCollector } from '../adapters/fake-in-memory-evidence-collector.test-adapter.js'

function observation(overrides: Partial<Observation> & Pick<Observation, 'axis'>): Observation {
  return {
    reading: 'SUSTAINED',
    value: 'L',
    kind: 'OBSERVED',
    collector: 'fake',
    basis: 'fixture',
    demonstration: null,
    ...overrides,
  }
}

function ordinalVocabulary(axis: string): AxisVocabulary {
  return { axis, kind: 'ordinal', values: ['S', 'M', 'L'] }
}

function noSignal(): AbortSignal {
  return new AbortController().signal
}

describe('collectEvidence', () => {
  it('passes the requested path, vocabulary and caller signal to every called collector', async () => {
    const vocabulary = [ordinalVocabulary('size')]
    const controller = new AbortController()
    const collector = new FakeInMemoryEvidenceCollector('a', ['size'], [])

    await collectEvidence({
      path: 'repo/path',
      vocabulary,
      collectors: [collector],
      signal: controller.signal,
    })

    expect(collector.contexts).toHaveLength(1)
    expect(collector.contexts[0]).toEqual({
      path: 'repo/path',
      vocabulary,
      signal: controller.signal,
    })
  })

  it('confirms an axis two collectors agree on, through the real resolver', async () => {
    const a = new FakeInMemoryEvidenceCollector(
      'a',
      ['size'],
      [observation({ axis: 'size', value: 'L', collector: 'a' })],
    )
    const b = new FakeInMemoryEvidenceCollector(
      'b',
      ['size'],
      [observation({ axis: 'size', value: 'L', collector: 'b' })],
    )

    const result = await collectEvidence({
      path: '.',
      vocabulary: [ordinalVocabulary('size')],
      collectors: [a, b],
      signal: noSignal(),
    })

    // One entry per requested axis and reading: size sustained, then size demonstrated.
    expect(result.evidence).toHaveLength(2)
    expect(result.evidence[0]).toMatchObject({ axis: 'size', status: 'CONFIRMED', value: 'L' })
    expect(result.evidence[0]?.observations).toHaveLength(2)
  })

  it('conflicts an axis two collectors disagree on', async () => {
    const a = new FakeInMemoryEvidenceCollector(
      'a',
      ['size'],
      [observation({ axis: 'size', value: 'L', collector: 'a' })],
    )
    const b = new FakeInMemoryEvidenceCollector(
      'b',
      ['size'],
      [observation({ axis: 'size', value: 'M', collector: 'b' })],
    )

    const result = await collectEvidence({
      path: '.',
      vocabulary: [ordinalVocabulary('size')],
      collectors: [a, b],
      signal: noSignal(),
    })

    expect(result.evidence[0]).toMatchObject({ axis: 'size', status: 'CONFLICTING', value: null })
  })

  it('claims an axis whose only observation is DECLARED', async () => {
    const collector = new FakeInMemoryEvidenceCollector(
      'repo-context',
      ['size'],
      [observation({ axis: 'size', value: 'L', kind: 'DECLARED', collector: 'repo-context' })],
    )

    const result = await collectEvidence({
      path: '.',
      vocabulary: [ordinalVocabulary('size')],
      collectors: [collector],
      signal: noSignal(),
    })

    expect(result.evidence[0]).toMatchObject({ axis: 'size', status: 'CLAIMED', value: null })
  })

  it('leaves a requested axis UNKNOWN when no collector observes it', async () => {
    const sizeOnly = new FakeInMemoryEvidenceCollector(
      'a',
      ['size'],
      [observation({ axis: 'size', value: 'L', collector: 'a' })],
    )

    const result = await collectEvidence({
      path: '.',
      vocabulary: [ordinalVocabulary('size'), ordinalVocabulary('harness')],
      collectors: [sizeOnly],
      signal: noSignal(),
    })

    const harness = result.evidence.find(
      (entry) => entry.axis === 'harness' && entry.reading === 'SUSTAINED',
    )
    expect(harness).toEqual({
      axis: 'harness',
      reading: 'SUSTAINED',
      status: 'UNKNOWN',
      value: null,
      demonstration: null,
      observations: [],
    })
  })

  it('leaves a throwing collector axis UNKNOWN, never a fabricated negative or a missing entry', async () => {
    const collector = new FailingEvidenceCollector('crashy', ['size'], new Error('exploded'))

    const result = await collectEvidence({
      path: '.',
      vocabulary: [ordinalVocabulary('size')],
      collectors: [collector],
      signal: noSignal(),
    })

    expect(result.evidence).toEqual([
      {
        axis: 'size',
        reading: 'SUSTAINED',
        status: 'UNKNOWN',
        value: null,
        demonstration: null,
        observations: [],
      },
      {
        axis: 'size',
        reading: 'DEMONSTRATED',
        status: 'UNKNOWN',
        value: null,
        demonstration: null,
        observations: [],
      },
    ])
  })

  it('still resolves a successful collector axis when an independent collector fails', async () => {
    const failing = new FailingEvidenceCollector('crashy', ['size'], new Error('exploded'))
    const succeeding = new FakeInMemoryEvidenceCollector(
      'steady',
      ['size'],
      [observation({ axis: 'size', value: 'L', collector: 'steady' })],
    )

    const result = await collectEvidence({
      path: '.',
      vocabulary: [ordinalVocabulary('size')],
      collectors: [failing, succeeding],
      signal: noSignal(),
    })

    expect(result.evidence[0]).toMatchObject({ axis: 'size', status: 'CONFIRMED', value: 'L' })
  })

  it('reports FAILED provenance with the thrown message as reason', async () => {
    const collector = new FailingEvidenceCollector(
      'crashy',
      ['size'],
      new Error('exploded on read'),
    )

    const result = await collectEvidence({
      path: '.',
      vocabulary: [ordinalVocabulary('size')],
      collectors: [collector],
      signal: noSignal(),
    })

    expect(result.provenance).toEqual([
      { collector: 'crashy', status: 'FAILED', axes: ['size'], reason: 'exploded on read' },
    ])
  })

  it('reports TIMED_OUT provenance when a collector rejects while the caller signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const collector = new FailingEvidenceCollector('slow', ['size'], new Error('exceeded budget'))

    const result = await collectEvidence({
      path: '.',
      vocabulary: [ordinalVocabulary('size')],
      collectors: [collector],
      signal: controller.signal,
    })

    expect(result.provenance).toEqual([
      { collector: 'slow', status: 'TIMED_OUT', axes: ['size'], reason: 'exceeded budget' },
    ])
  })

  it('skips and never calls a collector supporting none of the requested axes', async () => {
    const collector = new FakeInMemoryEvidenceCollector(
      'irrelevant',
      ['other-axis'],
      [observation({ axis: 'other-axis', value: 'L', collector: 'irrelevant' })],
    )

    const result = await collectEvidence({
      path: '.',
      vocabulary: [ordinalVocabulary('size')],
      collectors: [collector],
      signal: noSignal(),
    })

    expect(collector.contexts).toHaveLength(0)
    expect(result.provenance).toEqual([
      {
        collector: 'irrelevant',
        status: 'SKIPPED',
        axes: [],
        reason: expect.stringContaining('irrelevant'),
      },
    ])
  })

  it('claims the axes it was asked for even when it answered on none of them', async () => {
    const vocabulary = [ordinalVocabulary('size'), ordinalVocabulary('harness')]
    const silent = new FakeInMemoryEvidenceCollector('silent', ['size', 'harness'], [])

    const result = await collectEvidence({
      path: '.',
      vocabulary,
      collectors: [silent],
      signal: noSignal(),
    })

    // INVARIANT: provenance.axes names what the collector was asked to attempt, not what it
    // contributed; a reader naming what is missing must read the evidence, never the provenance.
    expect(result.provenance).toEqual([
      { collector: 'silent', status: 'COMPLETED', axes: ['size', 'harness'] },
    ])
    expect(result.evidence.map((entry) => entry.status)).toEqual([
      'UNKNOWN',
      'UNKNOWN',
      'UNKNOWN',
      'UNKNOWN',
    ])
  })

  it('reports provenance for every configured collector in configuration order with its responsible axes', async () => {
    const vocabulary = [ordinalVocabulary('size'), ordinalVocabulary('harness')]
    const first = new FakeInMemoryEvidenceCollector('first', ['size', 'harness'], [])
    const second = new FakeInMemoryEvidenceCollector('second', ['harness'], [])
    const third = new FakeInMemoryEvidenceCollector('third', ['parallelism'], [])

    const result = await collectEvidence({
      path: '.',
      vocabulary,
      collectors: [first, second, third],
      signal: noSignal(),
    })

    expect(result.provenance.map((entry) => entry.collector)).toEqual(['first', 'second', 'third'])
    expect(result.provenance[0]).toMatchObject({ status: 'COMPLETED', axes: ['size', 'harness'] })
    expect(result.provenance[1]).toMatchObject({ status: 'COMPLETED', axes: ['harness'] })
    expect(result.provenance[2]).toMatchObject({ status: 'SKIPPED', axes: [] })
  })

  it('reports FAILED with a usable reason when a collector throws a non-Error value', async () => {
    const collector = new FailingEvidenceCollector('flaky', ['size'], 'boom')

    const result = await collectEvidence({
      path: '.',
      vocabulary: [ordinalVocabulary('size')],
      collectors: [collector],
      signal: noSignal(),
    })

    expect(result.provenance).toEqual([
      { collector: 'flaky', status: 'FAILED', axes: ['size'], reason: 'boom' },
    ])
  })
})
