# Plan — client portal, three tracks in parallel

> Client C. Four weeks of work, run as three independent tracks over nine days.

## Why three and not one

The three touch different directories and share no file. That is the only
reason they can run at once, and it is checked before the split, not after:

```
track-1  api/billing/**         34 files
track-2  web/dashboard/**       41 files
track-3  infra/**               18 files
```

Intersection is empty. If it were not, the two tracks would be merged into one
rather than run side by side — a conflict costs more than the serial time saved.

## The three tracks

| id | What | Its own check |
| -- | ---- | ------------- |
| `t1-invoice-api` | Invoice endpoints, FastAPI | `pytest tests/billing -q` |
| `t2-dashboard` | Dashboard screens, React | `pnpm test --filter dashboard` |
| `t3-infra` | RDS parameter group, backups | `terraform plan -detailed-exitcode` |

Each check is written **before** the task runs. A task whose check I cannot
write is a task I have not understood well enough to delegate.

## Sequencing

t1 and t2 start together. t3 starts once t1's schema is settled — it needs the
final table sizes for the parameter group. Written down rather than remembered:
on the last project I started the infra track too early and redid it.

## Where it stops

`terraform apply` is not in any track. It is manual, always, and the deny list
in `.claude/settings.json` enforces that rather than trusting me to remember.
