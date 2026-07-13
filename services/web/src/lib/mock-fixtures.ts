// Deterministic in-memory fixtures for the dev/demo mock API.
//
// These are RAW wire shapes (@resolution/shared) — snake_case, integer minor
// units, ISO strings — exactly what the real backend will return. They live
// here (not in components) alongside mappers.ts as the only place raw columns
// appear. The catch-all route handler in app/api/mock serves them.

import type {
  Transaction,
  ReconciliationRun,
  Match,
  AgentExplanation,
  ReviewItem,
  AuditEntry,
  DashboardMetrics,
  PatternDistribution,
  SeedManifest,
} from "@resolution/shared";

// ── Transactions ───────────────────────────────────────────────
export const transactions: Transaction[] = [
  {
    id: "TXN-0801",
    source: "stripe",
    external_id: "pi_3N7xA2eZvKYlo2C0",
    amount_minor: 15000,
    currency: "CAD",
    occurred_at: "2026-06-25T14:02:00Z",
    raw: { type: "charge", description: "Move booking #MB-2026-0847", fee: 457 },
    created_at: "2026-07-01T09:14:01Z",
  },
  {
    id: "TXN-0847",
    source: "stripe",
    external_id: "pi_3N7xB9eZvKYlo2C0",
    amount_minor: 14723,
    currency: "CAD",
    occurred_at: "2026-06-27T11:20:00Z",
    raw: { type: "charge", description: "Move booking #MB-2026-0847", fee: 457, net: 14266 },
    created_at: "2026-07-01T09:14:02Z",
  },
  {
    id: "TXN-0852",
    source: "ledger",
    external_id: "LED-20260628-042",
    amount_minor: 20000,
    currency: "CAD",
    occurred_at: "2026-06-28T00:00:00Z",
    raw: { memo: "Manual offline payment" },
    created_at: "2026-07-01T09:14:03Z",
  },
  {
    id: "TXN-0902",
    source: "payout",
    external_id: "po_1P2qLdeZvKYlo2C0",
    amount_minor: 1205800,
    currency: "CAD",
    occurred_at: "2026-06-30T08:00:00Z",
    raw: { batch: "payout_2026_06_30", count: 42 },
    created_at: "2026-07-01T09:14:04Z",
  },
];

const txById = new Map(transactions.map((t) => [t.id, t]));

// ── Runs ───────────────────────────────────────────────────────
export const runs: ReconciliationRun[] = [
  {
    id: "run_2026w26",
    window_start: "2026-06-24T00:00:00Z",
    window_end: "2026-06-30T23:59:59Z",
    status: "done",
    ai_skipped: false,
    matched_count: 180,
    unmatched_count: 15,
    explained_count: 8,
    review_count: 4,
    fraud_count: 2,
    total_count: 195,
    created_at: "2026-07-01T09:14:00Z",
    updated_at: "2026-07-01T09:15:10Z",
  },
  {
    id: "run_2026w25",
    window_start: "2026-06-17T00:00:00Z",
    window_end: "2026-06-23T23:59:59Z",
    status: "done",
    ai_skipped: false,
    matched_count: 162,
    unmatched_count: 6,
    explained_count: 4,
    review_count: 2,
    fraud_count: 0,
    total_count: 168,
    created_at: "2026-06-24T10:00:00Z",
    updated_at: "2026-06-24T10:01:30Z",
  },
  {
    id: "run_2026w24",
    window_start: "2026-06-10T00:00:00Z",
    window_end: "2026-06-16T23:59:59Z",
    status: "failed",
    ai_skipped: true,
    matched_count: 0,
    unmatched_count: 0,
    explained_count: 0,
    review_count: 0,
    fraud_count: 0,
    total_count: 0,
    created_at: "2026-06-17T08:00:00Z",
    updated_at: "2026-06-17T08:00:20Z",
  },
];

const runById = new Map(runs.map((r) => [r.id, r]));

// ── Matches ────────────────────────────────────────────────────
export const matches: Match[] = [
  {
    id: "match_0001",
    run_id: "run_2026w26",
    left_transaction_id: "TXN-0801",
    right_transaction_id: "TXN-0847",
    strategy: "tolerant:fee",
    created_at: "2026-07-01T09:14:55Z",
    left: txById.get("TXN-0801"),
    right: txById.get("TXN-0847"),
  },
];

