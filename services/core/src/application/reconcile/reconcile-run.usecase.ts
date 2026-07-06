// ReconcileRun use case — orchestrates ONE run as a saga/state machine.
//
// Flow (deterministic core first, AI strictly at the boundary — ADR-0005):
//   1. create run, ingest external sources (Stripe) into transactions
//   2. read the two sides from the DB, fold matchers over the residue in order
//   3. persist matches; route fraud flags straight to human review (skip AI)
//   4. hand ONLY the final residue to the agent — and if it is down, degrade
//      gracefully (ADR-0006): finish `done` + `ai_skipped`, residue -> review
//   5. write audit entries at every step; finish with the per-run rollup
//
// Depends only on PORTS + the transaction repository, never concrete adapters.
import type {
  ReconciliationRepository,
  AgentPort,
  AuditEntry,
  ReviewItemInput,
} from "../../domain/reconciliation/ports.js";
import type { Matcher } from "./matchers/matcher.js";
import type { Match, MatchCandidate, FraudFlag } from "../../domain/reconciliation/match.js";
import type { Ingestor } from "../ingest/ingestor.js";
import type { PgTransactionRepository } from "../../adapters/outbound/postgres/transaction.repository.js";
import { type Result, ok, err } from "../../domain/shared/result.js";

export interface ReconcileOptions {
  readonly leftSources: string[];   // e.g. ["stripe"]
  readonly rightSources: string[];  // e.g. ["ledger", "payout"]
  readonly aiConfidenceThreshold: number;
}

const matchedTxnCount = (m: Match): number => (m.memberIds ? 1 + m.memberIds.length : 2);

export class ReconcileRunUseCase {
  constructor(
    private readonly ingestors: Ingestor[],
    private readonly txns: PgTransactionRepository,
    private readonly matchers: Matcher[], // ordered: cheapest/strictest first
    private readonly repo: ReconciliationRepository,
    private readonly agent: AgentPort,
    private readonly opts: ReconcileOptions,
  ) {}

