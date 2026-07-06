# Reconciliation Agent

A financial reconciliation agent for two-sided marketplaces. It ingests Stripe
transactions, internal ledger entries, and supplier payout records, matches them
**deterministically**, then uses AI reasoning **only** to explain the leftovers —
with confidence scores and audit trails.

> Core thesis: *shipping AI features that touch money without catastrophic
> failure modes.* Boring deterministic core; AI at the boundary.

## Shape
- `services/core` — TypeScript (Fastify), hexagonal. Owns all money logic.
- `services/agent` — Python (FastAPI) sidecar. Explains unmatched items via Claude.
- `db/migrations` — PostgreSQL schema (JSONB for raw payloads).
- `docs/` — PROJECT_CONTEXT, STATUS, and the ADR log (`docs/decisions/`).

## Golden rule of the architecture
Dependencies point **inward**. `domain/` imports nothing from `adapters/`.
The AI layer proposes; it never decides. Every match is auditable.

## Run (once implemented)
1. `cp .env.example .env` and fill in.
2. `psql "$DATABASE_URL" -f db/migrations/0001_init.sql`
3. `cd services/core && npm i && npm run dev`
4. `cd services/agent && pip install -e . && uvicorn app.main:app --reload`
