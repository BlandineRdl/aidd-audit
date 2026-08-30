# Conventions

> Last updated: 3 February 2026.

- Errors wrapped with `%w`, never swallowed.
- `internal/store` exposes functions, not interfaces. There is one
  implementation and there will not be another.
- Amounts are `int64` cents. The one place this was a `float64` cost us a
  reconciliation weekend.
- Integration tests run against `billing_dev`, the shared development database.
  Warn on the team channel before running a suite that writes.
