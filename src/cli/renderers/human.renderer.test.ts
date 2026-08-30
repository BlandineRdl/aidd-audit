import { describe, expect, it } from 'vitest'
import { renderHumanReport } from './human.renderer.js'
import { colouredText } from './text-style.js'
import {
  assessmentReport,
  axisReport,
  completedRoster,
  contributorRow,
  evidenceBlocker,
  failedProvenance,
  failedRoster,
  levelReport,
  metRequirement,
  notMetRequirement,
  practiceBlocker,
  unprovenRequirement,
} from './assessment-report.test-fixture.js'

const provenParagraph = (output: string) =>
  output.split('\n\n').find((paragraph) => paragraph.startsWith('Niveau prouvé :'))

const coverageParagraph = (output: string) =>
  output.split('\n\n').find((paragraph) => paragraph.startsWith('Couverture :'))

const incompleteCollectorsParagraph = (output: string) =>
  output
    .split('\n\n')
    .find((paragraph) => paragraph.startsWith('Collecteurs sans réponse complète :'))

const gapLine = (output: string, kind: 'pratique' | 'preuve') =>
  output.split('\n').find((line) => line.includes(`[écart de ${kind}]`))

// The lines an axis owns: the marked axis line, then every requirement line beneath it.
const axisDetail = (output: string, label: string) => {
  const lines = output.split('\n')
  const start = lines.findIndex((line) => /^ {2}[✓✗?] /.test(line) && line.endsWith(` ${label}`))
  if (start < 0) throw new Error(`no axis line for ${label} in:\n${output}`)
  const detail: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('      ')) break
    detail.push(line)
  }
  return detail.join('\n')
}

describe('1. a proven level exists', () => {
  const copper = levelReport({ id: 'copper', rank: 4, label: 'Copper' })
  const green = levelReport({ id: 'green', rank: 3, label: 'Green' })
  const report = assessmentReport({ proven: green, next: copper, levels: [green, copper] })
  const output = renderHumanReport(report)

  it('names the proven level', () => {
    expect(output).toContain('Niveau prouvé : Green (rang 3)')
  })

  it('names the next level', () => {
    expect(output).toContain('Pour atteindre Copper (rang 4) :')
  })
})

