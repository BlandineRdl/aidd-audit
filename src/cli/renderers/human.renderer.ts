import type {
  AssessmentOutcome,
  AssessmentReport,
  AxisReport,
  AxisVocabularyReport,
  BlockingRequirement,
  ContributorRosterReport,
  ContributorRow,
  DemonstratedAxis,
  EvidenceStatus,
  ObservedValue,
  ProvenanceEntry,
  RequirementReport,
  Threshold,
} from '../../assessment/contracts/assessment-report.contract.js'
import { type TextStyle, plainText } from './text-style.js'

// INVARIANT: a report and the way it is dressed, carried together because nearly every renderer
// below needs both. The style decides presentation only: `plainText` renders the bytes a pipe gets,
// and no styled fragment carries a word the plain one does not.
interface Rendering {
  readonly report: AssessmentReport
  readonly style: TextStyle
}

export function renderHumanReport(report: AssessmentReport, style: TextStyle = plainText): string {
  const rendering: Rendering = { report, style }
  const sections = [
    renderHeader(rendering),
    renderProvenSection(rendering),
    renderDemonstratedSection(rendering),
    renderCoverageSection(rendering),
    renderNoCollectorsSection(rendering),
    renderIncompleteCollectorsSection(rendering),
    renderGapsSection(rendering),
    renderContributorsSection(rendering),
  ]
  return sections.filter((section) => section.length > 0).join('\n\n')
}

// INVARIANT: A set keeps each report attributable while a lone subject retains its historical
// single-report shape. The separator cannot occur inside one report, whose sections only use blank
// lines.
const REPORT_SEPARATOR = `\n\n${'='.repeat(72)}\n\n`

export function renderHumanReports(
  reports: readonly AssessmentReport[],
  style: TextStyle = plainText,
): string {
  return reports.map((report) => renderHumanReport(report, style)).join(REPORT_SEPARATOR)
}

function renderHeader({ report, style }: Rendering): string {
  const model = `Modèle ${report.model.id} (schéma v${report.model.schemaVersion})`
  const completed = report.provenance.filter((entry) => entry.status === 'COMPLETED')
  const collectors =
    completed.length > 0
      ? ` · collecteurs : ${completed.map((entry) => entry.collector).join(', ')}`
      : ''
  return [
    style.heading(`Maturité AIDD · ${report.subject.path}`),
    style.faint(`${model}${collectors}`),
  ].join('\n')
}

function renderProvenSection(rendering: Rendering): string {
  const { report, style } = rendering
  const { proven } = report
  // INVARIANT: "aucun niveau prouvé" is a result, never White and never a rank below the floor. It
  // names no cause either — the gaps section knows which.
  if (proven === null) {
    return style.heading("Niveau prouvé : aucun. Aucun niveau n'a pu être entièrement prouvé.")
  }
  return [
    style.heading(`Niveau prouvé : ${proven.label} (rang ${proven.rank})`),
    ...renderAxes(rendering, proven.axes),
  ].join('\n')
}

// INVARIANT: This section always sits *below* the proven one and never replaces it. The habitual
// level is what the subject holds; this is what it has reached often enough to count, which is a
// different and weaker claim. Printed first, or printed alone, it would be quoted as the level.
//
// INVARIANT: It is omitted entirely when it names nothing above the proven level, so the ordinary
// subject — every bundle, every source that records a median without the distribution behind it —
// reads exactly as it did before this section existed.
function renderDemonstratedSection(rendering: Rendering): string {
  const { report, style } = rendering
  const { demonstrated, proven } = report
  if (demonstrated === null || demonstrated.level === null) return ''

  // SAFETY: no ceiling without a floor. With `proven` null this section would print the only level
  // in the document, on a page that says in the same breath that the subject could not be
  // classified and that the axis was never observed — handing a rank-4 label to a subject the tool
  // declined to place. A demonstrated level says "further than usual"; with no usual, it says
  // nothing that can be read safely.
  if (proven === null) return ''
  if (demonstrated.level.rank <= proven.rank) return ''

  // SAFETY: the level line ends in a colon and never stands alone. A reader who takes only the first
  // line of a paragraph must not come away with a bare rank: the sentence is unfinished without the
  // lines beneath it, each of which carries the share that earned the level.
  return [
    style.heading(
      `Démontré : ${demonstrated.level.label} (rang ${demonstrated.level.rank}), atteint sur :`,
    ),
    ...demonstrated.axes.map((axis) => `  ${renderDemonstratedAxis(report, axis)}`),
  ].join('\n')
}

