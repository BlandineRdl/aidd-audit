// INVARIANT: A shape a port and an adapter both name is a model, on the footing
// `collector-provenance.model.ts` already sits here. `files` and `commits` never partition the
// proving set they were read over — a file written by one account and later edited by another
// counts once for each, and the sum of `files` across accounts may exceed the size of that set.
export interface HarnessAuthorship {
  readonly files: number
  readonly commits: number
}

// INVARIANT: The zero reading — an account observed to have authored none of the proving paths.
// Never stands in for a walk that did not run: that answer is `null`, and this file exports no
// constant for it, so "authored nothing" cannot be spelled two ways.
export const NO_HARNESS_AUTHORSHIP: HarnessAuthorship = { files: 0, commits: 0 }
