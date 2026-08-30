import { describe, expect, it } from 'vitest'
import type {
  AssessmentReport,
  AxisReport,
  BlockingRequirement,
  LevelReport,
  ProvenanceEntry,
  RequirementReport,
} from '../../assessment/contracts/assessment-report.contract.js'
import { renderJsonReport, renderJsonReports } from './json.renderer.js'
import { UnrenderableReportError } from './unrenderable-report.error.js'
import {
  assessmentReport,
  axisReport,
  evidenceBlocker,
  failedProvenance,
  levelReport,
  metRequirement,
  notMetRequirement,
  practiceBlocker,
  unprovenRequirement,
} from './assessment-report.test-fixture.js'

describe('1. the output is valid JSON', () => {
  it('parses without throwing', () => {
    const output = renderJsonReport(assessmentReport())
    expect(() => JSON.parse(output)).not.toThrow()
  })

  it('has no trailing newline', () => {
    const output = renderJsonReport(assessmentReport())
    expect(output.endsWith('\n')).toBe(false)
  })
})

describe('2. the complete public report is preserved', () => {
  it('round-trips a report exercising every union variant', () => {
    const blue = levelReport({
      axes: [
        axisReport({
          axis: 'size',
          label: 'Taille',
          outcome: 'NOT_MET',
          requirements: [
            metRequirement('size', 'L', 'L'),
            notMetRequirement('size', 'L', 'M'),
            unprovenRequirement('size', 'L', 'UNKNOWN'),
          ],
        }),
      ],
    })
    const report = assessmentReport({
      proven: null,
      next: blue,
      levels: [blue],
      blocking: [practiceBlocker('blue', 'size'), evidenceBlocker('blue', 'size', 'CLAIMED')],
      provenance: [
        { collector: 'fixture-collector', status: 'COMPLETED', axes: ['size'] },
        failedProvenance('live-repository', ['harness'], 'git not found', 'TIMED_OUT'),
      ],
    })
    const output = renderJsonReport(report)
    expect(JSON.parse(output)).toEqual(report)
  })
})

describe('3. proven: null is preserved', () => {
  it('keeps proven as a present key holding null', () => {
    const output = renderJsonReport(assessmentReport({ proven: null, levels: [] }))
    const parsed = JSON.parse(output)
    expect('proven' in parsed).toBe(true)
    expect(parsed.proven).toBeNull()
  })
})

describe('4. observed: null on an unproven requirement is preserved', () => {
  it('keeps observed as a present key holding null', () => {
    const blue = levelReport({
      axes: [axisReport({ requirements: [unprovenRequirement('size', 'L', 'UNKNOWN')] })],
    })
    const output = renderJsonReport(assessmentReport({ next: blue, levels: [blue] }))
    const parsed = JSON.parse(output)
    const requirement = parsed.levels[0].axes[0].requirements[0]
    expect('observed' in requirement).toBe(true)
    expect(requirement.observed).toBeNull()
  })
})

describe('5. outcomes and evidence statuses are never reinterpreted', () => {
  it('renders them verbatim, unglossed, alongside contract keys such as gap', () => {
    const blue = levelReport({
      axes: [
        axisReport({
          outcome: 'UNPROVEN',
          requirements: [unprovenRequirement('size', 'L', 'CONFLICTING')],
        }),
      ],
    })
    const report = assessmentReport({
      next: blue,
      levels: [blue],
      blocking: [practiceBlocker('blue', 'size'), evidenceBlocker('blue', 'size', 'CLAIMED')],
    })
    const output = renderJsonReport(report)
    expect(output).toContain('"outcome": "UNPROVEN"')
    expect(output).toContain('"evidence": "CONFLICTING"')
    // `gap` is a legitimate contract key: it must appear verbatim...
    expect(output).toContain('"gap": "PRACTICE"')
    expect(output).toContain('"gap": "EVIDENCE"')
    // ...but the human renderer's prose glosses for the same data must not.
    expect(output).not.toMatch(/practice gap/i)
    expect(output).not.toMatch(/evidence gap/i)
    expect(output).not.toMatch(/timed out/i)
  })

  it('renders a TIMED_OUT provenance status verbatim, without glossing it into words', () => {
    const report = assessmentReport({
      provenance: [
        failedProvenance('live-repository', ['harness'], 'budget exceeded', 'TIMED_OUT'),
      ],
    })
    const output = renderJsonReport(report)
    expect(output).toContain('"status": "TIMED_OUT"')
    expect(output).not.toMatch(/timed out/i)
  })
})