// SAFETY: the value and its frequency are one sentence, never two. A demonstrated value read without
// the share that earned it is a maximum wearing a habit's clothes, which is the one thing this
// reading must not become.
function renderDemonstratedAxis(report: AssessmentReport, axis: DemonstratedAxis): string {
  const label = labelFor(report, axis.axis) ?? axis.axis
  const percent = Math.round(axis.share * 100)
  return `${label} : ${formatScaleValue(report, axis.axis, axis.observed)} · atteint sur ${percent}% des ${occasionsOf(axis.unit)}`
}

function occasionsOf(unit: DemonstratedAxis['unit']): string {
  switch (unit) {
    case 'DELIVERIES':
      return 'livraisons'
    case 'ACTIVE_DAYS':
      return 'jours actifs'
  }
}

// The model's own label for an axis, taken from any level that reports it.
function labelFor(report: AssessmentReport, axis: string): string | undefined {
  for (const level of report.levels) {
    const found = level.axes.find((candidate) => candidate.axis === axis)
    if (found !== undefined) return found.label
  }
  return undefined
}

// Null-proven only: MET implies every axis CONFIRMED, so the counts are then full.
function renderCoverageSection({ report }: Rendering): string {
  if (report.proven !== null) {
    return ''
  }
  const { axesRequested, axesObserved, axesConfirmed } = report.coverage
  return `Couverture : ${axesConfirmed}/${axesRequested} axes confirmés, ${axesObserved}/${axesRequested} observés.`
}

// INVARIANT: "nothing was looked at" is a third state above both gaps, and must never read as
// either. It is printed above the gaps section so a reader meets it first.
function renderNoCollectorsSection({ report }: Rendering): string {
  if (report.provenance.length > 0) {
    return ''
  }
  return "Aucun collecteur n'a tourné : rien n'a été observé sur ce sujet. Les axes ci-dessous sont non prouvés parce qu'AIDD n'a pas regardé, pas parce qu'il a regardé sans rien trouver."
}

type IncompleteCollector = Exclude<ProvenanceEntry, { status: 'COMPLETED' }>

function renderIncompleteCollectorsSection({ report, style }: Rendering): string {
  const incomplete = report.provenance.filter(
    (entry): entry is IncompleteCollector => entry.status !== 'COMPLETED',
  )
  if (incomplete.length === 0) {
    return ''
  }
  const lines = incomplete.map((entry) => {
    const axes = entry.axes.length > 0 ? ` sur ${entry.axes.join(', ')}` : ''
    return `  ${entry.collector} : ${glossProvenanceStatus(entry.status)}${axes} — ${entry.reason}`
  })
  return [style.heading('Collecteurs sans réponse complète :'), ...lines].join('\n')
}

function glossProvenanceStatus(status: IncompleteCollector['status']): string {
  switch (status) {
    case 'FAILED':
      return 'en échec'
    case 'TIMED_OUT':
      return 'délai dépassé'
    case 'SKIPPED':
      return 'ignoré'
  }
}

