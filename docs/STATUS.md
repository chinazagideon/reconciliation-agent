# Status

- **Current week:** Week 3 (kickoff, 5 July 2026)
- **Milestone:** Backend v1 implemented end-to-end (deterministic core → AI
  sidecar → human review → audit), API-verifiable against local Postgres.
- **Now:** Backend feature-complete for v1 scope. Next: the deferred frontend
  (7 shadcn/ui pages) and Fly.io deploy.
- **Blockers:** none

## Definition of "Week 3 done"
- [x] 0001_init.sql (+ 0002_matches_reviews.sql) applied to a local Postgres
- [x] One deterministic run matches a synthetic Stripe+ledger dataset end to end
- [x] Unmatched items land in the review queue / agent_runs
- [x] ADRs 0001-0006 committed

## Backend v1 — done
- [x] Source-agnostic normalisation (`FieldMapping` + JSONPath) — stripe/ledger/csv
- [x] Synthetic seeder: 222 records, 9 discrepancy patterns, real Stripe JSON
      shapes, self-consistent `seed-manifest.json`, idempotent
- [x] Stripe connector (Balance Transactions via SDK; no-op without a live key)
- [x] CSV ingest with column mapping + float-free dollars→cents parser
- [x] Exact matcher (amount|currency|UTC-day, 1:1)
- [x] Tolerant matcher: timing ±1d, fee (2.9%+$0.30), batch aggregation with the
      >10-candidate fraud cap
- [x] AI explainer via a swappable `LLMProvider` (Anthropic default + offline
      heuristic), confidence + `needs_human` threshold
- [x] Graceful degradation (ADR-0006): sidecar down → `done` + `ai_skipped`
- [x] Human review: approve / override / dismiss + `human_approved` matches
- [x] Append-only audit log + read APIs (runs, run detail tabs, txn detail, audit)
- [x] pg-boss queue: run executes off the request path (202 + runId)

### Verified end-to-end (local Postgres)
Seeded run: matched **168**, AI-residue **52** (8 explained / 44 review), fraud
**2** — sums to 222 total. Sidecar-down path degrades to `ai_skipped`. N2 (no
float money math) and N4 (sidecar has no DB access) guards clean.

## Deferred (follow-up)
Frontend (7 shadcn/ui pages), interactive CSV/JSON field-mapper UI (v1.1),
Fly.io deploy (N5), dark mode (N6).

_Rule: the agent only earns the right to exist on items SQL couldn't resolve.
Deterministic core stays load-bearing; AI is additive._
