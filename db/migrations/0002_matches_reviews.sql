-- 0002_matches_reviews.sql  |  Output tables for the reconciliation engine.
-- Follows 0001's rules: money is BIGINT minor units, raw payloads in JSONB,
-- every write-facing table carries an idempotency_key (insert is a no-op on
-- conflict). Migrations are append-only: to change this, add 0003_*.sql.
--
-- Adds the tables 0001 was missing:
--   * reconciliation.matches      -- pairs the deterministic core produced
--   * reconciliation.review_items -- the human-facing queue (AI residue + fraud)
-- and extends reconciliation.reconciliations with degradation flags + a
-- per-run breakdown of counts the dashboard reads.

-- A Match links records the deterministic core (or a human) decided belong
-- together. For 1:1 matches, left/right are the two paired transactions. For
-- batch aggregation (N-to-1), `right_txn_id` is the single side and the N
-- members of the other side are listed in `detail.members` (array of txn ids).
CREATE TABLE IF NOT EXISTS reconciliation.matches (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id UUID NOT NULL REFERENCES reconciliation.reconciliations(id),
    left_txn_id       UUID NOT NULL REFERENCES reconciliation.transactions(id),
    right_txn_id      UUID NOT NULL REFERENCES reconciliation.transactions(id),
    strategy          TEXT NOT NULL,   -- 'exact' | 'tolerant:timing' | 'tolerant:fee'
                                       -- | 'tolerant:batch' | 'human_approved'
    detail            JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key   TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (idempotency_key)           -- re-running a match is a no-op
);
CREATE INDEX IF NOT EXISTS ix_match_recon ON reconciliation.matches (reconciliation_id);
CREATE INDEX IF NOT EXISTS ix_match_left  ON reconciliation.matches (left_txn_id);
CREATE INDEX IF NOT EXISTS ix_match_right ON reconciliation.matches (right_txn_id);

-- The human-facing review queue. Holds two kinds of items:
--   * kind = 'ai'    -- residue the AI sidecar explained; needs_human when
--                       confidence < AI_CONFIDENCE_THRESHOLD (or AI skipped).
--   * kind = 'fraud' -- batch aggregation saw > 10 candidates and bailed out;
--                       these BYPASS the AI sidecar entirely (ADR-0005 spirit:
--                       the sidecar explains ambiguity, not anomaly).
-- `resolution` is NULL while pending; set once by a human review action. This is
-- the ONE mutable-by-humans table; the audit log records every such change.
CREATE TABLE IF NOT EXISTS reconciliation.review_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id UUID NOT NULL REFERENCES reconciliation.reconciliations(id),
    transaction_id    UUID NOT NULL REFERENCES reconciliation.transactions(id),
    kind              TEXT NOT NULL,          -- 'ai' | 'fraud'
    hypothesis        TEXT,                   -- AI plain-English explanation (NULL for fraud/skipped)
    confidence        NUMERIC(4,3),           -- 0.000-1.000 (NULL for fraud/skipped)
    suggested_action  TEXT,                   -- e.g. 'match_with:<id>', 'flag_fraud', 'investigate'
    needs_human       BOOLEAN NOT NULL DEFAULT true,
    candidate_count   INT,                    -- fraud only: how many candidates tripped the >10 cap
    resolution        TEXT,                   -- NULL | 'approved' | 'overridden' | 'dismissed'
    resolution_note   TEXT,                   -- operator's own explanation (override) or free note
    resolved_by       TEXT,                   -- actor id, e.g. 'user:chinaza'
    resolved_at       TIMESTAMPTZ,
    idempotency_key   TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (idempotency_key)
);
CREATE INDEX IF NOT EXISTS ix_review_recon  ON reconciliation.review_items (reconciliation_id);
CREATE INDEX IF NOT EXISTS ix_review_txn    ON reconciliation.review_items (transaction_id);
CREATE INDEX IF NOT EXISTS ix_review_open   ON reconciliation.review_items (reconciliation_id)
    WHERE resolution IS NULL;               -- fast "what's still in the queue"

-- Extend the run aggregate with the degradation flags (ADR-0006) and the
-- per-run breakdown the dashboard renders. Guarded so re-applying is safe.
ALTER TABLE reconciliation.reconciliations
    ADD COLUMN IF NOT EXISTS ai_skipped      BOOLEAN NOT NULL DEFAULT false,  -- sidecar was unreachable
    ADD COLUMN IF NOT EXISTS partial         BOOLEAN NOT NULL DEFAULT false,  -- completed without full AI pass
    ADD COLUMN IF NOT EXISTS explained_count INT     NOT NULL DEFAULT 0,      -- AI conf >= threshold
    ADD COLUMN IF NOT EXISTS review_count    INT     NOT NULL DEFAULT 0,      -- items needing a human
    ADD COLUMN IF NOT EXISTS fraud_count     INT     NOT NULL DEFAULT 0;      -- >10-candidate flags