// INVARIANT: the next level and the blockers are one section, not two. Stating a gap under the level
// and again in a list of its own says the same fact twice, and the second telling carried nothing
// the requirement lines do not already carry.
function renderGapsSection(rendering: Rendering): string {
  const { report, style } = rendering
  const { next } = report
  const axes = next?.axes ?? []
  const orphans = report.blocking
    .filter((blocker) => !axes.some((axis) => axis.axis === blocker.axis))
    .map((blocker) => renderOrphanBlocker(rendering, blocker))
  if (next === null && orphans.length === 0) {
    return ''
  }

  const blocked = new Set(report.blocking.map((blocker) => blocker.axis))
  const detailed: string[] = []
  const carriedOver: string[] = []
  for (const axis of axes) {
    if (blocked.has(axis.axis) || !alreadyPrinted(rendering, axis)) {
      detailed.push(...renderAxis(rendering, axis))
    } else {
      carriedOver.push(axis.label)
    }
  }

  const heading =
    next === null ? 'Ce qui bloque :' : `Pour atteindre ${next.label} (rang ${next.rank}) :`
  return [
    style.heading(heading),
    ...detailed,
    ...orphans,
    ...renderCarriedOver(rendering, carriedOver),
  ].join('\n')
}

function renderCarriedOver(
  { report, style }: Rendering,
  labels: readonly string[],
): readonly string[] {
  if (labels.length === 0 || report.proven === null) {
    return []
  }
  const names = labels.join(', ')
  return [style.faint(`  Déjà au niveau requis pour ${nextLabel(report)} : ${names}.`)]
}

function nextLabel(report: AssessmentReport): string {
  // SAFETY: `renderCarriedOver` is called only from the next-level section, so this is present. Keeping the
  // fallback makes a hand-built report degrade into readable prose instead of throwing.
  return report.next?.label ?? 'le niveau suivant'
}

// INVARIANT: an axis is named rather than repeated only when it would print exactly the lines the
// proven level already printed. A higher level may raise a threshold and still be MET, and that
// requirement is rendered in full — the reader of prose learns every fact `--json` publishes.
function alreadyPrinted(rendering: Rendering, axis: AxisReport): boolean {
  const printed = rendering.report.proven?.axes.find((candidate) => candidate.axis === axis.axis)
  if (printed === undefined) {
    return false
  }
  return renderAxis(rendering, printed).join('\n') === renderAxis(rendering, axis).join('\n')
}

function renderAxes(rendering: Rendering, axes: readonly AxisReport[]): readonly string[] {
  return axes.flatMap((axis) => renderAxis(rendering, axis))
}

function renderAxis(rendering: Rendering, axis: AxisReport): readonly string[] {
  return [
    `  ${markerFor(rendering.style, axis.outcome)} ${axis.label}`,
    ...axis.requirements.flatMap((requirement) =>
      renderRequirement(rendering, axis.axis, requirement),
    ),
  ]
}

function markerFor(style: TextStyle, outcome: AssessmentOutcome): string {
  switch (outcome) {
    case 'MET':
      return style.satisfied('✓')
    case 'NOT_MET':
      return style.practiceGap('✗')
    case 'UNPROVEN':
      return style.evidenceGap('?')
  }
}

function renderRequirement(
  rendering: Rendering,
  axis: string,
  requirement: RequirementReport,
): readonly string[] {
  const { style } = rendering
  if (isOrdinalPracticeGap(rendering.report, axis, requirement)) {
    const evidence = style.faint(`(${requirement.evidence})`)
    return [
      `      ${gapTagFor(style, requirement.outcome)}aujourd’hui : ${describeTerm(rendering.report, axis, requirement.observed)} (${requirement.observed}) ${evidence}`,
      `          pour ${nextLabel(rendering.report)} : ${describeTerm(rendering.report, axis, requirement.threshold)} (${requirement.threshold}).`,
    ]
  }
  const gloss =
    requirement.outcome === 'UNPROVEN'
      ? ` — ${explainEvidenceGap(rendering, axis, requirement)}`
      : ''
  const fact = renderRequirementFact(rendering, axis, requirement)
  return [`      ${gapTagFor(style, requirement.outcome)}${fact}${gloss}`]
}

// INVARIANT: An ordinal shortfall is a progression, not a bag of missing terms. Rendering the current
// practice before the target makes that direction readable without giving the renderer any
// knowledge of an axis's vocabulary.
function isOrdinalPracticeGap(
  report: AssessmentReport,
  axis: string,
  requirement: RequirementReport,
): requirement is Extract<RequirementReport, { evidence: 'CONFIRMED' }> & {
  threshold: string
  observed: string
} {
  return (
    requirement.outcome === 'NOT_MET' &&
    vocabularyFor(report.vocabulary, axis)?.kind === 'ordinal' &&
    typeof requirement.threshold === 'string' &&
    typeof requirement.observed === 'string'
  )
}

