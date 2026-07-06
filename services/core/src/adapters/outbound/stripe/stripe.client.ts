// Driven adapter: implements the RecordSource port for Stripe.
// Reconciliation lives in the corners of the Stripe API: Balance Transactions,
// payouts, fee details, dispute lifecycle. External calls belong OFF the request
// path (queue them — see infrastructure/queue.ts).
import type { RecordSource } from "../../../domain/reconciliation/ports.js";
import type { MatchCandidate } from "../../../domain/reconciliation/match.js";
import { type Result, ok } from "../../../domain/shared/result.js";

export class StripeRecordSource implements RecordSource {
  readonly name = "stripe";
  async fetch(windowStart: Date, windowEnd: Date): Promise<Result<MatchCandidate[]>> {
    // TODO: page Balance Transactions in [windowStart, windowEnd], map -> MatchCandidate.
    void windowStart; void windowEnd;
    return ok([]);
  }
}
