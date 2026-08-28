# Codebase map

| Where | What | Touch with care |
| --- | --- | --- |
| `connectors/` | one package per source | never writes to the warehouse |
| `pipeline/` | normalise → validate → batch → sink | owns every write, and idempotency |
| `scheduler/` | what runs when, leases | a lease bug duplicates a whole run |
| `api/` | control plane: connectors, runs, replay | public, two integrations depend on it |
| `web/` | operator console | React, no business logic |
| `internal/crypto/` | client secret handling | human review required, no generation |

Entry points worth reading first: `pipeline/run.go`, then `scheduler/lease.go`.
