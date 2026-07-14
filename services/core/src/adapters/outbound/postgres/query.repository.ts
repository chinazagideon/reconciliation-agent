// Read-side + review-mutation adapter. Powers the API surface the (deferred)
// frontend will consume: dashboard rollups, run detail tabs, transaction detail
// with a derived lifecycle, the global audit log, and the three review actions.
// Reads are parameterised SELECTs; review mutations are the ONLY human-driven
// writes and each is paired with an append-only audit entry by the caller.
import { type Result, ok, err } from "../../../domain/shared/result.js";
import { pool } from "./pool.js";

export interface RunRow {
  id: string;
  window_start: string;
  window_end: string;
  status: string;
  matched_count: number;
  unmatched_count: number;
  explained_count: number;
  review_count: number;
  fraud_count: number;
  ai_skipped: boolean;
  partial: boolean;
  created_at: string;
}

/** One page of rows plus the unpaged total, so the API can report `total`
 *  honestly instead of echoing back the size of the slice it just fetched. */
export interface Paged<T> {
  rows: T[];
  total: number;
}

export class PgQueryRepository {
  async listRuns(limit = 50, offset = 0): Promise<Result<Paged<RunRow>>> {
    try {
      const [page, count] = await Promise.all([
        pool.query(
          `SELECT id, window_start, window_end, status, matched_count, unmatched_count,
                  explained_count, review_count, fraud_count, ai_skipped, partial, created_at
             FROM reconciliation.reconciliations
            ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset],
        ),
        pool.query(`SELECT COUNT(*)::int AS total FROM reconciliation.reconciliations`),
      ]);
      return ok({
        rows: page.rows as RunRow[],
        total: (count.rows[0]?.total as number) ?? 0,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getRun(id: string): Promise<Result<RunRow | null>> {
    try {
      const { rows } = await pool.query(
        `SELECT id, window_start, window_end, status, matched_count, unmatched_count,
                explained_count, review_count, fraud_count, ai_skipped, partial, created_at
           FROM reconciliation.reconciliations WHERE id = $1`,
        [id],
      );
      return ok((rows[0] as RunRow) ?? null);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /** Matches for a run, biggest first (that is where mistakes cost the most). */
  async listMatches(runId: string): Promise<Result<unknown[]>> {
    try {
      const { rows } = await pool.query(
        `SELECT m.id, m.strategy, m.detail,
                l.id AS left_id, l.source AS left_source, l.external_id AS left_ref,
                l.amount_minor AS left_amount, l.currency AS left_currency, l.occurred_at AS left_at,
                r.id AS right_id, r.source AS right_source, r.external_id AS right_ref,
                r.amount_minor AS right_amount, r.currency AS right_currency, r.occurred_at AS right_at
           FROM reconciliation.matches m
           JOIN reconciliation.transactions l ON l.id = m.left_txn_id
           JOIN reconciliation.transactions r ON r.id = m.right_txn_id
          WHERE m.reconciliation_id = $1
          ORDER BY GREATEST(ABS(l.amount_minor), ABS(r.amount_minor)) DESC`,
        [runId],
      );
      return ok(rows);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /** Review items for a run, optionally filtered to a tab (kind / open state). */
  async listReviewItems(
    runId: string,
    opts: {
      kind?: "ai" | "fraud"; onlyOpen?: boolean;
      explainedOnly?: boolean; needsHumanOnly?: boolean;
    } = {},
  ): Promise<Result<unknown[]>> {
    const clauses = ["ri.reconciliation_id = $1"];
    const params: unknown[] = [runId];
    if (opts.kind) { params.push(opts.kind); clauses.push(`ri.kind = $${params.length}`); }
    if (opts.onlyOpen) clauses.push("ri.resolution IS NULL");
    if (opts.explainedOnly) clauses.push("ri.needs_human = false");
    if (opts.needsHumanOnly) clauses.push("ri.needs_human = true");
    try {
      const { rows } = await pool.query(
        `SELECT ri.id, ri.kind, ri.hypothesis, ri.confidence, ri.suggested_action,
                ri.needs_human, ri.candidate_count, ri.resolution, ri.resolution_note,
                t.id AS txn_id, t.source, t.external_id, t.amount_minor, t.currency, t.occurred_at
           FROM reconciliation.review_items ri
           JOIN reconciliation.transactions t ON t.id = ri.transaction_id
          WHERE ${clauses.join(" AND ")}
          ORDER BY ri.confidence ASC NULLS FIRST`,
        params,
      );
      return ok(rows);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /** Full transaction detail: the record, its match + counterpart, review item,
   *  and a lifecycle derived from those tables (PRD §4.2 page 5 / F12). */
  async getTransactionDetail(id: string): Promise<Result<unknown | null>> {
    try {
      const txnRes = await pool.query(
        `SELECT id, source, external_id, amount_minor, currency, occurred_at, raw, created_at
           FROM reconciliation.transactions WHERE id = $1`,
        [id],
      );
      if (txnRes.rows.length === 0) return ok(null);
      const txn = txnRes.rows[0];

      const matchRes = await pool.query(
        `SELECT m.id, m.strategy, m.detail, m.created_at,
                CASE WHEN m.left_txn_id = $1 THEN m.right_txn_id ELSE m.left_txn_id END AS other_id
           FROM reconciliation.matches m
          WHERE m.left_txn_id = $1 OR m.right_txn_id = $1
          LIMIT 1`,
        [id],
      );
      const match = matchRes.rows[0] ?? null;
      let counterpart = null;
      if (match) {
        const c = await pool.query(
          `SELECT id, source, external_id, amount_minor, currency, occurred_at
             FROM reconciliation.transactions WHERE id = $1`,
          [match.other_id],
        );
        counterpart = c.rows[0] ?? null;
      }

      const reviewRes = await pool.query(
        `SELECT kind, hypothesis, confidence, suggested_action, needs_human,
                candidate_count, resolution, resolution_note, resolved_by, resolved_at, created_at
           FROM reconciliation.review_items WHERE transaction_id = $1 LIMIT 1`,
        [id],
      );
      const review = reviewRes.rows[0] ?? null;

      // Derive the lifecycle from the data (no per-txn audit rows needed).
      const lifecycle: { at: string; actor: string; event: string }[] = [
        { at: txn.created_at, actor: `system:${txn.source}`, event: "ingested" },
      ];
      if (match) {
        lifecycle.push({ at: match.created_at, actor: `system:${match.strategy.split(":")[0]}`,
          event: `matched (${match.strategy})` });
      }
      if (review) {
        if (review.kind === "fraud") {
          lifecycle.push({ at: review.created_at, actor: "system:tolerant_matcher",
            event: `flagged fraud (${review.candidate_count} candidates)` });
        } else {
          lifecycle.push({ at: review.created_at, actor: "system:agent",
            event: `explained (conf ${review.confidence ?? "n/a"})` });
        }
        if (review.resolution) {
          lifecycle.push({ at: review.resolved_at, actor: review.resolved_by ?? "user",
            event: `review ${review.resolution}` });
        }
      }
      lifecycle.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

      return ok({ transaction: txn, match, counterpart, review, lifecycle });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async listAudit(
    opts: {
      event?: string | undefined; actor?: string | undefined;
      since?: Date | undefined; until?: Date | undefined;
      limit?: number | undefined; offset?: number | undefined;
    } = {},
  ): Promise<Result<Paged<unknown>>> {
    const clauses: string[] = [];
    const filters: unknown[] = [];
    if (opts.event) { filters.push(opts.event); clauses.push(`event = $${filters.length}`); }
    if (opts.actor) { filters.push(opts.actor); clauses.push(`actor = $${filters.length}`); }
    if (opts.since) { filters.push(opts.since); clauses.push(`at >= $${filters.length}`); }
    if (opts.until) { filters.push(opts.until); clauses.push(`at < $${filters.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    // The count must apply the same filters as the page, or paging through a
    // filtered log walks off the end of a total it never had.
    const paged = [...filters, opts.limit ?? 50, opts.offset ?? 0];
    try {
      const [page, count] = await Promise.all([
        pool.query(
          `SELECT id, at, actor, event, entity_id, detail FROM audit.audit_log
           ${where} ORDER BY id DESC LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
          paged,
        ),
        pool.query(`SELECT COUNT(*)::int AS total FROM audit.audit_log ${where}`, filters),
      ]);
      return ok({
        rows: page.rows,
        total: (count.rows[0]?.total as number) ?? 0,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  // --- Review mutations (the only human-driven writes) ---

  async getReviewItem(id: string): Promise<Result<{
    id: string; reconciliation_id: string; transaction_id: string;
    suggested_action: string | null; resolution: string | null;
  } | null>> {
    try {
      const { rows } = await pool.query(
        `SELECT id, reconciliation_id, transaction_id, suggested_action, resolution
           FROM reconciliation.review_items WHERE id = $1`,
        [id],
      );
      return ok(rows[0] ?? null);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async resolveReviewItem(
    id: string, resolution: string, note: string | null, actor: string,
  ): Promise<Result<void>> {
    try {
      await pool.query(
        `UPDATE reconciliation.review_items
            SET resolution = $2, resolution_note = $3, resolved_by = $4, resolved_at = now()
          WHERE id = $1 AND resolution IS NULL`,
        [id, resolution, note, actor],
      );
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /** Promote an AI/human decision to a match (strategy = human_approved). */
  async createHumanMatch(
    runId: string, leftTxnId: string, rightTxnId: string,
  ): Promise<Result<void>> {
    try {
      await pool.query(
        `INSERT INTO reconciliation.matches
           (reconciliation_id, left_txn_id, right_txn_id, strategy, detail, idempotency_key)
         VALUES ($1,$2,$3,'human_approved','{}'::jsonb,$4)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [runId, leftTxnId, rightTxnId, `${runId}:human_approved:${leftTxnId}:${rightTxnId}`],
      );
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
