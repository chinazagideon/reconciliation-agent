// Synthetic data seeder (PRD §3.1.4). The "answer key": generate records with
// KNOWN discrepancy patterns, record the expected outcome per pattern in
// seed-manifest.json, then run the engine and compare. Without the answer key a
// demo is "trust me"; with it, it's "here's proof".
//
// Idempotent: clears prior synthetic ('stripe'/'ledger') rows before inserting,
// so POST /seed twice yields the same count (F2). Uses a fixed PRNG seed so the
// generated data — and thus the manifest — is reproducible.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { PgTransactionRepository } from "../../adapters/outbound/postgres/transaction.repository.js";
import type { Transaction } from "../../domain/reconciliation/transaction.js";
import { normalise } from "../ingest/normalise.js";
import { STRIPE_MAPPING, LEDGER_MAPPING } from "../ingest/field-mapping.js";
import { type Result, ok, err } from "../../domain/shared/result.js";
import {
  rng, token, businessTime, amountCents, stripeFeeCents,
  stripeBalanceTxn, ledgerEntry, resetLedgerSeq,
  WINDOW_START, WINDOW_END,
} from "./shapes.js";

// Default distribution (pairs/groups). Roughly the PRD table; the manifest
// reports ACTUAL generated counts and the outcome each pattern is designed for.
const PLAN = {
  exactPairs: 60,     // -> 120 txns, exact match
  timingPairs: 10,    // -> 20 txns, tolerant:timing (+1 day)
  feePairs: 8,        // -> 16 txns, tolerant:fee (Stripe 2.9%+$0.30)
  roundingPairs: 2,   // -> 4 txns, tolerant:fee (±1-2 cents)
  batchGroups: 2,     // -> each 1 stripe payout + 3 ledger, tolerant:batch
  partialPairs: 5,    // -> 10 txns, AI (partial capture)
  missingStripe: 10,  // -> 10 txns, AI (failed webhook)
  refundStripe: 8,    // -> 8 txns, AI (unprocessed refund)
  fraudGroups: 2,     // -> each 1 stripe payout + 12 ledger, batch-cap fraud flag
  fraudFan: 12,
} as const;

interface PatternManifest {
  pattern: string;
  count: number;
  expected_outcome: string;
  records: unknown[];
}

export interface SeedManifest {
  generated_at: string;
  window: { start: string; end: string };
  total_records: number;
  patterns: PatternManifest[];
  expected_results: {
    exact_matches: number;
    tolerant_matches: number;
    ai_explained: number;
    fraud_flagged: number;
    total_matched_pct: string;
  };
}

export class Seeder {
  constructor(private readonly txns: PgTransactionRepository) {}