describe('6. rendering is deterministic', () => {
  it('renders the same report twice to the identical string', () => {
    const report = assessmentReport()
    expect(renderJsonReport(report)).toEqual(renderJsonReport(report))
  })

  it('renders two structurally equal reports built in different key order at every depth identically', () => {
    const requirementA: RequirementReport = metRequirement('size', 'L', 'L')
    const requirementB: RequirementReport = {
      outcome: 'MET',
      evidence: 'CONFIRMED',
      observed: 'L',
      threshold: 'L',
      axis: 'size',
    }

    const axisA: AxisReport = axisReport({ requirements: [requirementA] })
    const axisB: AxisReport = {
      requirements: [requirementB],
      outcome: 'MET',
      label: 'Taille',
      axis: 'size',
    }

    const levelA: LevelReport = levelReport({ axes: [axisA] })
    const levelB: LevelReport = {
      axes: [axisB],
      outcome: 'MET',
      label: 'Blue',
      rank: 1,
      id: 'blue',
    }

    const blockerA: BlockingRequirement = practiceBlocker('blue', 'size')
    const blockerB: BlockingRequirement = {
      gap: 'PRACTICE',
      outcome: 'NOT_MET',
      evidence: 'CONFIRMED',
      axis: 'size',
      level: 'blue',
    }

    const provenanceA: ProvenanceEntry = {
      collector: 'fixture-collector',
      status: 'COMPLETED',
      axes: ['size'],
    }
    const provenanceB: ProvenanceEntry = {
      axes: ['size'],
      status: 'COMPLETED',
      collector: 'fixture-collector',
    }

    const reportA = assessmentReport({
      proven: levelA,
      next: null,
      levels: [levelA],
      blocking: [blockerA],
      provenance: [provenanceA],
    })
    const reportB: AssessmentReport = {
      provenance: [provenanceB],
      coverage: { ...reportA.coverage },
      blocking: [blockerB],
      levels: [levelB],
      demonstrated: null,
      next: null,
      proven: levelB,
      subject: { path: reportA.subject.path },
      model: { schemaVersion: reportA.model.schemaVersion, id: reportA.model.id },
      schemaVersion: reportA.schemaVersion,
    }

    expect(renderJsonReport(reportB)).toEqual(renderJsonReport(reportA))
  })
})

describe('7. a field outside the contract never reaches the output', () => {
  it('drops a property the contract does not declare, at every depth', () => {
    const requirement = { ...metRequirement('size', 'L', 'L'), extra: 'nope' }
    const axis = { ...axisReport({ requirements: [requirement] }), extra: 'nope' }
    const level = { ...levelReport({ axes: [axis] }), extra: 'nope' }
    const blocker = { ...practiceBlocker('blue', 'size'), extra: 'nope' }
    const provenanceEntry = {
      collector: 'fixture-collector',
      status: 'COMPLETED' as const,
      axes: ['size'],
      extra: 'nope',
    }
    const base = assessmentReport({
      proven: level,
      next: null,
      levels: [level],
      blocking: [blocker],
      provenance: [provenanceEntry],
    })
    const polluted = {
      ...base,
      model: { ...base.model, extra: 'nope' },
      subject: { ...base.subject, extra: 'nope' },
      coverage: { ...base.coverage, extra: 'nope' },
      extra: 'nope',
    } as AssessmentReport & { extra: string }

    const output = renderJsonReport(polluted)
    expect(output).not.toContain('extra')
    expect(output).not.toContain('nope')
  })
})

