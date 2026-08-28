# Ecosystem

Six client repositories. Same way of working, different stacks and different
tolerance for risk.

| Client | Stack | What breaks first |
| --- | --- | --- |
| A | TypeScript portal, Postgres | billing totals, always |
| B | Python, FastAPI, Stripe | the payment provider's semantics |
| C | TypeScript, React dashboard | nothing since the rewrite |
| D | Terraform only | state locks during a long apply |
| E | Python, batch jobs | memory, on the yearly run |
| F | TypeScript, small API | dormant, one deploy this year |

Sonar runs on A, which is the one with real volume. The others are read by hand.
