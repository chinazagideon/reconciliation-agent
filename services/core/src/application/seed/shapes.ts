// Raw payload builders for the synthetic seeder. These emit the REAL wire shapes
// each source uses, so ingestion is exercised with production-shaped data, not
// toy objects (PRD §3.1.4). The seeder normalises these through the same
// FieldMapping the live adapters use.

import { stripeFeeMinor } from "../../domain/shared/fees.js";

// Deterministic PRNG (mulberry32) so a seed run is reproducible: same input ->
// same manifest. Financial demos should be repeatable.
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HEX = "0123456789abcdefghijklmnopqrstuvwxyz";
export function token(prefix: string, rand: () => number, len = 24): string {
  let s = "";
  for (let i = 0; i < len; i++) s += HEX[Math.floor(rand() * HEX.length)];
  return `${prefix}${s}`;
}

// Window: fixed 14-day span, business-hours timestamps (no 3am records).
export const WINDOW_START = new Date(Date.UTC(2026, 5, 16, 0, 0, 0)); // Jun 16 2026
export const WINDOW_END = new Date(Date.UTC(2026, 5, 30, 23, 59, 59)); // Jun 30 2026

/** A timestamp on `dayOffset` days into the window, during business hours. */
export function businessTime(dayOffset: number, rand: () => number): Date {
  const d = new Date(WINDOW_START);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(13 + Math.floor(rand() * 8)); // 13:00–20:00 UTC ~ business hours
  d.setUTCMinutes(Math.floor(rand() * 60));
  d.setUTCSeconds(Math.floor(rand() * 60));
  return d;
}

/** Realistic move-marketplace amount in cents: $50–$2500, weighted $150–$500. */
export function amountCents(rand: () => number): number {
  const weighted = rand() < 0.7;
  const dollars = weighted ? 150 + rand() * 350 : 50 + rand() * 2450;
  return Math.floor(dollars * 100 + 0.5); // integer cents; float-free rounding (N2)
}

/** Stripe's real fee: 2.9% + $0.30, in integer cents (shared with the matcher). */
export function stripeFeeCents(amount: number): number {
  return stripeFeeMinor(amount);
}

// --- Raw Stripe Balance Transaction (matches the shape in PRD §3.1.4) ---
export function stripeBalanceTxn(opts: {
  rand: () => number;
  amount: number;
  created: Date;
  type?: string;
  reportingCategory?: string;
  paymentIntent?: string;
  description?: string;
}): Record<string, unknown> {
  const { rand, amount, created } = opts;
  const fee = opts.type === "payout" || amount < 0 ? 0 : stripeFeeCents(amount);
  const source = opts.paymentIntent ?? token("ch_", rand);
  return {
    id: token("txn_", rand),
    object: "balance_transaction",
    amount,
    currency: "cad",
    created: Math.floor(created.getTime() / 1000),
    available_on: Math.floor(created.getTime() / 1000) + 86400,
    description: opts.description ?? "Payment for move booking",
    fee,
    fee_details: fee
      ? [{ amount: fee, currency: "cad", description: "Stripe processing fees", type: "stripe_fee" }]
      : [],
    net: amount - fee,
    reporting_category: opts.reportingCategory ?? "charge",
    source,
    status: "available",
    type: opts.type ?? "charge",
  };
}

// --- Raw internal ledger entry (double-entry-ish, amount in minor units) ---
let ledgerSeq = 0;
export function ledgerEntry(opts: {
  rand: () => number;
  amountMinor: number;
  postedAt: Date;
  reference?: string;
}): Record<string, unknown> {
  const { postedAt } = opts;
  const y = postedAt.getUTCFullYear();
  const m = String(postedAt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(postedAt.getUTCDate()).padStart(2, "0");
  const ref = opts.reference ?? `LED-${y}${m}${d}-${String(++ledgerSeq).padStart(3, "0")}`;
  return {
    reference: ref,
    amount_minor: opts.amountMinor,
    currency: "CAD",
    posted_at: postedAt.toISOString(),
    side: opts.amountMinor >= 0 ? "credit" : "debit",
    account: "marketplace:receivable",
  };
}

export function resetLedgerSeq(): void {
  ledgerSeq = 0;
}
