// A Match links records the deterministic core decided belong together.
import type { Money, CurrencyCode } from "../shared/branded.js";

export interface MatchCandidate {
  readonly transactionId: string;
  readonly amount: Money;
  readonly currency: CurrencyCode;
  readonly occurredAt: Date;
}

export interface Match {
  readonly left: MatchCandidate;   // e.g. a Stripe record
  readonly right: MatchCandidate;  // e.g. a ledger record
  readonly strategy: string;       // which matcher produced this (for audit)
}