  async execute(windowStart: Date, windowEnd: Date): Promise<Result<{ runId: string }>> {
    const created = await this.repo.createRun(windowStart, windowEnd);
    if (!created.ok) return err(created.error);
    const runId = created.value.id;
    const audit: AuditEntry[] = [
      { actor: "system", event: "run.started", entityId: runId, detail: { windowStart, windowEnd } },
    ];

    try {
      // 1. Ingest external sources into the transactions table (idempotent).
      await this.repo.setStatus(runId, "matching");
      for (const ing of this.ingestors) {
        const pulled = await ing.ingest(windowStart, windowEnd);
        // A source being unavailable must not kill the run — reconcile on the
        // data we already have (ADR-0006 spirit). Record it and move on.
        if (!pulled.ok) {
          audit.push({ actor: `system:${ing.source}`, event: "ingest.failed", entityId: runId,
            detail: { source: ing.source, error: pulled.error.message } });
          continue;
        }
        const wrote = await this.txns.insertMany(pulled.value);
        if (!wrote.ok) return await this.fail(runId, audit, wrote.error);
        audit.push({ actor: `system:${ing.source}`, event: "ingested", entityId: runId,
          detail: { source: ing.source, pulled: pulled.value.length, inserted: wrote.value.inserted } });
      }

      // 2. Read the two sides from the DB.
      const leftRes = await this.txns.findBySource(this.opts.leftSources, windowStart, windowEnd);
      if (!leftRes.ok) return await this.fail(runId, audit, leftRes.error);
      const rightRes = await this.txns.findBySource(this.opts.rightSources, windowStart, windowEnd);
      if (!rightRes.ok) return await this.fail(runId, audit, rightRes.error);

      // 3. Fold matchers over the residue, in order. Each sees only the leftovers.
      let left: MatchCandidate[] = leftRes.value;
      let right: MatchCandidate[] = rightRes.value;
      const allMatches: Match[] = [];
      const fraud: FraudFlag[] = [];
      for (const matcher of this.matchers) {
        const r = matcher.match(left, right);
        if (r.matches.length > 0) {
          const saved = await this.repo.saveMatches(runId, r.matches);
          if (!saved.ok) return await this.fail(runId, audit, saved.error);
          allMatches.push(...r.matches);
          audit.push({ actor: `system:${matcher.name}_matcher`, event: "match.created",
            entityId: runId, detail: { strategy: matcher.name, count: r.matches.length } });
        }
        if (r.fraudFlags?.length) fraud.push(...r.fraudFlags);
        left = r.leftResidue;
        right = r.rightResidue;
      }

      // Fraud flags -> human review, bypassing the AI sidecar entirely.
      const fraudItems: ReviewItemInput[] = fraud.map((f) => ({
        transactionId: f.candidate.transactionId,
        kind: "fraud",
        needsHuman: true,
        suggestedAction: "flag_fraud",
        candidateCount: f.candidateCount,
      }));
      if (fraudItems.length) {
        const saved = await this.repo.saveReviewItems(runId, fraudItems);
        if (!saved.ok) return await this.fail(runId, audit, saved.error);
        audit.push({ actor: "system:tolerant_matcher", event: "flag_fraud", entityId: runId,
          detail: { count: fraudItems.length } });
      }

      // 4. The final residue (both sides) is all the AI ever sees.
      const residue: MatchCandidate[] = [...left, ...right];
      await this.repo.setStatus(runId, "explaining");

      let explainedCount = 0;
      let reviewCount = 0;
      let aiSkipped = false;

      if (residue.length === 0) {
        // nothing to explain
      } else if (!(await this.agent.health())) {
        // ADR-0006: sidecar down -> degrade. Route ALL residue to human review.
        aiSkipped = true;
        const items: ReviewItemInput[] = residue.map((c) => ({
          transactionId: c.transactionId,
          kind: "ai",
          needsHuman: true,
          hypothesis: "AI explanation unavailable — routed for manual review.",
        }));
        const saved = await this.repo.saveReviewItems(runId, items);
        if (!saved.ok) return await this.fail(runId, audit, saved.error);
        reviewCount = items.length;
        audit.push({ actor: "system", event: "ai.skipped", entityId: runId,
          detail: { residue: residue.length, reason: "sidecar unhealthy" } });
      } else {
        // Enrich residue with full records (source + raw payload) so the sidecar
        // has real data to reason over, not just amount/date.
        const full = await this.txns.findByIds(residue.map((c) => c.transactionId));
        if (!full.ok) return await this.fail(runId, audit, full.error);
        const residueItems = full.value.map((t) => ({
          transactionId: t.transactionId,
          source: t.source,
          amountMinor: t.amount as number,
          currency: t.currency as string,
          occurredAt: t.occurredAt,
          raw: t.raw,
        }));
        const explained = await this.agent.explain(runId, residueItems);
        if (!explained.ok) return await this.fail(runId, audit, explained.error);
        await this.repo.saveAgentRuns(runId, explained.value);
        const byId = new Map(explained.value.map((e) => [e.transactionId, e]));
        const items: ReviewItemInput[] = residue.map((c) => {
          const e = byId.get(c.transactionId);
          const needsHuman = e ? e.needsHuman : true;
          if (needsHuman) reviewCount++; else explainedCount++;
          return {
            transactionId: c.transactionId,
            kind: "ai",
            hypothesis: e?.hypothesis ?? null,
            confidence: e?.confidence ?? null,
            suggestedAction: e?.suggestedAction ?? null,
            needsHuman,
          };
        });
        const saved = await this.repo.saveReviewItems(runId, items);
        if (!saved.ok) return await this.fail(runId, audit, saved.error);
        audit.push({ actor: "system:agent", event: "explained", entityId: runId,
          detail: { count: items.length, explained: explainedCount, review: reviewCount } });
      }

      // 5. Finish with the per-run rollup.
      const matchedCount = allMatches.reduce((n, m) => n + matchedTxnCount(m), 0);
      audit.push({ actor: "system", event: "run.completed", entityId: runId,
        detail: { matchedCount, residue: residue.length, fraud: fraudItems.length, aiSkipped } });
      await this.repo.finishRun(runId, {
        status: "done",
        matchedCount,
        unmatchedCount: residue.length,
        explainedCount,
        reviewCount,
        fraudCount: fraudItems.length,
        aiSkipped,
        partial: aiSkipped,
      });
      await this.repo.appendAudit(audit);
      return ok({ runId });
    } catch (e) {
      return await this.fail(runId, audit, e instanceof Error ? e : new Error(String(e)));
    }
  }

  private async fail(runId: string, audit: AuditEntry[], error: Error): Promise<Result<{ runId: string }>> {
    audit.push({ actor: "system", event: "run.failed", entityId: runId, detail: { error: error.message } });
    await this.repo.setStatus(runId, "failed");
    await this.repo.appendAudit(audit);
    return err(error);
  }
}
