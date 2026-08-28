# Unify the total computation across documents

> Written before starting. Status: shipped in PR #1284.

## The problem

Bug #1279: a credit note applied the German VAT rate to a French customer. The
fix landed on the invoice path only, because the same computation exists three
times — invoice, quote, credit note — and nothing links them.

Three copies means three places to fix, and we have already missed one.

## What I want

One function. Given lines and a country, it returns the gross total. The three
documents call it.

## Decisions taken before writing code

| Question | Answer | Why |
| -------- | ------ | --- |
| Where does it live? | `shared/pricing.ts` | It is domain logic, and both `web` and `api` need it |
| Where does the credit note sign go? | In the caller | It is the only thing that distinguishes the three documents. Putting it inside would need a `type` parameter and a branch |
| Rates in code or in the database? | In code, for now | A database table needs a migration and an admin screen. Rates change once a year |
| Pure function or a class? | Pure | It has no state, and a pure function is testable without a database |

## Cases that must be covered

- A country we do not know → default rate, no throw.
- An empty list → 0, not `NaN`.
- Rounding: `0.1 × 3` must give `0.30`, not `0.30000000000000004`.
- A negative quantity → rejected by the schema, not silently computed.

## What I am explicitly not doing

Moving rates into the database. Migrating historical documents. Touching the
PDF renderer.

## How I will know it worked

Bug #1279 has a regression test. The three call sites import from one place —
`grep -r "0.19" shared/ api/` returns only `shared/pricing.ts`.