// No threshold where nothing was compared: naming one states a test that never ran.
function renderRequirementFact(
  { report, style }: Rendering,
  axis: string,
  requirement: RequirementReport,
): string {
  const evidence = style.faint(`(${requirement.evidence})`)
  if (requirement.observed === null) {
    return `aucune observation ${evidence}`
  }
  switch (requirement.outcome) {
    case 'MET':
      return renderMetFact(report, axis, requirement, evidence)
    case 'NOT_MET':
      return renderPracticeGapFact(report, axis, requirement, evidence)
    case 'UNPROVEN':
      return `requis ${formatScaleValue(report, axis, requirement.threshold)} · observé ${formatScaleValue(report, axis, requirement.observed)} ${evidence}`
  }
}

// INVARIANT: The model supplies the vocabulary; this renderer only chooses a sentence shape for a comparison.
// In particular, a successful requirement is one fact, not two identical descriptions repeated on
// either side of a separator.
function renderMetFact(
  report: AssessmentReport,
  axis: string,
  requirement: Extract<RequirementReport, { evidence: 'CONFIRMED' }>,
  evidence: string,
): string {
  const vocabulary = vocabularyFor(report.vocabulary, axis)
  if (vocabulary?.kind === 'set' && isStringList(requirement.observed)) {
    if (isStringList(requirement.threshold) && requirement.threshold.length === 0) {
      return `requis l'ensemble vide · pratique observée : ${describeTerms(report, axis, requirement.observed)} ${evidence}`
    }
    return `requis atteint : ${describeTerms(report, axis, isStringList(requirement.threshold) ? requirement.threshold : requirement.observed)} ${evidence}`
  }
  if (vocabulary?.kind === 'ordinal' && typeof requirement.observed === 'string') {
    return `requis atteint : ${describeTerm(report, axis, requirement.observed)} (${requirement.observed}) ${evidence}`
  }
  if (vocabulary?.kind === 'numeric' && typeof requirement.observed === 'number') {
    return `requis atteint : ${requirement.observed} ${vocabulary.description} (minimum ${requirement.threshold}) ${evidence}`
  }
  return `requis ${formatScaleValue(report, axis, requirement.threshold)} · observé ${formatScaleValue(report, axis, requirement.observed)} ${evidence}`
}

function renderPracticeGapFact(
  report: AssessmentReport,
  axis: string,
  requirement: Extract<RequirementReport, { evidence: 'CONFIRMED' }>,
  evidence: string,
): string {
  const vocabulary = vocabularyFor(report.vocabulary, axis)
  if (
    vocabulary?.kind === 'set' &&
    isStringList(requirement.threshold) &&
    isStringList(requirement.observed)
  ) {
    const observed = requirement.observed
    const missing = requirement.threshold.filter((term) => !observed.includes(term))
    return `manque : ${describeTerms(report, axis, missing)} (${missing.join(', ')}) ${evidence}`
  }
  if (vocabulary?.kind === 'numeric' && typeof requirement.observed === 'number') {
    return `requis : minimum ${requirement.threshold} · observé : ${requirement.observed} ${vocabulary.description} ${evidence}`
  }
  return `requis ${formatScaleValue(report, axis, requirement.threshold)} · observé ${formatScaleValue(report, axis, requirement.observed)} ${evidence}`
}

// INVARIANT: a practice gap and an evidence gap never read alike, and each is tagged on its own
// requirement line rather than once for the axis — an axis may hold one of each, and a single
// axis-level word would collapse the distinction the whole product rests on. NOT_MET says the
// observed practice falls short and may be improved; UNPROVEN says nothing was established, and
// recommends nothing at all.
function gapTagFor(style: TextStyle, outcome: AssessmentOutcome): string {
  switch (outcome) {
    case 'MET':
      return ''
    case 'NOT_MET':
      return `${style.practiceGap('[écart de pratique]')} `
    case 'UNPROVEN':
      return `${style.evidenceGap('[écart de preuve]')} `
  }
}

