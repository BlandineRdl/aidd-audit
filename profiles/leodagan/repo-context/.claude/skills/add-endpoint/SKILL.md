---
name: add-endpoint
description: Add an HTTP endpoint to the ingest platform: contract first, table-driven tests, then the handler. Use when exposing a new route.
---

# Procedure — add an endpoint

Written down because the first three times we did it, we forgot a different
step each time.

1. **Contract first.** Add the path to `openapi.yaml`. Request, response, error
   codes. Nothing else until this is reviewed.
2. **Failing test.** `internal/api/<resource>_test.go`, one case per error code
   in the contract. Run it, watch it fail for the right reason.
3. **Handler.** Transport only: decode, call the domain, encode. No business
   logic in `internal/api/`.
4. **Domain function**, with its own tests, in the package that owns the data.
5. **Store query** if needed. Follow `.claude/rules/sql.md` — deadline, named columns,
   `EXPLAIN` in the PR if the table is large.
6. **Metric.** One counter and one histogram, named after the endpoint.
7. **Regenerate the client.** `make client`. Commit the diff separately.

## Done when

`make verify` is green, the contract diff is in the PR, and the metric appears
in the local Grafana.