describe('8. arrays are never sorted or deduped', () => {
  it('renders levels in the input order, not by rank', () => {
    const copper = levelReport({ id: 'copper', rank: 4, label: 'Copper' })
    const blue = levelReport({ id: 'blue', rank: 1, label: 'Blue' })
    const green = levelReport({ id: 'green', rank: 2, label: 'Green' })
    const report = assessmentReport({
      proven: null,
      next: blue,
      levels: [copper, blue, green],
    })
    const output = renderJsonReport(report)
    const parsed = JSON.parse(output)
    expect(parsed.levels.map((level: LevelReport) => level.id)).toEqual(['copper', 'blue', 'green'])
  })

  it('renders provenance in the input order', () => {
    const report = assessmentReport({
      provenance: [
        failedProvenance('live-repository', ['harness'], 'git not found', 'TIMED_OUT'),
        { collector: 'fixture-collector', status: 'COMPLETED', axes: ['size'] },
        failedProvenance('remote-collector', ['parallelism'], 'not implemented', 'SKIPPED'),
      ],
    })
    const output = renderJsonReport(report)
    const parsed = JSON.parse(output)
    expect(parsed.provenance.map((entry: ProvenanceEntry) => entry.collector)).toEqual([
      'live-repository',
      'fixture-collector',
      'remote-collector',
    ])
  })

  it('renders a duplicate provenance entry twice, not deduped', () => {
    const duplicate: ProvenanceEntry = {
      collector: 'fixture-collector',
      status: 'COMPLETED',
      axes: ['size'],
    }
    const report = assessmentReport({ provenance: [duplicate, duplicate] })
    const output = renderJsonReport(report)
    const parsed = JSON.parse(output)
    expect(parsed.provenance).toEqual([duplicate, duplicate])
  })

  it("renders a level's axes in the input order", () => {
    const blue = levelReport({
      axes: [
        axisReport({ axis: 'parallelism', label: 'En parallele' }),
        axisReport({ axis: 'size', label: 'Taille' }),
        axisReport({ axis: 'harness', label: 'Harness' }),
      ],
    })
    const output = renderJsonReport(assessmentReport({ next: blue, levels: [blue] }))
    const parsed = JSON.parse(output)
    expect(parsed.levels[0].axes.map((axis: AxisReport) => axis.axis)).toEqual([
      'parallelism',
      'size',
      'harness',
    ])
  })

  // INVARIANT: two blockers can legitimately be byte-identical; deduping them would drop a count
  // the consumer is entitled to.
  it('renders two identical blocking requirements twice, not deduped', () => {
    const blocker = practiceBlocker('blue', 'size')
    const output = renderJsonReport(assessmentReport({ blocking: [blocker, blocker] }))
    const parsed = JSON.parse(output)
    expect(parsed.blocking).toEqual([blocker, blocker])
  })
})

describe('9. a proven level round-trips as that level', () => {
  it('preserves id, rank, label, outcome and axes of a non-null proven level', () => {
    const proven = levelReport({
      id: 'copper',
      rank: 4,
      label: 'Copper',
      outcome: 'MET',
      axes: [
        axisReport({
          axis: 'size',
          label: 'Taille',
          outcome: 'MET',
          requirements: [metRequirement('size', 'L', 'L')],
        }),
      ],
    })
    const report = assessmentReport({ proven, next: null, levels: [proven] })
    const output = renderJsonReport(report)
    const parsed = JSON.parse(output)
    expect(parsed.proven).toEqual(proven)
  })
})

describe('10. coverage counters and header scalars are each proven distinct', () => {
  it('renders axesRequested, axesObserved and axesConfirmed without transposition', () => {
    const report = assessmentReport({
      coverage: { axesRequested: 4, axesObserved: 3, axesConfirmed: 1 },
    })
    const output = renderJsonReport(report)
    const parsed = JSON.parse(output)
    expect(parsed.coverage).toEqual({ axesRequested: 4, axesObserved: 3, axesConfirmed: 1 })
  })

  it('renders subject.path from the input, not a hard-coded constant', () => {
    const report = assessmentReport({ subject: { path: '/workspace/distinct-repo' } })
    const output = renderJsonReport(report)
    const parsed = JSON.parse(output)
    expect(parsed.subject.path).toBe('/workspace/distinct-repo')
  })

  it('renders model.schemaVersion from the input, not a hard-coded constant', () => {
    const report = assessmentReport({ model: { id: 'aidd', schemaVersion: 7 } })
    const output = renderJsonReport(report)
    const parsed = JSON.parse(output)
    expect(parsed.model.schemaVersion).toBe(7)
  })

  // INVARIANT: model.id lets a consumer tell a custom --model result from canonical AIDD;
  // hard-coding it would misattribute the verdict.
  it('renders model.id from the input, so a custom --model is not reported as the canonical one', () => {
    const report = assessmentReport({ model: { id: 'custom-house-model', schemaVersion: 1 } })
    const output = renderJsonReport(report)
    const parsed = JSON.parse(output)
    expect(parsed.model.id).toBe('custom-house-model')
  })
})