function explainEvidenceGap(
  rendering: Rendering,
  axis: string,
  requirement: Extract<RequirementReport, { outcome: 'UNPROVEN' }>,
): string {
  if (requirement.diagnostic !== undefined) {
    return explainDiagnostic(requirement.diagnostic)
  }

  return explainEvidenceStatus(rendering, axis, requirement.evidence)
}

function explainEvidenceStatus(
  rendering: Rendering,
  axis: string,
  evidence: Exclude<EvidenceStatus, 'CONFIRMED'>,
): string {
  switch (evidence) {
    case 'UNKNOWN':
      return whoWasAsked(rendering.report, axis)
    case 'CLAIMED':
      return "la déclaration n'a pas pu être confirmée indépendamment"
    case 'CONFLICTING':
      return 'les observations se contredisent'
  }
}

function explainDiagnostic(
  diagnostic: NonNullable<Extract<RequirementReport, { outcome: 'UNPROVEN' }>['diagnostic']>,
): string {
  switch (diagnostic.reason) {
    case 'INSUFFICIENT_ACTIVE_DAYS':
      return `échantillon insuffisant : ${diagnostic.observed} jours actifs de PR observés, minimum ${diagnostic.minimum} requis`
  }
}

// LIMITATION: the contract records that a collector ran, never why it emitted nothing for one axis,
// so the gap stays unexplained rather than invented. A per-axis reason on ProvenanceEntry would
// lift it.
function whoWasAsked(report: AssessmentReport, axis: string): string {
  const asked = report.provenance.filter((entry) => entry.axes.includes(axis))
  if (asked.length === 0) {
    return "aucun collecteur n'a été interrogé pour cet axe"
  }
  const names = asked.map((entry) => entry.collector).join(', ')
  return `demandé à ${names}, aucune valeur observée`
}

// SAFETY: a blocker whose axis the rendered next level does not carry has no requirement lines to
// sit under and would otherwise vanish, so it states where it belongs on the one line it gets.
function renderOrphanBlocker(rendering: Rendering, blocker: BlockingRequirement): string {
  const { report, style } = rendering
  const level = report.levels.find((candidate) => candidate.id === blocker.level)
  const axisLabel = level?.axes.find((candidate) => candidate.axis === blocker.axis)?.label
  const where = `${axisLabel ?? blocker.axis} à ${level?.label ?? blocker.level}`
  switch (blocker.gap) {
    case 'PRACTICE':
      return `  ${markerFor(style, 'NOT_MET')} ${gapTagFor(style, 'NOT_MET')}${where}, exigence absente du rapport`
    case 'EVIDENCE':
      return `  ${markerFor(style, 'UNPROVEN')} ${gapTagFor(style, 'UNPROVEN')}${where} — ${explainEvidenceStatus(rendering, blocker.axis, blocker.evidence)}`
  }
}

// Not `none`, which `aidd.yml` already ships as a `size` scale value.
function formatScaleValue(
  report: AssessmentReport,
  axis: string,
  value: Threshold | ObservedValue,
): string {
  if (typeof value === 'object') {
    if (value.length === 0) return "l'ensemble vide"
    const raw = value.join(', ')
    const explanations = value
      .map((term) => descriptionFor(report.vocabulary, axis, term))
      .flatMap((description, index) =>
        description === undefined ? [] : [`${value[index]} : ${description}`],
      )
    return explanations.length === 0 ? raw : `${raw} (${explanations.join(' ; ')})`
  }
  return formatTerm(report, axis, value)
}

// SAFETY: A renderer may only append prose published in this report. A term not in that vocabulary remains
// raw, which keeps hand-built reports readable without inventing language for an unknown model.
function formatTerm(report: AssessmentReport, axis: string, value: string | number): string {
  if (typeof value === 'number') {
    const vocabulary = vocabularyFor(report.vocabulary, axis)
    return vocabulary?.kind === 'numeric' ? `${value} (${vocabulary.description})` : String(value)
  }
  const description = descriptionFor(report.vocabulary, axis, value)
  return description === undefined ? value : `${value} (${description})`
}

