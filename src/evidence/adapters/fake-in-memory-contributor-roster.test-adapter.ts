import type {
  ContributorRoster,
  ContributorRosterContext,
  ContributorRosterRun,
} from '../ports/contributor-roster.port.js'

export class FakeInMemoryContributorRoster implements ContributorRoster {
  readonly contexts: ContributorRosterContext[] = []

  constructor(
    readonly id: string,
    private readonly run: ContributorRosterRun,
  ) {}

  async read(context: ContributorRosterContext): Promise<ContributorRosterRun> {
    this.contexts.push(context)

    return this.run
  }
}
