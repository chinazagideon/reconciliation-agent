// Source-agnostic normalisation (PRD §3.1.0). A FieldMapping tells the system
// WHERE to find each required field inside any JSON payload, so adding a new
// source is a config, not a code change. v1 ships hardcoded mappings for the
// three sources we support; the interactive UI mapper is deferred to v1.1.
import type { Source } from "../../domain/reconciliation/transaction.js";

export interface FieldMapping {
  readonly source: Source;
  readonly amountPath: string;        // JSONPath to amount in minor units: "$.amount"
  readonly currencyPath?: string;     // "$.currency"; omit if fixed
  readonly currencyFixed?: string;    // fallback fixed currency, e.g. "CAD"
  readonly datePath: string;          // "$.created" (unix secs) or "$.occurred_at" (ISO)
  readonly dateFormat: "unix_seconds" | "iso8601";
  readonly referencePath: string;     // "$.id" or "$.reference"
  /** Sign convention: some sources encode direction elsewhere; kept simple for v1. */
  readonly amountIsMinorUnits: true;  // documented invariant: never dollars
}

// Real Stripe Balance Transaction shape: amount is already integer cents,
// currency is lowercase ISO, created is a unix timestamp (seconds).
export const STRIPE_MAPPING: FieldMapping = {
  source: "stripe",
  amountPath: "$.amount",
  currencyPath: "$.currency",
  datePath: "$.created",
  dateFormat: "unix_seconds",
  referencePath: "$.id",
  amountIsMinorUnits: true,
};

// Our own double-entry ledger export shape (see seeder). amount_minor is cents.
export const LEDGER_MAPPING: FieldMapping = {
  source: "ledger",
  amountPath: "$.amount_minor",
  currencyPath: "$.currency",
  datePath: "$.posted_at",
  dateFormat: "iso8601",
  referencePath: "$.reference",
  amountIsMinorUnits: true,
};

export const MAPPINGS: Record<Exclude<Source, "csv">, FieldMapping> = {
  stripe: STRIPE_MAPPING,
  ledger: LEDGER_MAPPING,
  payout: LEDGER_MAPPING, // payout records share the ledger-style shape for v1
};
