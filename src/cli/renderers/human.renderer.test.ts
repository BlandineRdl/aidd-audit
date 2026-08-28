import { describe, expect, it } from 'vitest'
import { renderHumanReport } from './human.renderer.js'
import {
  assessmentReport,
  axisReport,
  evidenceBlocker,
  failedProvenance,
  levelReport,
  notMetRequirement,
  practiceBlocker,
  unprovenRequirement,
} from './assessment-report.test-fixture.js'

const provenParagraph = (output: string) =>
  output.split('\n\n').find((paragraph) => paragraph.startsWith('Proven level:'))

const coverageParagraph = (output: string) =>
  output.split('\n\n').find((paragraph) => paragraph.startsWith('Evidence coverage:'))

const incompleteCollectorsParagraph = (output: string) =>
  output
    .split('\n\n')
    .find((paragraph) => paragraph.startsWith('Collectors that did not complete:'))

const blockerLine = (output: string, kind: 'practice' | 'evidence') =>
  output.split('\n').find((line) => line.includes(`[${kind} gap]`))

describe('1. a proven level exists', () => {
  const copper = levelReport({ id: 'copper', rank: 4, label: 'Copper' })
  const green = levelReport({ id: 'green', rank: 3, label: 'Green' })
  const report = assessmentReport({ proven: green, next: copper, levels: [green, copper] })
  const output = renderHumanReport(report)

  it('names the proven level', () => {
    expect(output).toContain('Proven level: Green (rank 3)')
  })

  it('names the next level', () => {
    expect(output).toContain('Next level: Copper (rank 4)')
  })
})

describe('2. no level can be proven', () => {
  it('states that AIDD could not establish a maturity level', () => {
    const output = renderHumanReport(assessmentReport({ proven: null, levels: [] }))
    expect(provenParagraph(output)).toContain('could not be established')
  })

  it('never names White as the proven result, even though the same word may legitimately name a blocked level', () => {
    const white = levelReport({ id: 'white', rank: 0, label: 'White' })
    const report = assessmentReport({
      proven: null,
      next: white,
      levels: [white],
      blocking: [practiceBlocker('white', 'size')],
    })
    const output = renderHumanReport(report)
    expect(provenParagraph(output)).not.toContain('White')
    expect(output).toContain('White')
  })

  it('never blames evidence when the baseline failed on a confirmed practice instead', () => {
    const blue = levelReport({
      axes: [
        axisReport({
          axis: 'size',
          label: 'Taille',
          outcome: 'NOT_MET',
          requirements: [notMetRequirement('size', 'L', 'S')],
        }),
      ],
    })
    const report = assessmentReport({
      proven: null,
      next: blue,
      levels: [blue],
      blocking: [practiceBlocker('blue', 'size')],
      coverage: { axesRequested: 4, axesObserved: 4, axesConfirmed: 4 },
      provenance: [{ collector: 'fixture-collector', status: 'COMPLETED', axes: ['size'] }],
    })
    const output = renderHumanReport(report)
    expect(provenParagraph(output)).not.toMatch(/evidence|insufficient/i)
    expect(coverageParagraph(output)).toContain('4 of 4 axes confirmed')
    expect(blockerLine(output, 'practice')).toContain('does not reach')
  })
})

describe('3. a practice gap blocks progression', () => {
  const blue = levelReport({
    axes: [
      axisReport({
        axis: 'size',
        label: 'Taille',
        outcome: 'NOT_MET',
        requirements: [notMetRequirement('size', 'L', 'M')],
      }),
    ],
  })
  const report = assessmentReport({
    proven: null,
    next: blue,
    levels: [blue],
    blocking: [practiceBlocker('blue', 'size')],
  })
  const line = blockerLine(renderHumanReport(report), 'practice')

  it('says the observed practice is below what the requirement asks', () => {
    expect(line).toMatch(/does not reach|below/)
  })

  it('shows the observed value against the threshold', () => {
    expect(line).toContain('observed M')
    expect(line).toContain('required L')
  })
})

