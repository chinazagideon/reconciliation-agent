// Driven adapter: Stripe ingestion connector (F13). Pages Balance Transactions
// — NOT charges — because balance transactions include fees, payouts, refunds
// and adjustments as first-class entries, which is exactly what reconciliation
// needs. Each raw entry is normalised through the SAME STRIPE_MAPPING the seeder
// uses, then upserted by the use case (idempotent on external_id).
//
// External calls belong off the request path (Phase 5 queues the run). If no
// API key is configured, ingest is a no-op: the seeded demo data already lives
// in `transactions`, so a run still proceeds on deterministic data.
import Stripe from "stripe";
import type { Ingestor } from "../../../application/ingest/ingestor.js";
import type { Transaction } from "../../../domain/reconciliation/transaction.js";
import { normalise } from "../../../application/ingest/normalise.js";
import { STRIPE_MAPPING } from "../../../application/ingest/field-mapping.js";
import { type Result, ok, err } from "../../../domain/shared/result.js";

export class StripeConnector implements Ingestor {
  readonly source = "stripe";
  private readonly client: Stripe | null;

  constructor(apiKey: string | undefined) {
    // Only go live for a real-looking key; placeholders like "sk_test_xxx" from
    // .env.example are treated as "no live key" so the seeded demo still runs.
    const live = apiKey && /^sk_(test|live)_[A-Za-z0-9]{16,}$/.test(apiKey);
    this.client = live ? new Stripe(apiKey!) : null;
  }

  async ingest(windowStart: Date, windowEnd: Date): Promise<Result<Transaction[]>> {
    if (!this.client) return ok([]); // no live key -> rely on seeded/other data
    const out: Transaction[] = [];
    try {
      // Stripe auto-pagination pages through the whole window for us.
      const params: Stripe.BalanceTransactionListParams = {
        created: {
          gte: Math.floor(windowStart.getTime() / 1000),
          lt: Math.floor(windowEnd.getTime() / 1000),
        },
        limit: 100,
      };
      for await (const bt of this.client.balanceTransactions.list(params)) {
        const n = normalise(bt as unknown, STRIPE_MAPPING);
        if (!n.ok) return err(new Error(`stripe normalise failed for ${bt.id}: ${n.error.message}`));
        out.push(n.value);
      }
      return ok(out);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