  async run(seed = 20260616): Promise<Result<SeedManifest>> {
    resetLedgerSeq();
    const rand = rng(seed);
    const stripeRaw: Record<string, unknown>[] = [];
    const ledgerRaw: Record<string, unknown>[] = [];
    const patterns: PatternManifest[] = [];
    // running outcome tallies, in transactions
    let exact = 0, tolerant = 0, ai = 0, fraud = 0;

    const day = () => Math.floor(rand() * 14);

    // 1. Exact: same amount, currency, same day on both sides.
    {
      const recs: unknown[] = [];
      for (let i = 0; i < PLAN.exactPairs; i++) {
        const amt = amountCents(rand), d = day(), when = businessTime(d, rand);
        const pi = token("pi_", rand);
        const s = stripeBalanceTxn({ rand, amount: amt, created: when, paymentIntent: pi });
        const l = ledgerEntry({ rand, amountMinor: amt, postedAt: when });
        stripeRaw.push(s); ledgerRaw.push(l);
        recs.push({ stripe_id: s.id, ledger_id: l.reference, amount_minor: amt, currency: "CAD" });
      }
      exact += PLAN.exactPairs * 2;
      patterns.push({ pattern: "exact_match", count: PLAN.exactPairs * 2, expected_outcome: "exact", records: recs.slice(0, 3) });
    }

    // 2. Timing: same amount, ledger one day later.
    {
      for (let i = 0; i < PLAN.timingPairs; i++) {
        const amt = amountCents(rand), d = day(), when = businessTime(d, rand);
        const later = businessTime(Math.min(d + 1, 13), rand);
        stripeRaw.push(stripeBalanceTxn({ rand, amount: amt, created: when }));
        ledgerRaw.push(ledgerEntry({ rand, amountMinor: amt, postedAt: later }));
      }
      tolerant += PLAN.timingPairs * 2;
      patterns.push({ pattern: "timing_mismatch", count: PLAN.timingPairs * 2, expected_outcome: "tolerant:timing", records: [] });
    }

    // 3. Fee: ledger has gross, stripe net = gross - (2.9% + $0.30).
    {
      for (let i = 0; i < PLAN.feePairs; i++) {
        const gross = amountCents(rand), d = day(), when = businessTime(d, rand);
        const net = gross - stripeFeeCents(gross);
        stripeRaw.push(stripeBalanceTxn({ rand, amount: net, created: when }));
        ledgerRaw.push(ledgerEntry({ rand, amountMinor: gross, postedAt: when }));
      }
      tolerant += PLAN.feePairs * 2;
      patterns.push({ pattern: "fee_discrepancy", count: PLAN.feePairs * 2, expected_outcome: "tolerant:fee", records: [] });
    }

    // 4. Rounding: amounts differ by 1–2 cents (within fee tolerance).
    {
      for (let i = 0; i < PLAN.roundingPairs; i++) {
        const amt = amountCents(rand), d = day(), when = businessTime(d, rand);
        const off = 1 + Math.floor(rand() * 2);
        stripeRaw.push(stripeBalanceTxn({ rand, amount: amt, created: when }));
        ledgerRaw.push(ledgerEntry({ rand, amountMinor: amt + off, postedAt: when }));
      }
      tolerant += PLAN.roundingPairs * 2;
      patterns.push({ pattern: "rounding", count: PLAN.roundingPairs * 2, expected_outcome: "tolerant:fee", records: [] });
    }

    // 5. Batch: one stripe payout = sum of N ledger entries same day.
    // Batch and fraud groups get DEDICATED, well-separated days (>1 apart) so a
    // legitimate batch payout keeps a small candidate set (<= cap) while the
    // fraud payouts alone exceed it. Otherwise tiny fraud-fan entries would
    // pollute a nearby batch's candidates and trip the cap on a legit payout.
    const BATCH_DAYS = [1, 8];
    const FRAUD_DAYS = [4, 11];
    {
      const recs: unknown[] = [];
      for (let g = 0; g < PLAN.batchGroups; g++) {
        const d = BATCH_DAYS[g % BATCH_DAYS.length]!, when = businessTime(d, rand);
        const parts = [amountCents(rand), amountCents(rand), amountCents(rand)];
        const total = parts.reduce((a, b) => a + b, 0);
        const payout = stripeBalanceTxn({ rand, amount: total, created: when, type: "payout", reportingCategory: "payout", description: "Batched payout" });
        stripeRaw.push(payout);
        const memberRefs = parts.map((p) => {
          const l = ledgerEntry({ rand, amountMinor: p, postedAt: businessTime(d, rand) });
          ledgerRaw.push(l);
          return l.reference;
        });
        recs.push({ payout_id: payout.id, member_ledger_ids: memberRefs, total_minor: total });
      }
      tolerant += PLAN.batchGroups * 4; // 1 payout + 3 members each
      patterns.push({ pattern: "batched_payout", count: PLAN.batchGroups * 4, expected_outcome: "tolerant:batch", records: recs });
    }

    // 6. Partial capture: stripe capture < ledger auth, dates differ >1 day. -> AI
    {
      for (let i = 0; i < PLAN.partialPairs; i++) {
        const auth = amountCents(rand), d = day();
        const capture = Math.floor(auth * (0.6 + rand() * 0.3) + 0.5);
        const pi = token("pi_", rand);
        stripeRaw.push(stripeBalanceTxn({ rand, amount: capture, created: businessTime(d, rand), paymentIntent: pi, description: "Partial capture" }));
        ledgerRaw.push(ledgerEntry({ rand, amountMinor: auth, postedAt: businessTime(Math.max(d - 2, 0), rand) }));
      }
      ai += PLAN.partialPairs * 2;
      patterns.push({ pattern: "partial_capture", count: PLAN.partialPairs * 2, expected_outcome: "ai_explain", records: [] });
    }

    // 7. Missing on one side: stripe charge with no ledger entry. -> AI (failed webhook)
    {
      for (let i = 0; i < PLAN.missingStripe; i++) {
        stripeRaw.push(stripeBalanceTxn({ rand, amount: amountCents(rand), created: businessTime(day(), rand), description: "No ledger counterpart" }));
      }
      ai += PLAN.missingStripe;
      patterns.push({ pattern: "missing_one_side", count: PLAN.missingStripe, expected_outcome: "ai_explain", records: [] });
    }

    // 8. Refund: negative stripe amount, no reversal on the ledger yet. -> AI
    {
      for (let i = 0; i < PLAN.refundStripe; i++) {
        const amt = -amountCents(rand);
        stripeRaw.push(stripeBalanceTxn({ rand, amount: amt, created: businessTime(day(), rand), type: "refund", reportingCategory: "refund", description: "Refund, no ledger reversal" }));
      }
      ai += PLAN.refundStripe;
      patterns.push({ pattern: "refund", count: PLAN.refundStripe, expected_outcome: "ai_explain", records: [] });
    }

    // 9. Fraud flag: one payout whose amount could sum many (>10) ledger entries.
    // The batch matcher must see >10 candidates and BAIL to a fraud flag rather
    // than search combinatorially. The payout is flagged; its fan-out ledger
    // entries fall through to AI as residue.
    {
      const recs: unknown[] = [];
      for (let g = 0; g < PLAN.fraudGroups; g++) {
        const d = FRAUD_DAYS[g % FRAUD_DAYS.length]!, when = businessTime(d, rand);
        let total = 0;
        const memberRefs: unknown[] = [];
        for (let k = 0; k < PLAN.fraudFan; k++) {
          const small = 500 + Math.floor(rand() * 3000); // $5–$35, small entries
          total += small;
          const l = ledgerEntry({ rand, amountMinor: small, postedAt: businessTime(d, rand) });
          ledgerRaw.push(l);
          memberRefs.push(l.reference);
        }
        const payout = stripeBalanceTxn({ rand, amount: total, created: when, type: "payout", reportingCategory: "payout", description: "Suspicious high-fan payout" });
        stripeRaw.push(payout);
        recs.push({ payout_id: payout.id, candidate_count: PLAN.fraudFan, note: "Abnormally high candidate count" });
      }
      fraud += PLAN.fraudGroups;                    // payouts flagged
      ai += PLAN.fraudGroups * PLAN.fraudFan;       // fan-out ledger entries -> AI residue
      patterns.push({ pattern: "fraud_flag", count: PLAN.fraudGroups * (1 + PLAN.fraudFan), expected_outcome: "flag_fraud", records: recs });
    }

    // --- Normalise all raw payloads through the SAME mappings the live adapters
    // use, proving the normalisation layer on production-shaped data. ---
    const toInsert: Transaction[] = [];
    for (const raw of stripeRaw) {
      const n = normalise(raw, STRIPE_MAPPING);
      if (!n.ok) return err(new Error(`seed stripe normalise failed: ${n.error.message}`));
      toInsert.push(n.value);
    }
    for (const raw of ledgerRaw) {
      const n = normalise(raw, LEDGER_MAPPING);
      if (!n.ok) return err(new Error(`seed ledger normalise failed: ${n.error.message}`));
      toInsert.push(n.value);
    }

    // Idempotency: reset prior reconciliation data, then insert (F2).
    const cleared = await this.txns.resetReconciliationData();
    if (!cleared.ok) return err(cleared.error);
    const inserted = await this.txns.insertMany(toInsert);
    if (!inserted.ok) return err(inserted.error);

    const total = toInsert.length;
    const matched = exact + tolerant;
    const manifest: SeedManifest = {
      generated_at: new Date().toISOString(),
      window: { start: WINDOW_START.toISOString(), end: WINDOW_END.toISOString() },
      total_records: total,
      patterns,
      expected_results: {
        exact_matches: exact,
        tolerant_matches: tolerant,
        ai_explained: ai,
        fraud_flagged: fraud,
        total_matched_pct: `${Math.floor((matched / total) * 100 + 0.5)}%`,
      },
    };

    // Persist the manifest to disk (F1/F2 verification hook) and return it.
    const outPath = path.resolve(process.cwd(), "seed-manifest.json");
    await writeFile(outPath, JSON.stringify(manifest, null, 2), "utf8");
    return ok(manifest);
  }
}
