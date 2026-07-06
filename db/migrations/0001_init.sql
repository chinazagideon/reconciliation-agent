-- 0001_init.sql  |  First-cut schema for Resolution AI
-- Design rules baked in here:
--   * Money is BIGINT minor units (cents). NEVER a float/decimal-as-money. (ADR-0005 spirit)
--   * Raw provider payloads live in JSONB next to normalized columns.        (ADR-0003)
--   * Every write-facing table carries an idempotency_key to make retries/
--     webhook redeliveries safe (insert is a no-op on conflict).
-- Migrations are append-only: to change this, add 0002_*.sql. Do not edit 0001.

CREATE SCHEMA IF NOT EXISTS reconciliation;
CREATE SCHEMA IF NOT EXISTS audit;

-- Normalized, provider-agnostic view of a single money record from any source.
-- source = 'stripe' | 'ledger' | 'payout'
CREATE TABLE IF NOT EXISTS reconciliation.transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source          TEXT        NOT NULL,
    external_id     TEXT        NOT NULL,          -- id in the source system
    amount_minor    BIGINT      NOT NULL,          -- cents; sign convention documented in code
    currency        CHAR(3)     NOT NULL,          -- ISO 4217, e.g. 'CAD'
    occurred_at     TIMESTAMPTZ NOT NULL,
    raw             JSONB       NOT NULL,          -- original payload, untouched
    idempotency_key TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source, idempotency_key)               -- dedupe re-ingested records
);
-- Indexes on the columns we actually filter/join by (ADR-0004: retrieval is SQL).
CREATE INDEX IF NOT EXISTS ix_txn_source_time ON reconciliation.transactions (source, occurred_at);
CREATE INDEX IF NOT EXISTS ix_txn_amount      ON reconciliation.transactions (amount_minor);

-- A reconciliation run = one saga/state-machine execution over a time window.
CREATE TABLE IF NOT EXISTS reconciliation.reconciliations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    window_start TIMESTAMPTZ NOT NULL,
    window_end   TIMESTAMPTZ NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'pending',  -- pending|matching|explaining|done|failed
    matched_count   INT      NOT NULL DEFAULT 0,
    unmatched_count INT      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One AI reasoning attempt over the residue of a run. Suggestion, not authority.
CREATE TABLE IF NOT EXISTS reconciliation.agent_runs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id UUID NOT NULL REFERENCES reconciliation.reconciliations(id),
    transaction_id    UUID NOT NULL REFERENCES reconciliation.transactions(id),
    hypothesis        TEXT,
    confidence        NUMERIC(4,3),                 -- 0.000-1.000
    suggested_action  TEXT,
    needs_human       BOOLEAN NOT NULL DEFAULT true, -- default to caution
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_agent_recon ON reconciliation.agent_runs (reconciliation_id);

-- Append-only audit trail. Nothing here is ever updated or deleted.
CREATE TABLE IF NOT EXISTS audit.audit_log (
    id         BIGSERIAL PRIMARY KEY,
    at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor      TEXT NOT NULL,        -- 'system:matcher' | 'system:agent' | 'user:<id>'
    event      TEXT NOT NULL,        -- e.g. 'match.created', 'agent.explained'
    entity_id  UUID,
    detail     JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_audit_at ON audit.audit_log (at);
