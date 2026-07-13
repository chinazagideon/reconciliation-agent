# 0007 - Independent database, not shared with marketplace

**Status:** Accepted
**Date:** 2026-07-10

## Context

Resolution AI reconciles financial data from marketplace platforms
(e.g. Smooov). The question: should it connect directly to the
marketplace's PostgreSQL database (shared instance, separate schemas)
or own its own independent database?

Three sub-questions drive the decision:

1. **Portfolio independence.** Can an interviewer clone the repo and
   run it without any other system existing?
2. **Security boundary.** Should a publicly demo-able tool with
   synthetic data have a network path to production financial data?
3. **Architectural consistency.** The system claims to be
   source-agnostic via `FieldMapping`. Is the marketplace's ledger
   actually treated the same as Stripe and CSV, or is it special-cased
   with a direct database join?

## Decision

Resolution AI owns its own PostgreSQL instance. It does not connect to
any marketplace's database directly.

The marketplace's ledger is an **external data source** — same category
as Stripe. Ledger data enters Resolution AI through the standard
ingestion pipeline:

- **Demo/dev:** synthetic seeder generates ledger-shaped records.
- **Manual:** operator exports a CSV from their accounting system and
  uploads it via the CSV column mapper.
- **Future (v1.1+):** a `SmooovLedgerSource` adapter pulls from
  Smooov's API. This is one adapter implementing `RecordSource` — not
  a database topology change.

All ingested data is normalised via `FieldMapping` and stored in
Resolution AI's own `reconciliation.transactions` table with
`source = 'ledger'`.

## Alternatives considered

**Shared Postgres, separate schemas.** Resolution AI runs
`reconciliation.*` and `audit.*` schemas alongside the marketplace's
tables. The "ledger source" is a direct SQL query to the marketplace's
`ledger_entries` table.

Rejected because:
- Kills portfolio independence. An interviewer cannot run the project
  without the marketplace database, its schema, and its seed data.
- Creates a security path from a public demo deployment to production
  financial data.
- Contradicts source-agnostic design. If the ledger is a direct SQL
  join, it's hardwired to one schema. Adding a second marketplace
  would require another direct DB connection instead of another
  adapter.
- Couples migration lifecycles. A bad migration in one system can
  lock or conflict with the other.

## Consequences

- (+) Resolution AI is fully standalone. Clone, run migrations, seed,
  demo. No dependencies on external systems.
- (+) Security: demo deployments have no path to production data.
- (+) Architectural honesty: the `FieldMapping` claim is real. Every
  source, including the marketplace's ledger, goes through the same
  normalisation pipeline.
- (+) Interview sentence: "Resolution AI is an independent auditor,
  not an embedded feature. It consumes financial data from any source
  through the same pipeline. The independence is what makes it
  trustworthy."
- (-) No direct SQL access to the marketplace's ledger. Ledger data
  must be exported/imported. Accepted — this is a feature (proves
  source-agnostic design), not a cost.
- (-) One more Postgres instance to manage locally. Mitigated: one
  additional Docker container on a different port. ~$0/month on
  Fly.io hobby tier in production.