function describeTerms(report: AssessmentReport, axis: string, terms: readonly string[]): string {
  if (terms.length === 0) return "l'ensemble vide"
  return terms.map((term) => describeTerm(report, axis, term)).join(' ; ')
}

function isStringList(value: Threshold | ObservedValue): value is readonly string[] {
  return Array.isArray(value)
}

function describeTerm(report: AssessmentReport, axis: string, term: string): string {
  return descriptionFor(report.vocabulary, axis, term) ?? term
}

function vocabularyFor(
  vocabulary: readonly AxisVocabularyReport[],
  axis: string,
): AxisVocabularyReport | undefined {
  return vocabulary.find((candidate) => candidate.axis === axis)
}

function descriptionFor(
  vocabulary: readonly AxisVocabularyReport[],
  axis: string,
  term: string,
): string | undefined {
  const scale = vocabularyFor(vocabulary, axis)
  if (scale === undefined || scale.kind === 'numeric') return undefined
  return scale.descriptions[term]
}

type CompletedRoster = Extract<ContributorRosterReport, { status: 'COMPLETED' }>
type FailedRoster = Exclude<ContributorRosterReport, CompletedRoster>
type PracticeBlocker = Extract<BlockingRequirement, { gap: 'PRACTICE' }>
type EvidenceBlocker = Extract<BlockingRequirement, { gap: 'EVIDENCE' }>
type PracticeRequirement = Extract<RequirementReport, { evidence: 'CONFIRMED' }>

// INVARIANT: existence is keyed on `report.contributors === null` alone, never on the roster's own
// status. Falling back to the repository-only rendering when the roster failed would make one
// subject produce two documents depending on credentials, and `cli.md` promises the same bytes on
// any machine, on any day.
//
// INVARIANT: it is the last section of the report, below the gaps. A reader quoting the first level
// they meet must quote the repository's, never one account's.
function renderContributorsSection(rendering: Rendering): string {
  const { report, style } = rendering
  const { contributors } = report
  if (contributors === null) return ''

  if (contributors.status !== 'COMPLETED') {
    return style.heading(renderFailedRoster(contributors))
  }

  const header = style.heading(renderContributorsHeader(contributors))
  if (contributors.rows.length === 0) {
    return header
  }

  const rows = contributors.rows.map((row) => renderContributorRow(rendering, contributors, row))
  const harness = renderSharedHarnessLine(rendering, contributors)

  return [header, ...rows, ...(harness === null ? [] : [harness])].join('\n\n')
}

function renderFailedRoster(roster: FailedRoster): string {
  return `Contributeurs : ${glossRosterStatus(roster.status)} — ${roster.reason}. Le niveau ci-dessus est inchangé.`
}

// INVARIANT: never `glossProvenanceStatus` — that one is typed on a provenance entry, and the
// roster is not a collector and answers no axis.
function glossRosterStatus(status: FailedRoster['status']): string {
  switch (status) {
    case 'FAILED':
      return 'lecture impossible'
    case 'TIMED_OUT':
      return 'délai dépassé'
  }
}

function renderContributorsHeader(contributors: CompletedRoster): string {
  if (contributors.rows.length === 0) {
    return `Contributeurs : aucun compte actif sur les ${contributors.windowDays} derniers jours.`
  }

  const named = contributors.rows.filter((row) => row.account !== null).length
  const accounts = named === 1 ? '1 compte actif' : `${named} comptes actifs`
  const unattributed = contributors.rows.some((row) => row.account === null)
    ? ', plus des commits que GitHub ne rattache à aucun compte'
    : ''

  return `Contributeurs : ${accounts} sur les ${contributors.windowDays} derniers jours${unattributed}. Le niveau ci-dessus couvre toutes les livraisons de la fenêtre, quel qu'en soit l'auteur ; chaque ligne ci-dessous ne couvre que celles d'un compte.`
}