describe('4. an evidence gap blocks progression', () => {
  const buildReport = (evidence: 'UNKNOWN' | 'CLAIMED' | 'CONFLICTING') => {
    const blue = levelReport({
      axes: [
        axisReport({
          axis: 'harness',
          label: 'Harness',
          outcome: 'UNPROVEN',
          requirements: [unprovenRequirement('harness', ['prompts'], evidence)],
        }),
      ],
    })
    return assessmentReport({
      proven: null,
      next: blue,
      levels: [blue],
      blocking: [evidenceBlocker('blue', 'harness', evidence)],
    })
  }

  it.each([
    ['UNKNOWN', 'no observable evidence was established'],
    ['CLAIMED', 'the claim could not be independently confirmed'],
    ['CONFLICTING', 'observed evidence disagrees'],
  ] as const)('explains a %s evidence gap in its own terms', (evidence, explanation) => {
    const line = blockerLine(renderHumanReport(buildReport(evidence)), 'evidence')
    expect(line).toContain(explanation)
  })

  it('never explains two different evidence statuses the same way', () => {
    const explanations = (['UNKNOWN', 'CLAIMED', 'CONFLICTING'] as const).map((evidence) =>
      blockerLine(renderHumanReport(buildReport(evidence)), 'evidence'),
    )
    expect(new Set(explanations).size).toBe(explanations.length)
  })

  it.each(['UNKNOWN', 'CLAIMED', 'CONFLICTING'] as const)(
    'never recommends changing the practice for a %s gap, and never says it falls short',
    (evidence) => {
      const line = blockerLine(renderHumanReport(buildReport(evidence)), 'evidence')
      expect(line).not.toMatch(/improve|fix|change|does not reach|falls short|below/i)
    },
  )
})

