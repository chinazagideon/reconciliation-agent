// Ingestion port. An Ingestor pulls raw records from an EXTERNAL system (the
// Stripe API today), normalises them into Transactions, and hands them back for
// the use case to upsert idempotently. This is distinct from match-time reads:
// the ledger already lives in our DB, so it needs no ingestor — only external
// sources do. Keeping this port small (ISP) means a new connector is one class.
import type { Transaction } from "../../domain/reconciliation/transaction.js";
import type { Result } from "../../domain/shared/result.js";

export interface Ingestor {
  readonly source: string; // "stripe"
  ingest(windowStart: Date, windowEnd: Date): Promise<Result<Transaction[]>>;
}
