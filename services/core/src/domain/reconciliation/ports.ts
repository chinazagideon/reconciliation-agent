// PORTS — the holes in the hexagon.
//
// The domain declares WHAT it needs (these interfaces). Adapters in the outer
// ring decide HOW (Postgres, Stripe, HTTP to the Python sidecar). The domain
// depends only on these abstractions (DIP), which is exactly what lets you unit
// test the core with in-memory fakes and zero infrastructure running.

import type { Result } from "../shared/result.js";
import type { ReconciliationRun } from "./reconciliation-run.js";
import type { MatchCandidate } from "./match.js";

/** Persistence port for runs. Implemented by adapters/outbound/postgres. */
export interface ReconciliationRepository {
  save(run: ReconciliationRun): Promise<Result<void>>;
  findById(id: string): Promise<Result<ReconciliationRun | null>>;
}

/** A source of records to reconcile (Stripe, ledger, payouts). ISP: kept small. */
export interface RecordSource {
  readonly name: string; // "stripe" | "ledger" | "payout"
  fetch(windowStart: Date, windowEnd: Date): Promise<Result<MatchCandidate[]>>;
}

/** Outbound port to the AI reasoning sidecar. Suggestions only, never authority. */
export interface AgentPort {
  explain(unmatched: MatchCandidate[]): Promise<Result<AgentExplanation[]>>;
}

export interface AgentExplanation {
  readonly transactionId: string;
  readonly hypothesis: string;
  readonly confidence: number;     // 0..1
  readonly needsHuman: boolean;
}