// ── Explanations ───────────────────────────────────────────────
export const explanations: AgentExplanation[] = [
  {
    id: "exp_0001",
    run_id: "run_2026w26",
    transaction_id: "TXN-0847",
    hypothesis:
      "Likely the capture of a $150.00 authorization from Jun 25 (TXN-0801). The $2.77 difference matches a promotional discount applied at checkout.",
    confidence: 0.62,
    suggested_action: "match_with:TXN-0801",
    needs_human: true,
    created_at: "2026-07-01T09:15:02Z",
    transaction: txById.get("TXN-0847"),
  },
  {
    id: "exp_0002",
    run_id: "run_2026w26",
    transaction_id: "TXN-0852",
    hypothesis:
      "No matching Stripe charge found. This may be a manual ledger entry for an offline payment collected outside the platform.",
    confidence: 0.23,
    suggested_action: "investigate",
    needs_human: true,
    created_at: "2026-07-01T09:15:03Z",
    transaction: txById.get("TXN-0852"),
  },
];

// ── Review items ───────────────────────────────────────────────
export const reviewItems: ReviewItem[] = [
  {
    transaction: txById.get("TXN-0847")!,
    explanation: explanations[0],
    flag_reason: "low_confidence",
  },
  {
    transaction: txById.get("TXN-0852")!,
    explanation: explanations[1],
    flag_reason: "low_confidence",
  },
];

// ── Fraud items ────────────────────────────────────────────────
export const fraudItems: ReviewItem[] = [
  {
    transaction: txById.get("TXN-0902")!,
    flag_reason: "fraud",
    candidate_count: 14,
  },
];

// ── Audit log ──────────────────────────────────────────────────
export const auditEntries: AuditEntry[] = [
  { id: 6, at: "2026-07-01T10:32:14Z", actor: "user:chinaza", event: "review.approved", entity_id: "TXN-0847", detail: { decision: "approved" } },
  { id: 5, at: "2026-07-01T09:15:02Z", actor: "system:agent", event: "explained", entity_id: "TXN-0847", detail: { confidence: 0.62 } },
  { id: 4, at: "2026-07-01T09:14:55Z", actor: "system:exact_matcher", event: "match.created", entity_id: "match_0001", detail: { left: "TXN-0801", right: "TXN-0847" } },
  { id: 3, at: "2026-07-01T09:14:10Z", actor: "system:agent", event: "flag_fraud", entity_id: "TXN-0902", detail: { candidates: 14 } },
  { id: 2, at: "2026-07-01T09:14:01Z", actor: "system:stripe", event: "ingested", detail: { records: 195 } },
  { id: 1, at: "2026-07-01T09:14:00Z", actor: "system", event: "run.started", entity_id: "run_2026w26", detail: { window: "Jun 24–30" } },
];

// Per-transaction audit trail (subset filtered by entity_id at request time).
export const transactionAudit: Record<string, AuditEntry[]> = {
  "TXN-0847": [
    { id: 102, at: "2026-07-01T09:14:02Z", actor: "system:stripe", event: "ingested", entity_id: "TXN-0847", detail: {} },
    { id: 103, at: "2026-07-01T09:15:02Z", actor: "system:agent", event: "explained", entity_id: "TXN-0847", detail: { confidence: 0.62 } },
    { id: 104, at: "2026-07-01T10:32:14Z", actor: "user:chinaza", event: "review.approved", entity_id: "TXN-0847", detail: { decision: "approved" } },
  ],
};

// ── Dashboard ──────────────────────────────────────────────────
export const dashboardMetrics: DashboardMetrics = {
  matched: 342,
  unmatched: 8,
  explained: 8,
  review: 4,
  fraud: 2,
  total: 364,
};

export const patternDistribution: PatternDistribution[] = [
  { pattern: "Timing", count: 153, percentage: 42 },
  { pattern: "Fee gaps", count: 102, percentage: 28 },
  { pattern: "Missing", count: 55, percentage: 15 },
  { pattern: "Partial capture", count: 36, percentage: 10 },
  { pattern: "Other", count: 18, percentage: 5 },
];

// ── Seed manifest ──────────────────────────────────────────────
export const seedManifest: SeedManifest = {
  generated_at: new Date().toISOString(),
  window: { start: "2026-06-24T00:00:00Z", end: "2026-06-30T23:59:59Z" },
  total_records: 200,
  expected_results: {
    exact_matches: 168,
    tolerant_matches: 14,
    ai_explained: 8,
    fraud_flagged: 2,
    total_matched_pct: "93.4%",
  },
};

// ── Lookups used by the route handler ──────────────────────────
export function getRun(id: string) {
  return runById.get(id);
}
export function getTransaction(id: string) {
  return txById.get(id);
}
export function getTransactionAudit(id: string) {
  return transactionAudit[id] ?? [];
}
