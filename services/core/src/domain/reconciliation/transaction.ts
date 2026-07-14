// The normalised, source-agnostic money record (PRD §2). Every adapter — Stripe,
// ledger, CSV, seeder — produces THIS shape, regardless of the wire format it
// started from. Money is always integer minor units via the `Money` brand.
import type { Money, CurrencyCode } from "../shared/branded.js";

export type Source = "stripe" | "ledger" | "payout" | "csv";

export interface Transaction {
  readonly source: Source;
  readonly externalId: string;      // id in the originating system
  readonly amount: Money;           // integer minor units (cents)
  readonly currency: CurrencyCode;  // ISO 4217
  readonly occurredAt: Date;
  readonly raw: unknown;            // untouched original payload (stored as JSONB)
}
