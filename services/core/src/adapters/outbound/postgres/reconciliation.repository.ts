// Driven adapter implementing the ReconciliationRepository PORT with Postgres.
// Data access ONLY — no business logic. Parameterised queries throughout (no
// string interpolation into SQL). Every write is idempotent: matches and review
// items carry a deterministic idempotency_key and use ON CONFLICT DO NOTHING, so
// re-running a run (e.g. a queue retry) never double-writes.
import type {
  ReconciliationRepository,
  ReviewItemInput,
  AuditEntry,
  RunSummary,
  AgentExplanation,
} from "../../../domain/reconciliation/ports.js";
import type { RunStatus } from "../../../domain/reconciliation/reconciliation-run.js";
import type { Match } from "../../../domain/reconciliation/match.js";
import { type Result, ok, err } from "../../../domain/shared/result.js";
import { pool } from "./pool.js";

const matchKey = (runId: string, m: Match): string =>
  `${runId}:${m.strategy}:${m.left.transactionId}:${m.right.transactionId}`;

const reviewKey = (runId: string, i: ReviewItemInput): string =>
  `${runId}:${i.kind}:${i.transactionId}`;

export class PgReconciliationRepository implements ReconciliationRepository {
  async createRun(windowStart: Date, windowEnd: Date): Promise<Result<{ id: string }>> {
    try {
      const { rows } = await pool.query(
        `INSERT INTO reconciliation.reconciliations (window_start, window_end, status)
         VALUES ($1, $2, 'pending') RETURNING id`,
        [windowStart, windowEnd],
      );
      return ok({ id: rows[0].id as string });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async setStatus(runId: string, status: RunStatus): Promise<Result<void>> {
    try {
      await pool.query(
        `UPDATE reconciliation.reconciliations SET status = $2, updated_at = now() WHERE id = $1`,
        [runId, status],
      );
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async saveMatches(runId: string, matches: Match[]): Promise<Result<void>> {
    if (matches.length === 0) return ok(undefined);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const m of matches) {
        const detail = m.memberIds ? { members: m.memberIds } : {};
        await client.query(
          `INSERT INTO reconciliation.matches
             (reconciliation_id, left_txn_id, right_txn_id, strategy, detail, idempotency_key)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [runId, m.left.transactionId, m.right.transactionId, m.strategy, JSON.stringify(detail), matchKey(runId, m)],
        );
      }
      await client.query("COMMIT");
      return ok(undefined);
    } catch (e) {
      await client.query("ROLLBACK");
      return err(e instanceof Error ? e : new Error(String(e)));
    } finally {
      client.release();
    }
  }

  async saveReviewItems(runId: string, items: ReviewItemInput[]): Promise<Result<void>> {
    if (items.length === 0) return ok(undefined);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const i of items) {
        await client.query(
          `INSERT INTO reconciliation.review_items
             (reconciliation_id, transaction_id, kind, hypothesis, confidence,
              suggested_action, needs_human, candidate_count, idempotency_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [runId, i.transactionId, i.kind, i.hypothesis ?? null, i.confidence ?? null,
           i.suggestedAction ?? null, i.needsHuman, i.candidateCount ?? null, reviewKey(runId, i)],
        );
      }
      await client.query("COMMIT");
      return ok(undefined);
    } catch (e) {
      await client.query("ROLLBACK");
      return err(e instanceof Error ? e : new Error(String(e)));
    } finally {
      client.release();
    }
  }

  async saveAgentRuns(runId: string, explanations: AgentExplanation[]): Promise<Result<void>> {
    if (explanations.length === 0) return ok(undefined);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const e of explanations) {
        await client.query(
          `INSERT INTO reconciliation.agent_runs
             (reconciliation_id, transaction_id, hypothesis, confidence, suggested_action, needs_human)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [runId, e.transactionId, e.hypothesis, e.confidence, e.suggestedAction, e.needsHuman],
        );
      }
      await client.query("COMMIT");
      return ok(undefined);
    } catch (e) {
      await client.query("ROLLBACK");
      return err(e instanceof Error ? e : new Error(String(e)));
    } finally {
      client.release();
    }
  }

  async finishRun(runId: string, s: RunSummary): Promise<Result<void>> {
    try {
      await pool.query(
        `UPDATE reconciliation.reconciliations
            SET status = $2, matched_count = $3, unmatched_count = $4,
                explained_count = $5, review_count = $6, fraud_count = $7,
                ai_skipped = $8, partial = $9, updated_at = now()
          WHERE id = $1`,
        [runId, s.status, s.matchedCount, s.unmatchedCount, s.explainedCount,
         s.reviewCount, s.fraudCount, s.aiSkipped, s.partial],
      );
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async appendAudit(entries: AuditEntry[]): Promise<Result<void>> {
    if (entries.length === 0) return ok(undefined);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const a of entries) {
        await client.query(
          `INSERT INTO audit.audit_log (actor, event, entity_id, detail)
           VALUES ($1,$2,$3,$4)`,
          [a.actor, a.event, a.entityId ?? null, JSON.stringify(a.detail ?? {})],
        );
      }
      await client.query("COMMIT");
      return ok(undefined);
    } catch (e) {
      await client.query("ROLLBACK");
      return err(e instanceof Error ? e : new Error(String(e)));
    } finally {
      client.release();
    }
  }
}