function renderContributorRow(
  rendering: Rendering,
  contributors: CompletedRoster,
  row: ContributorRow,
): string {
  const { style } = rendering
  const label = row.account ?? 'non rattaché'
  const lines = [
    style.heading(`  ${label} — ${renderRowProvenLabel(row)}`),
    style.faint(`    ${renderRowSample(row)}`),
  ]

  const demonstrated = renderRowDemonstrated(rendering, row)
  if (demonstrated !== null) lines.push(demonstrated)

  // What stops the row's own next level: an evidence gap, a practice gap, or both.
  if (row.proven === null) lines.push(...renderRowGapLines(rendering, row))

  lines.push(style.faint(`    ${renderRowHarness(row, contributors)}`))

  return lines.join('\n')
}

// INVARIANT: "aucun" is the row's own result and reads as the report's own null-proven line does —
// never White, never a rank below the floor, and never a verdict on the person named beside it.
function renderRowProvenLabel(row: ContributorRow): string {
  return row.proven === null
    ? 'niveau prouvé : aucun'
    : `niveau prouvé : ${row.proven.label} (rang ${row.proven.rank})`
}

// INVARIANT: `activeDays` where the sample supported a reading, `commits` where it did not — a day
// on which one of this account's own deliveries received a commit is meaningless at zero
// deliveries, so the commit count is what tells "nothing to measure" from "measured and low" for
// that row instead.
function renderRowSample(row: ContributorRow): string {
  if (row.deliveries === 0) {
    const whose =
      row.account === null ? " dont l'adresse d'auteur n'est rattachée à aucun compte GitHub" : ''
    return `${countOf(0, 'livraison')} · ${countOf(row.commits, 'commit')}${whose}`
  }
  return `${countOf(row.deliveries, 'livraison')} · ${countOf(row.activeDays, 'jour actif', 'jours actifs')}`
}

// French agreement: a count below two takes the singular, zero included.
function countOf(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count < 2 ? one : many}`
}

// SAFETY: never below the row's own proven level, and never without the share that earned it — the
// same rule `renderDemonstratedSection` applies at the top of the document, down to the level line
// that ends in a colon and never stands alone.
function renderRowDemonstrated(rendering: Rendering, row: ContributorRow): string | null {
  const { report, style } = rendering
  const { demonstrated, proven } = row
  if (demonstrated === null || demonstrated.level === null) return null
  if (proven === null) return null
  if (demonstrated.level.rank <= proven.rank) return null

  const level = demonstrated.level
  return [
    style.faint(`    démontré : ${level.label} (rang ${level.rank}), atteint sur :`),
    ...demonstrated.axes.map((axis) =>
      style.faint(`      ${renderDemonstratedAxis(report, axis)}`),
    ),
  ].join('\n')
}

function renderRowGapLines(rendering: Rendering, row: ContributorRow): readonly string[] {
  const practiceBlockers = row.blocking.filter(
    (blocker): blocker is PracticeBlocker => blocker.gap === 'PRACTICE',
  )
  // INVARIANT: a practice gap on the row is a measurement that did say something, and the row must
  // read that way rather than as the evidence gap the thin-sample prose describes. A row mixing
  // both never reads as an evidence gap once one axis was actually measured and found low.
  if (practiceBlockers.length > 0) {
    return practiceBlockers.map((blocker) => renderRowPracticeGap(rendering, blocker))
  }

  const evidenceBlockers = row.blocking.filter(
    (blocker): blocker is EvidenceBlocker => blocker.gap === 'EVIDENCE',
  )
  return evidenceBlockers.length === 0 ? [] : [renderRowEvidenceGap(rendering, evidenceBlockers)]
}

// SAFETY: a row names a person, so the line states the shortfall and stops. `project-brief.md`
// forbids recommending a practice change from a failure to prove one, and a row must not read as a
// verdict on anyone: no imperative is ever appended here, whichever branch renders it.
//
// INVARIANT: the values themselves go through `renderPracticeGapFact`, the report's own, so a row
// and the axis lines above it never describe one threshold in two vocabularies. Only the frame is
// the row's, because a row carries no axis line to sit under.
function renderRowPracticeGap(rendering: Rendering, blocker: PracticeBlocker): string {
  const { report, style } = rendering
  const { levelLabel, axisLabel, axis } = locateAxis(report, blocker)
  const tag = gapTagFor(style, 'NOT_MET')
  const requirement = findUniquePracticeRequirement(axis, blocker)
  if (requirement === undefined) {
    return `    ${tag}${axisLabel} à ${levelLabel} : la pratique observée n'atteint pas l'exigence.`
  }
  const evidence = style.faint(`(${requirement.evidence})`)
  const fact = renderPracticeGapFact(report, blocker.axis, requirement, evidence)
  return `    ${tag}${axisLabel} à ${levelLabel} : ${fact}`
}

function renderRowEvidenceGap(rendering: Rendering, blockers: readonly EvidenceBlocker[]): string {
  const { report, style } = rendering
  const labels = blockers.map((blocker) => locateAxis(report, blocker).axisLabel)
  const verb = labels.length === 1 ? 'reste' : 'restent'
  return `    ${gapTagFor(style, 'UNPROVEN')}l'échantillon propre à ce compte n'a pas permis de trancher : ${joinLabels(labels)} ${verb} sans réponse pour ce compte. Ce n'est pas un constat sur sa pratique.`
}