describe('11. indentation width is pinned', () => {
  it('renders with exactly two spaces per indent level', () => {
    const output = renderJsonReport(assessmentReport())
    expect(output).toBe(JSON.stringify(JSON.parse(output), null, 2))
  })
})

describe('12. a non-finite number is refused, never published as null', () => {
  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('refuses a %s observed value rather than rendering it as null', (_name, value) => {
    const blue = levelReport({
      axes: [
        axisReport({
          axis: 'parallelism',
          label: 'En parallele',
          requirements: [metRequirement('parallelism', 1, value)],
        }),
      ],
    })
    const report = assessmentReport({ next: blue, levels: [blue] })
    expect(() => renderJsonReport(report)).toThrow(UnrenderableReportError)
  })

  it('refuses a non-finite coverage counter', () => {
    const report = assessmentReport({
      coverage: { axesRequested: 4, axesObserved: Number.NaN, axesConfirmed: 1 },
    })
    expect(() => renderJsonReport(report)).toThrow(UnrenderableReportError)
  })

  it('refuses a non-finite demonstrated share, naming the path it sits on', () => {
    const copper = levelReport({ id: 'copper', rank: 4, label: 'Copper' })
    const report = assessmentReport({
      demonstrated: {
        level: { id: copper.id, rank: copper.rank, label: copper.label, outcome: copper.outcome },
        axes: [{ axis: 'size', observed: 'L', share: Number.NaN, unit: 'DELIVERIES' }],
      },
    })

    // INVARIANT: a share is what separates a demonstrated value from a maximum. JSON renders NaN as
    // null, which this contract reads as absence, so publishing it would hand the reader a
    // demonstrated level it cannot weigh — the one thing this reading must never become.
    expect(() => renderJsonReport(report)).toThrow(UnrenderableReportError)
    expect(() => renderJsonReport(report)).toThrow(/\$\.demonstrated\.axes\[0\]\.share/)
  })

  it('refuses a non-finite level rank', () => {
    const blue = levelReport({ rank: Number.NaN })
    const report = assessmentReport({ next: blue, levels: [blue] })
    expect(() => renderJsonReport(report)).toThrow(UnrenderableReportError)
  })

  it('names the offending path, so the producer can find it', () => {
    const report = assessmentReport({
      coverage: { axesRequested: 4, axesObserved: Number.NaN, axesConfirmed: 1 },
    })
    expect(() => renderJsonReport(report)).toThrow(/coverage\.axesObserved/)
  })

  it('refuses before emitting anything, so no partial document escapes', () => {
    const report = assessmentReport({
      coverage: { axesRequested: 4, axesObserved: Number.NaN, axesConfirmed: 1 },
    })
    let output: string | undefined
    try {
      output = renderJsonReport(report)
    } catch {
      output = undefined
    }
    expect(output).toBeUndefined()
  })

  it('still renders a report whose numbers are all finite, including zero', () => {
    const report = assessmentReport({
      coverage: { axesRequested: 4, axesObserved: 0, axesConfirmed: 0 },
    })
    const parsed = JSON.parse(renderJsonReport(report))
    expect(parsed.coverage).toEqual({ axesRequested: 4, axesObserved: 0, axesConfirmed: 0 })
  })
})

describe('13. many reports render as an array of the same documents', () => {
  it('parses as an array whose every element deep-equals that subject’s own single-report document', () => {
    const first = assessmentReport({ subject: { path: '/repo/first' } })
    const second = assessmentReport({ subject: { path: '/repo/second' } })

    const parsed = JSON.parse(renderJsonReports([first, second]))

    expect(parsed).toEqual([
      JSON.parse(renderJsonReport(first)),
      JSON.parse(renderJsonReport(second)),
    ])
  })

  it('refuses the whole array when any one report carries a non-finite number, naming its index', () => {
    const ok = assessmentReport({ subject: { path: '/repo/ok' } })
    const broken = assessmentReport({
      subject: { path: '/repo/broken' },
      coverage: { axesRequested: 4, axesObserved: Number.NaN, axesConfirmed: 1 },
    })

    expect(() => renderJsonReports([ok, broken])).toThrow(UnrenderableReportError)
    expect(() => renderJsonReports([ok, broken])).toThrow(/\$\[1\]\./)
  })

  it('leaves the single-report entry point unchanged', () => {
    const report = assessmentReport()

    expect(JSON.parse(renderJsonReport(report))).toEqual(JSON.parse(renderJsonReports([report]))[0])
  })
})