describe('2. no level can be proven', () => {
  it('states that AIDD could not establish a maturity level', () => {
    const output = renderHumanReport(assessmentReport({ proven: null, levels: [] }))
    expect(provenParagraph(output)).toContain("Aucun niveau n'a pu être entièrement prouvé")
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
    expect(provenParagraph(output)).not.toMatch(/preuve|insuffisan/i)
    expect(coverageParagraph(output)).toContain('4/4 axes confirmés')
    expect(gapLine(output, 'pratique')).toContain('aujourd’hui : small (S)')
    expect(gapLine(output, 'preuve')).toBeUndefined()
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
  const output = renderHumanReport(report)
  const line = gapLine(output, 'pratique')

  it('says the observed practice is below what the requirement asks', () => {
    // INVARIANT: the gap kind is stated on the requirement line itself, so the values beside it
    // are read as a shortfall and never as an absence of evidence.
    expect(line).toBeDefined()
    expect(line).not.toContain('[écart de preuve]')
    expect(axisDetail(output, 'Taille')).toContain('[écart de pratique]')
  })

  it('states today’s practice, then the target for the next level', () => {
    expect(line).toContain('aujourd’hui : medium (M)')
    expect(axisDetail(output, 'Taille')).toContain('pour Blue : large (L).')
  })

  it('keeps ordinal codes discreetly beside their model-owned human meaning', () => {
    expect(line).toContain('medium (M)')
    expect(axisDetail(output, 'Taille')).toContain('large (L)')
  })

  it('names only the missing set capability for a harness practice gap', () => {
    const output = renderHumanReport(
      assessmentReport({
        proven: null,
        next: levelReport({
          axes: [
            axisReport({
              axis: 'harness',
              label: 'Harness',
              outcome: 'NOT_MET',
              requirements: [notMetRequirement('harness', ['prompts', 'behavior'], ['prompts'])],
            }),
          ],
        }),
        levels: [],
      }),
    )
    expect(axisDetail(output, 'Harness')).toContain('manque : guardrails (behavior)')
    expect(axisDetail(output, 'Harness')).not.toContain('observé')
  })

  it('uses the numeric description carried by the report instead of a bare number', () => {
    const output = renderHumanReport(
      assessmentReport({
        proven: null,
        next: levelReport({
          axes: [
            axisReport({
              axis: 'parallelism',
              label: 'En parallèle',
              requirements: [metRequirement('parallelism', 3, 7.5)],
            }),
          ],
        }),
        levels: [],
      }),
    )
    expect(axisDetail(output, 'En parallèle')).toContain('7.5 active work per day')
    expect(axisDetail(output, 'En parallèle')).toContain('minimum 3')
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
    ['UNKNOWN', 'aucune valeur observée'],
    ['CLAIMED', "la déclaration n'a pas pu être confirmée indépendamment"],
    ['CONFLICTING', 'les observations se contredisent'],
  ] as const)('explains a %s evidence gap in its own terms', (evidence, explanation) => {
    const line = gapLine(renderHumanReport(buildReport(evidence)), 'preuve')
    expect(line).toContain(explanation)
  })

  it('never explains two different evidence statuses the same way', () => {
    const explanations = (['UNKNOWN', 'CLAIMED', 'CONFLICTING'] as const).map((evidence) =>
      gapLine(renderHumanReport(buildReport(evidence)), 'preuve'),
    )
    expect(new Set(explanations).size).toBe(explanations.length)
  })

  it('names an insufficient active-day sample as evidence, not a practice gap', () => {
    const diagnostic = {
      collector: 'forge-repository',
      axis: 'parallelism',
      reason: 'INSUFFICIENT_ACTIVE_DAYS' as const,
      observed: 3,
      minimum: 5,
    }
    const blue = levelReport({
      axes: [
        axisReport({
          axis: 'parallelism',
          label: 'En parallèle',
          outcome: 'UNPROVEN',
          requirements: [unprovenRequirement('parallelism', 1, 'UNKNOWN', null, diagnostic)],
        }),
      ],
    })
    const output = renderHumanReport(
      assessmentReport({
        proven: null,
        next: blue,
        levels: [blue],
        blocking: [evidenceBlocker('blue', 'parallelism')],
      }),
    )

    expect(output).toContain(
      'échantillon insuffisant : 3 jours actifs de PR observés, minimum 5 requis',
    )
    expect(output).not.toContain('[écart de pratique]')
  })

  it.each(['UNKNOWN', 'CLAIMED', 'CONFLICTING'] as const)(
    'never recommends changing the practice for a %s gap, and never says it falls short',
    (evidence) => {
      const line = gapLine(renderHumanReport(buildReport(evidence)), 'preuve')
      expect(line).not.toContain('[écart de pratique]')
      expect(line).not.toMatch(/\b(améliorer|corriger|changer)\b|en deçà|n'atteint pas|insuffisan/i)
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
    const practice = gapLine(output, 'pratique')
    const evidence = gapLine(output, 'preuve')
    expect(practice).toBeDefined()
    expect(evidence).toBeDefined()
    expect(practice).not.toEqual(evidence)
  })

  it('tags each line with its own gap kind, so a future refactor cannot collapse them', () => {
    expect(output).toContain('[écart de pratique]')
    expect(output).toContain('[écart de preuve]')
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
    expect(coverageParagraph(output)).toContain('1/4 axes confirmés')
    expect(coverageParagraph(output)).toContain('2/4 observés')
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

describe('7. an axis carrying several requirements renders every one, so no threshold is chosen', () => {
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
  const output = renderHumanReport(report)
  const detail = axisDetail(output, 'Taille')

  it('quotes both thresholds rather than choosing between them', () => {
    expect(detail).toContain('pour Blue : medium (M).')
    expect(detail).toContain('pour Blue : large (L).')
  })

  it('still names the axis and the level', () => {
    expect(output).toContain('Taille')
    expect(output).toContain('Pour atteindre Blue')
  })

  it('states that each observed value does not meet its requirement', () => {
    expect(detail.split('\n').filter((line) => line.includes('[écart de pratique]'))).toHaveLength(
      2,
    )
  })
})

describe('8. a blocker naming an id the report no longer carries still renders', () => {
  it('falls back to the raw level and axis id for a practice gap', () => {
    const report = assessmentReport({
      proven: null,
      levels: [levelReport()],
      blocking: [practiceBlocker('ghost-level', 'ghost-axis')],
    })
    const line = gapLine(renderHumanReport(report), 'pratique')
    expect(line).toContain('ghost-axis à ghost-level')
  })

  it('falls back to the raw level and axis id for an evidence gap', () => {
    const report = assessmentReport({
      proven: null,
      levels: [levelReport()],
      blocking: [evidenceBlocker('ghost-level', 'ghost-axis')],
    })
    const line = gapLine(renderHumanReport(report), 'preuve')
    expect(line).toContain('ghost-axis à ghost-level')
  })
})

describe('10. no collector ran at all', () => {
  const noCollectorsParagraph = (output: string) =>
    output.split('\n\n').find((paragraph) => paragraph.startsWith('Aucun collecteur'))

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
    expect(noCollectorsParagraph(output)).toContain("Aucun collecteur n'a tourné")
    expect(noCollectorsParagraph(output)).toContain("n'a pas regardé")
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

describe('9. the axis outcomes are marked and their gaps glossed', () => {
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
    expect(output).toContain('✓ Taille')
    expect(axisDetail(output, 'Taille')).not.toContain('[écart')
  })

  it('glosses NOT_MET as a practice gap', () => {
    expect(output).toContain('✗ Harness')
    expect(axisDetail(output, 'Harness')).toContain('[écart de pratique]')
  })

  it('glosses UNPROVEN as an evidence gap', () => {
    expect(output).toContain('? En parallèle')
    expect(axisDetail(output, 'En parallèle')).toContain('[écart de preuve]')
  })

  it('marks the three outcomes differently, so an axis is placed before it is read', () => {
    expect(new Set(['✓', '✗', '?']).size).toBe(3)
    expect(output).not.toMatch(/MET|UNPROVEN/)
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
    expect(output).toContain('Niveau prouvé : Green (rang 3)')
    expect(paragraph).toBeDefined()
    expect(paragraph).toContain('live-repository')
  })

  it('glosses TIMED_OUT into words instead of the raw enum token', () => {
    expect(paragraph).toContain('délai dépassé')
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

  it('names in the header the collectors that did complete', () => {
    expect(output.split('\n\n')[0]).toContain('collecteurs : fixture-collector')
  })
})

describe('11. every axis names what was observed against what its level required', () => {
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

  it('summarises a satisfied set requirement once instead of repeating the same descriptions', () => {
    expect(axisDetail(output, 'Harness')).toContain('requis atteint : prompts')
  })

  it('names what the level required, next to it', () => {
    expect(axisDetail(output, 'Harness')).toContain('requis atteint')
  })

  it('uses the report vocabulary to explain raw scale terms', () => {
    const output = renderHumanReport(
      assessmentReport({
        proven: null,
        next: blue,
        levels: [blue],
        vocabulary: [
          {
            axis: 'harness',
            kind: 'set',
            members: ['prompts', 'behavior'],
            descriptions: { prompts: 'custom prompts', behavior: 'custom guardrails' },
          },
        ],
      }),
    )
    expect(axisDetail(output, 'Harness')).toContain('custom prompts')
    expect(axisDetail(output, 'Harness')).not.toContain('règles, agents')
  })

  it('explains an ordinal token from the same report vocabulary', () => {
    const intervention = axisReport({
      axis: 'intervention',
      label: 'Intervention',
      requirements: [metRequirement('intervention', 'key-steps', 'key-steps')],
    })
    const level = levelReport({ axes: [intervention] })
    const output = renderHumanReport(
      assessmentReport({
        proven: level,
        next: null,
        levels: [level],
        vocabulary: [
          {
            axis: 'intervention',
            kind: 'ordinal',
            values: ['key-steps'],
            descriptions: { 'key-steps': 'custom key steps' },
          },
        ],
      }),
    )
    expect(axisDetail(output, 'Intervention')).toContain('custom key steps (key-steps)')
  })

  it('leaves a term absent from report vocabulary raw instead of inventing a description', () => {
    const output = renderHumanReport(
      assessmentReport({ proven: null, next: blue, levels: [blue], vocabulary: [] }),
    )
    expect(axisDetail(output, 'Harness')).toContain('observé prompts, behavior')
    expect(axisDetail(output, 'Harness')).not.toContain('guardrails')
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
    expect(axisDetail(claimed, 'Taille')).toContain('observé M')
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
    expect(unobserved).toContain('aucune observation')
    expect(unobserved).not.toContain('requis')
    expect(axisDetail(empty, 'Harness')).toContain('manque : prompts')
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
    expect(axisDetail(white, 'Harness')).toContain("requis l'ensemble vide")
    expect(axisDetail(white, 'Harness')).not.toMatch(/requis *·/)
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
    expect(axisDetail(twofold, 'Taille')).toContain('pour Blue : medium (M).')
    expect(axisDetail(twofold, 'Taille')).toContain('pour Blue : large (L).')
  })

  it('carries CONFIRMED into prose too, so the happy path is not the unlabelled one', () => {
    expect(axisDetail(output, 'Harness')).toContain('(CONFIRMED)')
  })

  it('never states a threshold for a requirement no observation was compared against', () => {
    const detail = axisDetail(output, 'Taille')
    expect(detail).not.toContain('requis')
    expect(detail).toContain('aucune observation')
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
    expect(axisDetail(proven, 'Harness')).toContain('requis atteint : prompts')
  })
})

describe('13. an axis the proven level already detailed is named, never printed twice', () => {
  const harnessAt = (threshold: readonly string[]) =>
    axisReport({
      axis: 'harness',
      label: 'Harness',
      outcome: 'MET',
      requirements: [metRequirement('harness', threshold, ['prompts', 'behavior'])],
    })

  const reportWith = (nextHarness: ReturnType<typeof harnessAt>) => {
    const green = levelReport({
      id: 'green',
      rank: 3,
      label: 'Green',
      axes: [harnessAt(['prompts'])],
    })
    const copper = levelReport({
      id: 'copper',
      rank: 4,
      label: 'Copper',
      axes: [
        nextHarness,
        axisReport({
          axis: 'size',
          label: 'Taille',
          outcome: 'NOT_MET',
          requirements: [notMetRequirement('size', 'L', 'M')],
        }),
      ],
    })
    return assessmentReport({
      proven: green,
      next: copper,
      levels: [green, copper],
      blocking: [practiceBlocker('copper', 'size')],
    })
  }

  it('names an axis whose requirement is word for word the one already printed', () => {
    const output = renderHumanReport(reportWith(harnessAt(['prompts'])))
    expect(output).toContain('Déjà au niveau requis pour Copper : Harness.')
    expect(output.split('requis atteint : prompts')).toHaveLength(2)
  })

  it('prints an axis in full when the higher level raised its threshold, even though it is met', () => {
    // INVARIANT: the collapse is by identity, never by outcome. A level that asks more and still
    // gets it states a different fact, and a reader of prose learns every fact `--json` publishes.
    const output = renderHumanReport(reportWith(harnessAt(['prompts', 'behavior'])))
    expect(output).not.toContain('Déjà satisfaits')
    expect(output).toContain('requis atteint : prompts ; guardrails')
  })

  it('collapses nothing when no level was proven, since nothing was printed above', () => {
    const copper = levelReport({ id: 'copper', rank: 4, label: 'Copper' })
    const output = renderHumanReport(
      assessmentReport({ proven: null, next: copper, levels: [copper] }),
    )
    expect(output).not.toContain('Déjà satisfaits')
    expect(output).toContain('✓ Harness')
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
    output.split('\n\n').find((paragraph) => paragraph.startsWith('Démontré :'))

  it('names the demonstrated level only after the proven one', () => {
    const output = withDemonstrated()

    // INVARIANT: a reader quoting the first level they meet must quote the one the subject holds.
    expect(output.indexOf('Niveau prouvé :')).toBeLessThan(output.indexOf('Démontré :'))
  })

  it('never states a demonstrated value without the share that earned it', () => {
    const paragraph = demonstratedParagraph(withDemonstrated()) ?? ''
    const [level, ...axes] = paragraph.split('\n')

    // INVARIANT: the clause most likely to be dropped in a later edit, so it is asserted per line
    // rather than once for the paragraph — the level line included. That line carries no share of
    // its own, so it must not read as a finished sentence: it ends in a colon and is followed by at
    // least one line that does carry one.
    expect(level).toMatch(/atteint sur :$/)
    expect(axes.length).toBeGreaterThan(0)
    for (const line of axes) {
      expect(line).toMatch(/atteint sur \d+% des /)
    }
  })

  it('names what each share counts, because the two axes do not count the same occasions', () => {
    const paragraph = demonstratedParagraph(withDemonstrated()) ?? ''

    expect(paragraph).toContain('atteint sur 40% des livraisons')
    expect(paragraph).toContain('atteint sur 40% des jours actifs')
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
    expect(output).toContain("Aucun niveau n'a pu être entièrement prouvé")
    expect(output).not.toContain('Démontré :')
  })

  it('says nothing at all when the subject demonstrated no more than it holds', () => {
    // INVARIANT: the ordinary case. Every bundle and every source recording a median without its
    // distribution lands here, and must read exactly as it did before this section existed.
    expect(withDemonstrated(blue, blue)).not.toContain('Démontré :')
    expect(renderHumanReport(assessmentReport({ demonstrated: null }))).not.toContain('Démontré :')
  })
})

const ESCAPE = '\u001b'
const stripped = (text: string) => text.replaceAll(/\u001b\[[0-9;]*m/g, '')

describe('14. colour dresses the report and decides nothing about it', () => {
  const green = levelReport({ id: 'green', rank: 3, label: 'Green' })
  const copper = levelReport({
    id: 'copper',
    rank: 4,
    label: 'Copper',
    outcome: 'NOT_MET',
    axes: [
      axisReport({
        axis: 'size',
        label: 'Taille',
        outcome: 'NOT_MET',
        requirements: [notMetRequirement('size', 'L', 'M')],
      }),
      axisReport({
        axis: 'harness',
        label: 'Harness',
        outcome: 'UNPROVEN',
        requirements: [unprovenRequirement('harness', ['prompts'], 'UNKNOWN')],
      }),
    ],
  })
  const report = assessmentReport({
    proven: green,
    next: copper,
    levels: [green, copper],
    blocking: [practiceBlocker('copper', 'size'), evidenceBlocker('copper', 'harness')],
  })
  const plain = renderHumanReport(report)
  const coloured = renderHumanReport(report, colouredText)

  it('never emits an escape sequence when no style is asked for', () => {
    // INVARIANT: the default is what a pipe, a redirect and every captured run receive. A report
    // that coloured itself unasked would put escape codes into a file and into `| grep`.
    expect(plain).not.toContain(ESCAPE)
  })

  it('says exactly the same words in colour as without it', () => {
    // INVARIANT: the strongest form of "presentation only" — strip the codes and the two renderings
    // are the same bytes. A style that added a word, dropped one, or reordered a line fails here
    // without any assertion having to name what it did.
    expect(stripped(coloured)).toBe(plain)
  })

  it('actually colours the report it is asked to colour', () => {
    expect(coloured).toContain(ESCAPE)
  })

  it('gives the two gaps different colours, as it gives them different words', () => {
    const lines = coloured.split('\n')
    const practice = lines.find((line) => line.includes('[écart de pratique]'))
    const evidence = lines.find((line) => line.includes('[écart de preuve]'))

    // INVARIANT: colour is the faster channel, so a reader who scans before reading must still see
    // two kinds of gap. Sharing a colour here would collapse for that reader what the words keep.
    expect(codesIn(practice ?? '')).not.toEqual(codesIn(evidence ?? ''))
  })

  it('never dresses a satisfied axis as a gap', () => {
    const satisfied = codesIn(coloured.split('\n').find((line) => line.includes('✓')) ?? '')
    const failed = codesIn(coloured.split('\n').find((line) => line.includes('✗')) ?? '')

    // INVARIANT: a satisfied axis is coloured too, and not with a gap's colour. Asserting only
    // that the two differ passes for a `✓` nothing dressed at all — a different bug wearing this
    // one's clothes.
    expect(satisfied).not.toEqual([])
    expect(satisfied).not.toEqual(failed)
  })
})

const codesIn = (line: string) => [...line.matchAll(/\u001b\[([0-9;]*)m/g)].map((match) => match[1])

// The section is last, so everything from its heading on belongs to it.
const contributorParagraphs = (output: string) => {
  const paragraphs = output.split('\n\n')
  const start = paragraphs.findIndex((paragraph) => paragraph.startsWith('Contributeurs :'))
  return start < 0 ? [] : paragraphs.slice(start)
}

const contributorRowBlock = (output: string, label: string) =>
  contributorParagraphs(output).find((paragraph) => paragraph.startsWith(`  ${label} —`))

describe('15. contributors', () => {
  it('renders no section at all when no roster was read', () => {
    const output = renderHumanReport(assessmentReport({ contributors: null }))

    expect(output).not.toContain('Contributeurs :')
  })

  it('renders the section, present and empty, naming the reason, when the roster could not be read', () => {
    const output = renderHumanReport(
      assessmentReport({
        contributors: failedRoster({ reason: 'gh: no credentials in this run' }),
      }),
    )

    expect(contributorParagraphs(output)).toEqual([
      'Contributeurs : lecture impossible — gh: no credentials in this run. Le niveau ci-dessus est inchangé.',
    ])
  })

  it('glosses a timed-out roster apart from a failed one', () => {
    const output = renderHumanReport(
      assessmentReport({
        contributors: failedRoster({ status: 'TIMED_OUT', reason: 'the budget was spent' }),
      }),
    )

    expect(output).toContain('Contributeurs : délai dépassé — the budget was spent.')
  })

  it('says nobody was active, naming the window, when the roster completed with no rows', () => {
    const output = renderHumanReport(
      assessmentReport({ contributors: completedRoster({ rows: [], windowDays: 90 }) }),
    )

    expect(output).toContain('Contributeurs : aucun compte actif sur les 90 derniers jours.')
  })

  it('counts named accounts in the header and names the unattributed bucket as a second clause', () => {
    const output = renderHumanReport(
      assessmentReport({
        contributors: completedRoster({
          windowDays: 180,
          rows: [
            contributorRow({ account: 'alice' }),
            contributorRow({ account: 'bob' }),
            contributorRow({ account: null, deliveries: 0, activeDays: 0, commits: 3 }),
          ],
        }),
      }),
    )

    expect(output).toContain(
      'Contributeurs : 2 comptes actifs sur les 180 derniers jours, plus des commits que GitHub ne rattache à aucun compte.',
    )
  })

  it('uses the singular noun for exactly one account', () => {
    const output = renderHumanReport(
      assessmentReport({
        contributors: completedRoster({ rows: [contributorRow({ account: 'alice' })] }),
      }),
    )

    expect(output).toContain('Contributeurs : 1 compte actif')
  })

  it('names deliveries and, beside them, active days on a row with a measured sample', () => {
    const output = renderHumanReport(
      assessmentReport({
        contributors: completedRoster({
          rows: [
            contributorRow({ account: 'alice', deliveries: 87, activeDays: 12, commits: 90 }),
            contributorRow({ account: 'bob', deliveries: 1, activeDays: 1, commits: 1 }),
          ],
        }),
      }),
    )
    const alice = contributorRowBlock(output, 'alice')
    const bob = contributorRowBlock(output, 'bob')

    expect(alice).toBeDefined()
    expect(alice).toContain('87 livraisons · 12 jours actifs')
    expect(bob).toBeDefined()
    expect(bob).toContain('1 livraison · 1 jour actif')
  })

  it('names commits instead of active days when nothing was delivered', () => {
    const output = renderHumanReport(
      assessmentReport({
        contributors: completedRoster({
          rows: [contributorRow({ account: 'bob', deliveries: 0, activeDays: 0, commits: 4 })],
        }),
      }),
    )
    const row = contributorRowBlock(output, 'bob')

    expect(row).toBeDefined()
    expect(row).toContain('0 livraison · 4 commits')
  })

  it('names the unattributed bucket, never a blank and never a plausible-looking login', () => {
    const output = renderHumanReport(
      assessmentReport({
        contributors: completedRoster({
          rows: [contributorRow({ account: null, deliveries: 0, activeDays: 0, commits: 12 })],
        }),
      }),
    )
    const row = contributorRowBlock(output, 'non rattaché')

    expect(row).toBeDefined()
    expect(row).toContain(
      "0 livraison · 12 commits dont l'adresse d'auteur n'est rattachée à aucun compte GitHub",
    )
  })

  it('names a demonstrated axis with the share that earned it, glossed as it is above', () => {
    const output = renderHumanReport(
      assessmentReport({
        contributors: completedRoster({
          rows: [
            contributorRow({
              account: 'alice',
              proven: levelReport({ id: 'blue', rank: 1, label: 'Blue' }),
              demonstrated: {
                level: { id: 'copper', rank: 4, label: 'Copper', outcome: 'MET' },
                axes: [{ axis: 'size', observed: 'XL', share: 0.34, unit: 'DELIVERIES' }],
              },
            }),
          ],
        }),
      }),
    )
    const row = contributorRowBlock(output, 'alice')

    expect(row).toBeDefined()
    expect(row).toContain('XL')
    expect(row).toContain('atteint sur 34% des livraisons')
  })

  it('omits the demonstrated line when the row demonstrates no more than it proves', () => {
    const level = levelReport({ id: 'blue', rank: 1, label: 'Blue' })
    const output = renderHumanReport(
      assessmentReport({
        contributors: completedRoster({
          rows: [
            contributorRow({
              account: 'alice',
              proven: level,
              demonstrated: { level, axes: [] },
            }),
          ],
        }),
      }),
    )
    const row = contributorRowBlock(output, 'alice')

    expect(row).toBeDefined()
    expect(row).not.toContain('démontré :')
  })

  it(
    'says a row could not be established, names the unknown axes as an evidence gap, and never ' +
      'reads as a statement about practice',
    () => {
      const copper = levelReport({
        id: 'copper',
        rank: 4,
        label: 'Copper',
        axes: [
          axisReport({ axis: 'size', label: 'Taille' }),
          axisReport({ axis: 'intervention', label: 'Intervention' }),
          axisReport({ axis: 'parallelism', label: 'En parallèle' }),
        ],
      })
      const output = renderHumanReport(
        assessmentReport({
          levels: [copper],
          contributors: completedRoster({
            rows: [
              contributorRow({
                account: 'carol',
                proven: null,
                demonstrated: null,
                blocking: [
                  evidenceBlocker('copper', 'size'),
                  evidenceBlocker('copper', 'intervention'),
                  evidenceBlocker('copper', 'parallelism'),
                ],
              }),
            ],
          }),
        }),
      )
      const row = contributorRowBlock(output, 'carol')

      expect(row).toBeDefined()
      expect(row).toContain('carol — niveau prouvé : aucun')
      expect(row).toContain('[écart de preuve]')
      expect(row).toContain('Taille, Intervention et En parallèle restent sans réponse')
      expect(row).toContain("Ce n'est pas un constat sur sa pratique.")
      expect(row).not.toMatch(/\b(améliorer|améliorez|corriger|corrigez|changer)\b/i)
    },
  )

  it('reads a practice gap as measured and low, never as missing evidence, and recommends nothing', () => {
    const copper = levelReport({
      id: 'copper',
      rank: 4,
      label: 'Copper',
      axes: [
        axisReport({
          axis: 'size',
          label: 'Taille',
          requirements: [notMetRequirement('size', 'L', 'S')],
        }),
      ],
    })
    const output = renderHumanReport(
      assessmentReport({
        levels: [copper],
        contributors: completedRoster({
          rows: [
            contributorRow({
              account: 'dave',
              proven: null,
              demonstrated: null,
              blocking: [practiceBlocker('copper', 'size')],
            }),
          ],
        }),
      }),
    )
    const row = contributorRowBlock(output, 'dave')

    expect(row).toBeDefined()
    expect(row).toContain('[écart de pratique]')
    expect(row).toContain('Taille à Copper')
    expect(row).not.toContain('[écart de preuve]')
    expect(row).not.toMatch(/\b(améliorer|améliorez|corriger|corrigez|changer)\b/i)
  })

  it('prints the shared harness sentence exactly once, beneath the rows, never inside one', () => {
    const output = renderHumanReport(
      assessmentReport({
        contributors: completedRoster({
          harnessObserved: ['prompts', 'context-engineering'],
          harnessPaths: 41,
          rows: [
            contributorRow({ account: 'alice', harnessAuthorship: { files: 41, commits: 60 } }),
          ],
        }),
      }),
    )
    const row = contributorRowBlock(output, 'alice')

    expect(row).toBeDefined()
    expect(output.split('Le harness est celui du dépôt')).toHaveLength(2)
    expect(row).not.toContain('Le harness est celui du dépôt')
    expect(row).toContain("a écrit 41 des 41 fichiers de l'ensemble harness de ce dépôt")
  })

  it('omits the shared harness sentence when no harness value was established (an evidence gap, not a failure)', () => {
    const output = renderHumanReport(
      assessmentReport({
        contributors: completedRoster({ harnessObserved: null, rows: [contributorRow()] }),
      }),
    )

    expect(contributorParagraphs(output).length).toBeGreaterThan(1)
    expect(output).not.toContain('Le harness est celui du dépôt')
  })

  it('renders an empty harness set as the empty set, never a blank', () => {
    const output = renderHumanReport(
      assessmentReport({
        contributors: completedRoster({
          harnessObserved: [],
          harnessPaths: 0,
          rows: [contributorRow({ harnessAuthorship: { files: 0, commits: 0 } })],
        }),
      }),
    )
    const shared = contributorParagraphs(output).find((paragraph) =>
      paragraph.includes('Le harness est celui du dépôt'),
    )
    const row = contributorRowBlock(output, 'blandinerdl')

    expect(shared).toBeDefined()
    expect(shared).toContain("l'ensemble vide")
    expect(row).toBeDefined()
    expect(row).toContain("harness : l'ensemble harness de ce dépôt est vide")
  })

  it('reads "wrote none of it" apart from authorship that could not be read', () => {
    const rowWithZero = contributorRowBlock(
      renderHumanReport(
        assessmentReport({
          contributors: completedRoster({
            rows: [contributorRow({ harnessAuthorship: { files: 0, commits: 0 } })],
          }),
        }),
      ),
      'blandinerdl',
    )
    const rowWithNull = contributorRowBlock(
      renderHumanReport(
        assessmentReport({
          contributors: completedRoster({ rows: [contributorRow({ harnessAuthorship: null })] }),
        }),
      ),
      'blandinerdl',
    )

    expect(rowWithZero).toBeDefined()
    expect(rowWithNull).toBeDefined()
    expect(rowWithZero).toContain("n'a écrit aucun des 41 fichiers")
    expect(rowWithNull).toContain("l'attribution n'a pas pu être lue")
    expect(rowWithZero).not.toContain('pas pu être lue')
    expect(rowWithNull).not.toContain("n'a écrit aucun")
  })
})

describe('16. a row states what it measured, not only what it lacks', () => {
  const rowWithNoLevel = contributorRow({
    account: 'mina',
    deliveries: 7,
    activeDays: 4,
    proven: null,
    observed: [
      { axis: 'size', value: 'L', evidence: 'CONFIRMED' },
      { axis: 'parallelism', value: null, evidence: 'UNKNOWN' },
    ],
  })

  it('prints the confirmed values of a row that reached no level', () => {
    const output = renderHumanReport(
      assessmentReport({ contributors: completedRoster({ rows: [rowWithNoLevel] }) }),
    )

    // SAFETY: the row must be in the document before its contents are asserted — an assertion over
    // a rendering that never printed the row would hold whatever the renderer did.
    expect(output).toContain('mina — niveau prouvé : aucun')
    const line = output
      .split('\n')
      .find((candidate) => candidate.includes('observé sur son propre échantillon'))

    expect(line).toBeDefined()
    expect(line).toContain('L (large)')
  })

  it('names no unresolved axis on that line, the gap lines already carrying them with a reason', () => {
    const output = renderHumanReport(
      assessmentReport({ contributors: completedRoster({ rows: [rowWithNoLevel] }) }),
    )
    const line = output
      .split('\n')
      .find((candidate) => candidate.includes('observé sur son propre échantillon'))

    expect(line).toBeDefined()
    expect(line).not.toContain('En parallèle')
    expect(line).not.toContain('UNKNOWN')
  })

  it('prints no such line for a row that reached a level, whose values ride in its level', () => {
    const output = renderHumanReport(
      assessmentReport({
        contributors: completedRoster({
          rows: [
            contributorRow({
              account: 'ada',
              observed: [{ axis: 'size', value: 'L', evidence: 'CONFIRMED' }],
            }),
          ],
        }),
      }),
    )

    expect(output).toContain('ada — niveau prouvé')
    expect(output).not.toContain('observé sur son propre échantillon')
  })
})

describe('17. a row names its aim, and never names it alone', () => {
  const nextLevel = levelReport({
    id: 'green',
    rank: 3,
    label: 'Green',
    outcome: 'NOT_MET',
    axes: [
      axisReport({
        axis: 'size',
        label: 'Taille',
        outcome: 'NOT_MET',
        requirements: [notMetRequirement('size', 'L', 'S')],
      }),
    ],
  })

  it('names the level a row is next in line for, with what stands in the way', () => {
    const output = renderHumanReport(
      assessmentReport({
        contributors: completedRoster({
          rows: [
            contributorRow({
              account: 'mina',
              next: nextLevel,
              blocking: [practiceBlocker('green', 'size')],
            }),
          ],
        }),
      }),
    )
    const rowLines = output.split('\n').filter((line) => line.startsWith('    '))

    expect(output).toContain('mina — niveau prouvé')
    expect(rowLines.some((line) => line.includes('pour atteindre Green (rang 3) :'))).toBe(true)
    expect(rowLines.some((line) => line.includes('[écart de pratique]'))).toBe(true)
  })

  it('takes the gap values from the row own next level, never from the repository', () => {
    // SAFETY: the repository has met this axis, so reading the values there finds no unmet
    // requirement and states none. The row's own next level is what pairs the threshold with what
    // this account observed.
    const output = renderHumanReport(
      assessmentReport({
        contributors: completedRoster({
          rows: [
            contributorRow({
              account: 'mina',
              next: nextLevel,
              blocking: [practiceBlocker('green', 'size')],
            }),
          ],
        }),
      }),
    )
    const gap = output
      .split('\n')
      .find((line) => line.includes('[écart de pratique]') && line.includes('Taille à Green'))

    expect(gap).toBeDefined()
    expect(gap).not.toContain("n'atteint pas l'exigence.")
    expect(gap).toContain('S')
  })

  it('names no aim on a row that has nothing left to reach', () => {
    const output = renderHumanReport(
      assessmentReport({
        contributors: completedRoster({
          rows: [contributorRow({ account: 'ada', next: null, blocking: [] })],
        }),
      }),
    )

    expect(output).toContain('ada — niveau prouvé')
    expect(output).not.toContain('pour atteindre')
  })
})
