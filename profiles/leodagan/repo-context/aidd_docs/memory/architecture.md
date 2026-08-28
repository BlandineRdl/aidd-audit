# Architecture

Ingest platform. Takes data out of client systems, normalises it, lands it in
the warehouse.

```
connectors/   one package per source, no shared state
pipeline/     normalise → validate → batch → sink
scheduler/    decides what runs when, holds the leases
api/          control plane: connectors, runs, replay
web/          operator console
```

A connector never writes to the warehouse. It yields records; the pipeline owns
every write.

## Deliberately absent

- **No shared cache between connectors.** Two sources agreeing on an id by
  accident would overwrite each other.
- **No retry inside a connector.** Retries live in the pipeline, where the
  idempotency key is known.

## Known weak point

The scheduler holds leases in Postgres with a fixed timeout. A run that hangs
past it is picked up twice, and only the sink's idempotency saves us.
