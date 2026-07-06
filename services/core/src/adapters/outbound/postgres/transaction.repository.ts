// Driven adapter: persistence for normalised transactions. Data access ONLY.
// Parameterised queries; every write is idempotent (ON CONFLICT DO NOTHING on
// the natural key source+idempotency_key, so re-ingesting a window is a no-op).
import type { Transaction } from "../../../domain/reconciliation/transaction.js";
import type { MatchCandidate } from "../../../domain/reconciliation/match.js";
import { money, currency } from "../../../domain/shared/branded.js";
import { type Result, ok, err } from "../../../domain/shared/result.js";
import { pool } from "./pool.js";

// Idempotency key for a transaction = its id in the source system. Re-pulling
// the same Stripe window, or re-seeding, will not duplicate rows.
const idemKey = (t: Transaction): string => t.externalId;

export interface StoredTransaction extends MatchCandidate {
  readonly source: string;
  readonly externalId: string;
  readonly raw: unknown;
}

export class PgTransactionRepository {
  /** Idempotent bulk insert. Returns how many NEW rows were written. */
  async insertMany(txns: Transaction[]): Promise<Result<{ inserted: number }>> {
    if (txns.length === 0) return ok({ inserted: 0 });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let inserted = 0;
      for (const t of txns) {
        const res = await client.query(
          `INSERT INTO reconciliation.transactions
             (source, external_id, amount_minor, currency, occurred_at, raw, idempotency_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (source, idempotency_key) DO NOTHING`,
          [t.source, t.externalId, t.amount, t.currency, t.occurredAt, JSON.stringify(t.raw), idemKey(t)],
        );
        inserted += res.rowCount ?? 0;
      }
      await client.query("COMMIT");
      return ok({ inserted });
    } catch (e) {
      await client.query("ROLLBACK");
      return err(e instanceof Error ? e : new Error(String(e)));
    } finally {
      client.release();
    }
  }

  /** Match-time read: candidates from one or more sources within the window. */
  async findBySource(
    sources: string[],
    windowStart: Date,
    windowEnd: Date,
  ): Promise<Result<MatchCandidate[]>> {
    try {
      const { rows } = await pool.query(
        `SELECT id, amount_minor, currency, occurred_at,
                (raw->>'type' = 'payout' OR raw->>'reporting_category' = 'payout') AS is_aggregate
           FROM reconciliation.transactions
          WHERE source = ANY($1)
            AND occurred_at >= $2 AND occurred_at < $3
          ORDER BY occurred_at ASC`,
        [sources, windowStart, windowEnd],
      );
      return ok(
        rows.map((r) => ({
          transactionId: r.id as string,
          amount: money(Number(r.amount_minor)),
          currency: currency(String(r.currency).toUpperCase()),
          occurredAt: new Date(r.occurred_at),
          isAggregate: r.is_aggregate === true,
        })),
      );
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /** Full record for the transaction-detail read API. */
  async findById(id: string): Promise<Result<StoredTransaction | null>> {
    try {
      const { rows } = await pool.query(
        `SELECT id, source, external_id, amount_minor, currency, occurred_at, raw
           FROM reconciliation.transactions WHERE id = $1`,
        [id],
      );
      if (rows.length === 0) return ok(null);
      const r = rows[0];
      return ok({
        transactionId: r.id,
        source: r.source,
        externalId: r.external_id,
        amount: money(Number(r.amount_minor)),
        currency: currency(String(r.currency).toUpperCase()),
        occurredAt: new Date(r.occurred_at),
        raw: r.raw,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /** Batch fetch full records (with raw payload) for residue enrichment. */
  async findByIds(ids: string[]): Promise<Result<StoredTransaction[]>> {
    if (ids.length === 0) return ok([]);
    try {
      const { rows } = await pool.query(
        `SELECT id, source, external_id, amount_minor, currency, occurred_at, raw
           FROM reconciliation.transactions WHERE id = ANY($1)`,
        [ids],
      );
      return ok(
        rows.map((r) => ({
          transactionId: r.id,
          source: r.source,
          externalId: r.external_id,
          amount: money(Number(r.amount_minor)),
          currency: currency(String(r.currency).toUpperCase()),
          occurredAt: new Date(r.occurred_at),
          raw: r.raw,
        })),
      );
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /** Seeder idempotency / demo reset: clear all reconciliation data so a reseed
   *  starts clean. Transactions are referenced by matches/review_items/agent_runs,
   *  so we TRUNCATE the whole reconciliation set (CASCADE handles the FK order).
   *  The append-only audit log is intentionally left untouched. */
  async resetReconciliationData(): Promise<Result<void>> {
    try {
      await pool.query(
        `TRUNCATE reconciliation.matches, reconciliation.review_items,
                  reconciliation.agent_runs, reconciliation.reconciliations,
                  reconciliation.transactions RESTART IDENTITY CASCADE`,
      );
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
