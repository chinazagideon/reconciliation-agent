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

## Run
1. `cp .env.example .env` and fill in (per service too: `services/core/.env`,
   `services/agent/.env`).
2. `psql "$DATABASE_URL" -f db/migrations/0001_init.sql -f db/migrations/0002_matches_reviews.sql`
3. `cd services/core && npm i && npm run dev`  (starts the API + pg-boss worker)
4. `cd services/agent && pip install -e . && uvicorn app.main:app --reload`
   - Offline (no key): set `LLM_PROVIDER=heuristic`. With Claude: `LLM_PROVIDER=anthropic`
     + `ANTHROPIC_API_KEY`. Swap models via `LLM_MODEL`.
5. Seed + run:
   ```
   curl -XPOST localhost:3000/seed
   curl -XPOST localhost:3000/reconciliations \
     -H 'content-type: application/json' \
     -d '{"windowStart":"2026-06-16T00:00:00Z","windowEnd":"2026-07-01T00:00:00Z"}'
   ```
   Or seed from the CLI: `cd services/core && npm run seed`.

### Key endpoints
- `POST /seed` — generate synthetic data + `seed-manifest.json`
- `POST /reconciliations` — start a run (202 + runId; worker executes)
- `GET /reconciliations`, `GET /reconciliations/:id` — list / detail (tabs)
- `GET /transactions/:id` — record + counterpart + lifecycle
- `GET /audit?event=&actor=` — append-only audit log
- `POST /review-items/:id/action` — `approve` / `override` / `dismiss`
