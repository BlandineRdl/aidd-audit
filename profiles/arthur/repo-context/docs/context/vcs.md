# Version control

- Conventional commits, scoped by task id. The id comes from the plan, so a
  commit traces back to the spec that asked for it.
- One worktree, one branch, one pull request. A branch that grew a second intent
  is split before review.
- Terraform plans are committed to the pull request. Apply is manual, always.