function joinLabels(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`
}

interface AxisLocation {
  readonly levelLabel: string
  readonly axisLabel: string
  readonly axis: AxisReport | undefined
}

function locateAxis(report: AssessmentReport, blocker: BlockingRequirement): AxisLocation {
  const level = report.levels.find((candidate) => candidate.id === blocker.level)
  const axis = level?.axes.find((candidate) => candidate.axis === blocker.axis)
  return {
    levelLabel: level?.label ?? blocker.level,
    axisLabel: axis?.label ?? blocker.axis,
    axis,
  }
}

// LIMITATION: BlockingRequirement carries no requirement identity, so the requirement is re-derived
// from a key that is not unique. Ambiguous means no threshold, never a guessed one. Fix belongs in
// the contract — see aidd_docs/memory/architecture.md, "Frozen before the split".
function findUniquePracticeRequirement(
  axis: AxisReport | undefined,
  blocker: PracticeBlocker,
): PracticeRequirement | undefined {
  const matches = (axis?.requirements ?? []).filter(
    (candidate): candidate is PracticeRequirement =>
      candidate.evidence === 'CONFIRMED' && candidate.outcome === blocker.outcome,
  )
  return matches.length === 1 ? matches[0] : undefined
}

// The axis the roster's one shared value belongs to, named by the contract field itself.
const HARNESS_AXIS = 'harness'

function renderSharedHarnessLine(
  { report, style }: Rendering,
  contributors: CompletedRoster,
): string | null {
  // INVARIANT: `null` is an evidence gap the roster completed anyway — the loaded model declares no
  // harness axis, or the scan left a rankable member undecidable — never a failure, and the
  // sentence is omitted rather than printed with a fabricated value.
  if (contributors.harnessObserved === null) return null
  const observed = formatScaleValue(report, HARNESS_AXIS, contributors.harnessObserved)
  return style.faint(
    `  Le harness est celui du dépôt, pas celui d'une personne : ${observed}, disponible pour chaque compte ci-dessus, qui en porte la même valeur.`,
  )
}

function renderRowHarness(row: ContributorRow, contributors: CompletedRoster): string {
  // SAFETY: `null` is a walk that did not run, and never "wrote none of it" — printing the latter
  // for a `git` that failed would publish a claim about a person on the strength of a refusal.
  if (row.harnessAuthorship === null) {
    return "harness : l'attribution n'a pas pu être lue"
  }
  if (contributors.harnessPaths === 0) {
    return "harness : l'ensemble harness de ce dépôt est vide"
  }
  const { files } = row.harnessAuthorship
  const written =
    files === 0
      ? `n'a écrit aucun des ${contributors.harnessPaths} fichiers`
      : `a écrit ${files} des ${contributors.harnessPaths} fichiers`
  return `harness : ce compte ${written} de l'ensemble harness de ce dépôt`
}
