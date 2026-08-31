import type { ContributorRoster } from '../ports/contributor-roster.port.js'

// COMPAT: `failure` is `unknown` because that is what a `catch` receives — a boundary can reject
// with anything.
export class FailingContributorRoster implements ContributorRoster {
  constructor(
    readonly id: string,
    private readonly failure: unknown,
  ) {}

  async read(): Promise<never> {
    throw this.failure
  }
}
