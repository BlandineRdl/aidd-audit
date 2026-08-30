import type {
  ContributorRecord,
  ContributorRosterRun,
} from '../../evidence/ports/contributor-roster.port.js'
import { resolveEvidence } from '../../evidence/resolution/resolve-evidence.js'
import { checkMaturity } from '../../maturity/engine/maturity-engine.js'
import type { AxisId, MaturityModel } from '../../maturity/models/maturity.model.js'
import type {
  ContributorRosterReport,
  ContributorRow,
} from '../contracts/assessment-report.contract.js'
import {
  blockersOf,
  reportDemonstrated,
  reportLevel,
  toObservation,
  type ProjectionContext,
} from './report-projection.js'

export interface ContributorRosterComposition {
  readonly model: MaturityModel
  readonly run: ContributorRosterRun | null
}

// INVARIANT: each record is resolved by its own call to `resolveEvidence`, over its own
// observations only. Two accounts' observations meeting in one call is what would turn every shared
// axis into CONFLICTING, and it is the failure the whole roster design exists to avoid — so this
// function never concatenates records and never falls back to another record's, or the report's own,
// evidence for an axis a record did not answer.
export function composeContributorRoster(
  input: ContributorRosterComposition,
): ContributorRosterReport | null {
  const { model, run } = input
  if (run === null) return null

  if (run.status !== 'COMPLETED') {
    return { status: run.status, rows: [], reason: run.reason }
  }

  const axes = model.axes.map((axis) => axis.id)
  const rows = run.records.map((record) => rowOf(model, axes, record))
  rows.sort(compareRows)

  return {
    status: 'COMPLETED',
    windowDays: run.windowDays,
    harnessObserved: run.harnessObserved,
    harnessPaths: run.harnessPaths,
    rows,
  }
}

function rowOf(
  model: MaturityModel,
  axes: readonly AxisId[],
  record: ContributorRecord,
): ContributorRow {
  // A record naming an undeclared axis contributes nothing: resolveEvidence maps strictly over axes.
  const evidence = resolveEvidence(record.observations, axes)
  const sustained = evidence.filter((entry) => entry.reading === 'SUSTAINED')
  const demonstrated = evidence.filter((entry) => entry.reading === 'DEMONSTRATED')

  const check = checkMaturity(model, sustained.map(toObservation))
  const context: ProjectionContext = {
    evidenceByAxis: new Map(sustained.map((entry) => [entry.axis, entry])),
    labelsByAxis: new Map(model.axes.map((axis) => [axis.id, axis.label])),
  }

  const proven = check.proven === null ? null : reportLevel(check.proven, context)
  const next = check.next === null ? null : reportLevel(check.next, context)

  return {
    account: record.account,
    emailAddresses: record.emailAddresses,
    commits: record.commits,
    deliveries: record.deliveries,
    activeDays: record.activeDays,
    harnessAuthorship: record.harnessAuthorship,
    proven,
    demonstrated: reportDemonstrated(model, sustained, demonstrated, check.proven),
    blocking: blockersOf(next),
  }
}

// INVARIANT: deliveries descending, then account ascending by code unit — never `localeCompare`,
// which depends on the host's locale and ICU build. The unattributed bucket (`account === null`)
// sorts last whatever its delivery count, because it is not a person and reading it among the
// people would state that it is one.
function compareRows(left: ContributorRow, right: ContributorRow): number {
  if (left.account === null && right.account === null) return 0
  if (left.account === null) return 1
  if (right.account === null) return -1

  if (left.deliveries !== right.deliveries) return right.deliveries - left.deliveries
  if (left.account < right.account) return -1
  if (left.account > right.account) return 1
  return 0
}
