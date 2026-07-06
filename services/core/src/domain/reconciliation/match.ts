// A Match links records the deterministic core decided belong together.
import type { Money, CurrencyCode } from "../shared/branded.js";

export interface MatchCandidate {
  readonly transactionId: string;
  readonly amount: Money;
  readonly currency: CurrencyCode;
  readonly occurredAt: Date;
  /** True for aggregate records (Stripe payouts) that may be the SUM of many
   *  entries on the other side. Only these are eligible batch-aggregation
   *  targets — an ordinary charge is a 1:1 record, never a sum. */
  readonly isAggregate?: boolean;
}

export interface Match {
  readonly left: MatchCandidate;   // e.g. a Stripe record (or a batch payout)
  readonly right: MatchCandidate;  // e.g. a ledger record (primary member for batch)
  readonly strategy: string;       // which matcher produced this (for audit)
  /** For N-to-1 batch matches: transactionIds of ALL members on the many side. */
  readonly memberIds?: readonly string[];
}

/** A residue item the tolerant matcher refused to search combinatorially:
 *  its candidate set exceeded the safety cap (>10). Routed straight to a human
 *  fraud review, bypassing the AI sidecar (PRD §3.2.2). */
export interface FraudFlag {
  readonly candidate: MatchCandidate;
  readonly candidateCount: number;
}
