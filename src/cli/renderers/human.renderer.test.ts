import { describe, expect, it } from 'vitest'
import { renderHumanReport, renderHumanReports } from './human.renderer.js'
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
    ['UNKNOWN', 'and no value was observed'],
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
      expect(line).not.toMatch(/\b(improve|fix|change|below)\b|does not reach|falls short/i)
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

describe('10. no collector ran at all', () => {
  const noCollectorsParagraph = (output: string) =>
    output.split('\n\n').find((paragraph) => paragraph.startsWith('No collector ran'))

  it('says plainly that nothing was observed, distinct from the practice and evidence gaps', () => {
    const blue = levelReport()
    const report = assessmentReport({
      proven: null,
      next: blue,
      levels: [blue],
      coverage: { axesRequested: 4, axesObserved: 0, axesConfirmed: 0 },
      provenance: [],
    })
    const output = renderHumanReport(report)
    expect(noCollectorsParagraph(output)).toContain('No collector ran')
    expect(noCollectorsParagraph(output)).toContain('did not look')
  })

  it('is silent once at least one collector ran, even if none completed', () => {
    const blue = levelReport()
    const report = assessmentReport({
      proven: null,
      next: blue,
      levels: [blue],
      provenance: [failedProvenance('live-repository', ['harness'], 'git not found')],
    })
    const output = renderHumanReport(report)
    expect(noCollectorsParagraph(output)).toBeUndefined()
  })

  it('is silent when a collector ran and completed', () => {
    const output = renderHumanReport(assessmentReport())
    expect(noCollectorsParagraph(output)).toBeUndefined()
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

describe('11. every axis names what was observed against what its level required', () => {
  const axisDetail = (output: string, label: string) => {
    const lines = output.split('\n')
    const start = lines.findIndex((line) => line.trimStart().startsWith(`${label}:`))
    const detail: string[] = []
    for (const line of lines.slice(start + 1)) {
      if (!line.startsWith('    ')) break
      detail.push(line)
    }
    return detail.join('\n')
  }

  const blue = levelReport({
    axes: [
      axisReport({
        axis: 'harness',
        label: 'Harness',
        outcome: 'MET',
        requirements: [metRequirement('harness', ['prompts'], ['prompts', 'behavior'])],
      }),
      axisReport({
        axis: 'size',
        label: 'Taille',
        outcome: 'UNPROVEN',
        requirements: [unprovenRequirement('size', 'L', 'UNKNOWN')],
      }),
    ],
  })
  const output = renderHumanReport(assessmentReport({ proven: null, next: blue, levels: [blue] }))

  it('names the observed value, so a reader learns what AIDD saw and not only its verdict', () => {
    expect(axisDetail(output, 'Harness')).toContain('prompts, behavior')
  })

  it('names what the level required, next to it', () => {
    expect(axisDetail(output, 'Harness')).toContain('required: prompts')
  })

  it('carries the evidence status, so a claim is never read as a confirmed observation', () => {
    const claimed = renderHumanReport(
      assessmentReport({
        proven: null,
        next: levelReport({
          axes: [
            axisReport({
              axis: 'size',
              label: 'Taille',
              outcome: 'UNPROVEN',
              requirements: [unprovenRequirement('size', 'L', 'CLAIMED', 'M')],
            }),
          ],
        }),
        levels: [],
      }),
    )
    expect(axisDetail(claimed, 'Taille')).toContain('observed: M')
    expect(axisDetail(claimed, 'Taille')).toContain('(CLAIMED)')
  })

  it('never renders an unobserved axis the same way as one observed to hold nothing', () => {
    const unobserved = axisDetail(output, 'Taille')
    const empty = renderHumanReport(
      assessmentReport({
        proven: null,
        next: levelReport({
          axes: [
            axisReport({
              axis: 'harness',
              label: 'Harness',
              outcome: 'NOT_MET',
              requirements: [notMetRequirement('harness', ['prompts'], [])],
            }),
          ],
        }),
        levels: [],
      }),
    )
    expect(unobserved).toContain('no observation was made')
    expect(unobserved).not.toContain('observed:')
    expect(axisDetail(empty, 'Harness')).toContain('observed: an empty set')
  })

  it('renders an empty requirement as the empty set, not as a blank', () => {
    const white = renderHumanReport(
      assessmentReport({
        proven: null,
        next: levelReport({
          id: 'white',
          rank: 0,
          label: 'White',
          axes: [
            axisReport({
              axis: 'harness',
              label: 'Harness',
              outcome: 'MET',
              requirements: [metRequirement('harness', [], ['prompts'])],
            }),
          ],
        }),
        levels: [],
      }),
    )
    expect(axisDetail(white, 'Harness')).toContain('required: an empty set')
    expect(axisDetail(white, 'Harness')).not.toMatch(/required: *·/)
  })

  it('details every requirement when an axis carries more than one', () => {
    const twofold = renderHumanReport(
      assessmentReport({
        proven: null,
        next: levelReport({
          axes: [
            axisReport({
              axis: 'size',
              label: 'Taille',
              outcome: 'NOT_MET',
              requirements: [
                notMetRequirement('size', 'M', 'S'),
                notMetRequirement('size', 'L', 'S'),
              ],
            }),
          ],
        }),
        levels: [],
      }),
    )
    expect(axisDetail(twofold, 'Taille')).toContain('required: M')
    expect(axisDetail(twofold, 'Taille')).toContain('required: L')
  })

  it('carries CONFIRMED into prose too, so the happy path is not the unlabelled one', () => {
    expect(axisDetail(output, 'Harness')).toContain('(CONFIRMED)')
  })

  it('never states a threshold for a requirement no observation was compared against', () => {
    const detail = axisDetail(output, 'Taille')
    expect(detail).not.toContain('required:')
    expect(detail).toContain('never tested')
  })

  it('details the proven level too, not only the next one', () => {
    const green = levelReport({
      id: 'green',
      rank: 3,
      label: 'Green',
      axes: [
        axisReport({
          axis: 'harness',
          label: 'Harness',
          outcome: 'MET',
          requirements: [metRequirement('harness', ['prompts'], ['prompts', 'loops'])],
        }),
      ],
    })
    const proven = renderHumanReport(
      assessmentReport({ proven: green, next: null, levels: [green] }),
    )
    expect(axisDetail(proven, 'Harness')).toContain('prompts, loops')
  })
})

describe('12. what the subject reached is reported beneath what it holds, never instead', () => {
  const blue = levelReport({ id: 'blue', rank: 2, label: 'Blue' })
  const copper = levelReport({ id: 'copper', rank: 4, label: 'Copper' })

  const withDemonstrated = (level = copper, proven = blue) =>
    renderHumanReport(
      assessmentReport({
        proven,
        levels: [proven, level],
        demonstrated: {
          level,
          axes: [
            { axis: 'size', observed: 'L', share: 0.398, unit: 'DELIVERIES' },
            { axis: 'parallelism', observed: 3, share: 0.4, unit: 'ACTIVE_DAYS' },
          ],
        },
      }),
    )

  const demonstratedParagraph = (output: string) =>
    output.split('\n\n').find((paragraph) => paragraph.startsWith('Demonstrated:'))

  it('names the demonstrated level only after the proven one', () => {
    const output = withDemonstrated()

    // INVARIANT: a reader quoting the first level they meet must quote the one the subject holds.
    expect(output.indexOf('Proven level:')).toBeLessThan(output.indexOf('Demonstrated:'))
  })

  it('never states a demonstrated value without the share that earned it', () => {
    const paragraph = demonstratedParagraph(withDemonstrated()) ?? ''
    const [level, ...axes] = paragraph.split('\n')

    // INVARIANT: the clause most likely to be dropped in a later edit, so it is asserted per line
    // rather than once for the paragraph — the level line included. That line carries no share of
    // its own, so it must not read as a finished sentence: it ends in a colon and is followed by at
    // least one line that does carry one.
    expect(level).toMatch(/reached on:$/)
    expect(axes.length).toBeGreaterThan(0)
    for (const line of axes) {
      expect(line).toMatch(/reached on \d+% of /)
    }
  })

  it('names what each share counts, because the two axes do not count the same occasions', () => {
    const paragraph = demonstratedParagraph(withDemonstrated()) ?? ''

    expect(paragraph).toContain('reached on 40% of delivered changes')
    expect(paragraph).toContain('reached on 40% of active days')
  })

  it('renders the share as a whole percentage, never as a fraction', () => {
    const paragraph = demonstratedParagraph(withDemonstrated()) ?? ''

    expect(paragraph).not.toContain('0.398')
    expect(paragraph).toContain('40%')
  })

  it('says nothing at all when no level could be established at all', () => {
    const output = renderHumanReport(
      assessmentReport({
        proven: null,
        levels: [copper],
        demonstrated: {
          level: copper,
          axes: [{ axis: 'parallelism', observed: 3, share: 0.44, unit: 'ACTIVE_DAYS' }],
        },
      }),
    )

    // INVARIANT: no ceiling without a floor. Printed here it would be the only level in a document
    // that says the subject could not be classified, handing a rank-4 label to a subject the tool
    // declined to place — the "quoted alone" failure this section exists to prevent.
    expect(output).toContain('could not be established')
    expect(output).not.toContain('Demonstrated:')
  })

  it('says nothing at all when the subject demonstrated no more than it holds', () => {
    // INVARIANT: the ordinary case. Every bundle and every source recording a median without its
    // distribution lands here, and must read exactly as it did before this section existed.
    expect(withDemonstrated(blue, blue)).not.toContain('Demonstrated:')
    expect(renderHumanReport(assessmentReport({ demonstrated: null }))).not.toContain(
      'Demonstrated:',
    )
  })
})

describe('13. many reports render separated and attributable', () => {
  it('contains each report’s own rendering, with its own subject line, in the same order', () => {
    const first = assessmentReport({ subject: { path: '/repo/first' } })
    const second = assessmentReport({ subject: { path: '/repo/second' } })

    const output = renderHumanReports([first, second])
    const firstIndex = output.indexOf('/repo/first')
    const secondIndex = output.indexOf('/repo/second')

    expect(output).toContain(renderHumanReport(first))
    expect(output).toContain(renderHumanReport(second))
    expect(firstIndex).toBeGreaterThanOrEqual(0)
    expect(secondIndex).toBeGreaterThan(firstIndex)
  })

  it('separates reports with a line no single report ever produces on its own', () => {
    const first = assessmentReport({ subject: { path: '/repo/first' } })
    const second = assessmentReport({ subject: { path: '/repo/second' } })
    // A line of repeated punctuation, not the section breaks a single report joins on.
    const separatorLine = /^[=]{2,}$/m

    expect(renderHumanReport(first)).not.toMatch(separatorLine)
    expect(renderHumanReports([first, second])).toMatch(separatorLine)
  })

  it('renders one report identically to the single-report entry point', () => {
    const report = assessmentReport()

    expect(renderHumanReports([report])).toBe(renderHumanReport(report))
  })
})