describe('5. the two gaps never read alike', () => {
  // The engine emits one AxisReport per axis, never two.
  const blue = levelReport({
    axes: [
      axisReport({
        axis: 'size',
        label: 'Taille',
        outcome: 'NOT_MET',
        requirements: [
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
    blocking: [practiceBlocker('blue', 'size'), evidenceBlocker('blue', 'size', 'UNKNOWN')],
  })
  const output = renderHumanReport(report)

  it('produces two distinct lines for the same axis', () => {
    const practice = blockerLine(output, 'practice')
    const evidence = blockerLine(output, 'evidence')
    expect(practice).toBeDefined()
    expect(evidence).toBeDefined()
    expect(practice).not.toEqual(evidence)
  })

  it('tags each line with its own gap kind, so a future refactor cannot collapse them', () => {
    expect(output).toContain('[practice gap]')
    expect(output).toContain('[evidence gap]')
  })
})

describe('6. a null-proven report names what is missing', () => {
  const blue = levelReport()
  const report = assessmentReport({
    proven: null,
    next: blue,
    levels: [blue],
    coverage: { axesRequested: 4, axesObserved: 2, axesConfirmed: 1 },
    provenance: [
      failedProvenance('live-repository', ['harness'], 'git not found'),
      { collector: 'fixture-collector', status: 'COMPLETED', axes: ['size'] },
    ],
  })
  const output = renderHumanReport(report)

  it('reports axes observed and confirmed against axes requested', () => {
    expect(coverageParagraph(output)).toContain('1 of 4 axes confirmed')
    expect(coverageParagraph(output)).toContain('2 observed')
  })

  it('names every provenance entry that did not complete, with its reason and its axes', () => {
    const paragraph = incompleteCollectorsParagraph(output)
    expect(paragraph).toContain('live-repository')
    expect(paragraph).toContain('git not found')
    expect(paragraph).toContain('harness')
  })

  it('does not name a collector that completed', () => {
    expect(incompleteCollectorsParagraph(output)).not.toContain('fixture-collector')
  })

  it('is silent about coverage counts once a level is proven, because the counts are trivially full', () => {
    const proven = renderHumanReport(assessmentReport())
    expect(coverageParagraph(proven)).toBeUndefined()
  })
})

describe('7. an ambiguous threshold is never guessed', () => {
  const blue = levelReport({
    axes: [
      axisReport({
        axis: 'size',
        label: 'Taille',
        outcome: 'NOT_MET',
        // A `--model` level may declare this; aidd.yml does not.
        requirements: [notMetRequirement('size', 'M', 'S'), notMetRequirement('size', 'L', 'S')],
      }),
    ],
  })
  const report = assessmentReport({
    proven: null,
    next: blue,
    levels: [blue],
    blocking: [practiceBlocker('blue', 'size')],
  })
  const line = blockerLine(renderHumanReport(report), 'practice')

  it('renders the blocker without quoting either threshold', () => {
    expect(line).not.toContain('required')
  })

  it('still names the axis and the level', () => {
    expect(line).toContain('Taille')
    expect(line).toContain('Blue')
  })

  it('still states that the practice does not meet the requirement, instead of an empty line', () => {
    expect(line).toContain('the observed practice does not meet the requirement')
  })
})

describe('8. a blocker naming an id the report no longer carries still renders', () => {
  it('falls back to the raw level and axis id for a practice gap', () => {
    const report = assessmentReport({
      proven: null,
      levels: [levelReport()],
      blocking: [practiceBlocker('ghost-level', 'ghost-axis')],
    })
    const line = blockerLine(renderHumanReport(report), 'practice')
    expect(line).toContain('ghost-axis at ghost-level')
  })

  it('falls back to the raw level and axis id for an evidence gap', () => {
    const report = assessmentReport({
      proven: null,
      levels: [levelReport()],
      blocking: [evidenceBlocker('ghost-level', 'ghost-axis')],
    })
    const line = blockerLine(renderHumanReport(report), 'evidence')
    expect(line).toContain('ghost-axis at ghost-level')
  })
})

describe('9. the axis outcomes are glossed', () => {
  // Rendered as `next`: the engine never proves a level carrying a NOT_MET axis.
  const blue = levelReport({
    outcome: 'NOT_MET',
    axes: [
      axisReport({ axis: 'size', label: 'Taille', outcome: 'MET' }),
      axisReport({
        axis: 'harness',
        label: 'Harness',
        outcome: 'NOT_MET',
        requirements: [notMetRequirement('harness', ['prompts'], [])],
      }),
      axisReport({
        axis: 'parallelism',
        label: 'En parallèle',
        outcome: 'UNPROVEN',
        requirements: [unprovenRequirement('parallelism', 1, 'UNKNOWN')],
      }),
    ],
  })
  const output = renderHumanReport(assessmentReport({ proven: null, next: blue, levels: [blue] }))

  it('leaves MET unglossed', () => {
    expect(output).toContain('Taille: MET')
  })

  it('glosses NOT_MET as a practice gap', () => {
    expect(output).toMatch(/Harness: NOT_MET.*practice gap/)
  })

  it('glosses UNPROVEN as an evidence gap', () => {
    expect(output).toMatch(/En parallèle: UNPROVEN.*evidence gap/)
  })
})

describe('a collector that did not complete is always reported, proven level or not', () => {
  const green = levelReport({ id: 'green', rank: 3, label: 'Green' })
  const report = assessmentReport({
    proven: green,
    next: null,
    levels: [green],
    provenance: [
      { collector: 'fixture-collector', status: 'COMPLETED', axes: ['size'] },
      failedProvenance(
        'live-repository',
        ['harness', 'parallelism'],
        'budget exceeded after 30s',
        'TIMED_OUT',
      ),
    ],
  })
  const output = renderHumanReport(report)
  const paragraph = incompleteCollectorsParagraph(output)

  it('names the collector even though a level is proven', () => {
    expect(output).toContain('Proven level: Green (rank 3)')
    expect(paragraph).toBeDefined()
    expect(paragraph).toContain('live-repository')
  })

  it('glosses TIMED_OUT into words instead of the raw enum token', () => {
    expect(paragraph).toContain('timed out')
    expect(paragraph).not.toMatch(/TIMED_OUT|timed_out/)
  })

  it('names the axes the collector was carrying, not just how many are missing', () => {
    expect(paragraph).toContain('harness, parallelism')
  })

  it('carries the reason', () => {
    expect(paragraph).toContain('budget exceeded after 30s')
  })

  it('never renders the trivially-full coverage counts for a proven level', () => {
    expect(coverageParagraph(output)).toBeUndefined()
  })
})
