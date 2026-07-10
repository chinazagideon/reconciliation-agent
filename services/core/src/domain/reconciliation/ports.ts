// PORTS — the holes in the hexagon.
//
// The domain declares WHAT it needs (these interfaces). Adapters in the outer
// ring decide HOW (Postgres, Stripe, HTTP to the Python sidecar). The domain
// depends only on these abstractions (DIP), which is exactly what lets you unit
// test the core with in-memory fakes and zero infrastructure running.

import type { Result } from "../shared/result.js";
import type { RunStatus } from "./reconciliation-run.js";
import type { MatchCandidate, Match } from "./match.js";

/** A review-queue item the engine wants persisted (AI residue or fraud flag). */
export interface ReviewItemInput {
  readonly transactionId: string;
  readonly kind: "ai" | "fraud";
  readonly hypothesis?: string | null;
  readonly confidence?: number | null;
  readonly suggestedAction?: string | null;
  readonly needsHuman: boolean;
  readonly candidateCount?: number | null;
}

/** An append-only audit entry. Nothing here is ever updated or deleted. */
export interface AuditEntry {
  readonly actor: string;      // 'system:exact_matcher' | 'system:agent' | 'user:<id>'
  readonly event: string;      // 'match.created' | 'flag_fraud' | 'run.completed' ...
  readonly entityId?: string | null;
  readonly detail: unknown;    // JSON blob
}

/** Final per-run rollup written when the run finishes. */
export interface RunSummary {
  readonly status: RunStatus;
  readonly matchedCount: number;
  readonly unmatchedCount: number;
  readonly explainedCount: number;
  readonly reviewCount: number;
  readonly fraudCount: number;
  readonly aiSkipped: boolean;
  readonly partial: boolean;
}

/**
 * Persistence port for a reconciliation run and everything it produces. One
 * cohesive store (mirrors the single-DB, solo-operable constraint) rather than a
 * scatter of micro-repositories. Every write is idempotent at the adapter level.
 */
export interface ReconciliationRepository {
  createRun(windowStart: Date, windowEnd: Date): Promise<Result<{ id: string }>>;
  setStatus(runId: string, status: RunStatus): Promise<Result<void>>;
  saveMatches(runId: string, matches: Match[]): Promise<Result<void>>;
  saveReviewItems(runId: string, items: ReviewItemInput[]): Promise<Result<void>>;
  saveAgentRuns(runId: string, explanations: AgentExplanation[]): Promise<Result<void>>;
  finishRun(runId: string, summary: RunSummary): Promise<Result<void>>;
  appendAudit(entries: AuditEntry[]): Promise<Result<void>>;
}

/** A residue item enriched with the full record the sidecar needs to reason. */
export interface ResidueItem {
  readonly transactionId: string;
  readonly source: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly occurredAt: Date;
  readonly raw: unknown;
}

/** Outbound port to the AI reasoning sidecar. Suggestions only, never authority. */
export interface AgentPort {
  /** Cheap liveness check so the core can degrade gracefully if the sidecar is down. */
  health(): Promise<boolean>;
  explain(runId: string, unmatched: ResidueItem[]): Promise<Result<AgentExplanation[]>>;
}

export interface AgentExplanation {
  readonly transactionId: string;
  readonly hypothesis: string;
  readonly confidence: number;         // 0..1
  readonly suggestedAction: string;    // 'match_with:<id>' | 'flag_refund' | ...
  readonly needsHuman: boolean;
}
