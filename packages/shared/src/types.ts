// Shared types between Resolution AI services.
// This is the single source of truth for domain shapes that cross service
// boundaries. The API serialises these; the frontend deserialises them.
// Only SHAPES live here — no logic, no validation, no imports from any service.

// ── Money ──────────────────────────────────────────────────────
// Integer minor units (cents). Never a float. Ever.
export type Money = number; // branded in core service; plain number at the boundary
export type CurrencyCode = string; // ISO 4217, e.g. "CAD"

// What money actually looks like ON THE WIRE. Postgres serialises BIGINT as a
// string ("255362") to protect precision, and node-postgres passes it through
// untouched, so every amount arrives as a string. Mappers coerce it exactly
// once, at the boundary; nothing downstream should ever see this type.
export type MoneyWire = string | number;

// ── Transaction ────────────────────────────────────────────────
// A normalised record from any source, after FieldMapping ingestion.
export interface Transaction {
  id: string;
  source: TransactionSource;
  external_id: string;
  amount_minor: Money;
  currency: CurrencyCode;
  occurred_at: string; // ISO 8601
  raw: Record<string, unknown>; // original payload, for drill-down
  created_at: string;
}

export type TransactionSource = "stripe" | "ledger" | "payout" | "csv";

// ── Reconciliation Run ─────────────────────────────────────────
// One execution of the reconciliation pipeline over a date window.
export interface ReconciliationRun {
  id: string;
  window_start: string; // ISO 8601
  window_end: string;
  status: RunStatus;
  ai_skipped: boolean; // ADR-0006: true when sidecar was unavailable
  matched_count: number;
  unmatched_count: number;
  explained_count: number;
  review_count: number;
  fraud_count: number;
  total_count: number;
  created_at: string;
  updated_at: string;
}

export type RunStatus =
  | "pending"
  | "ingesting"
  | "matching"
  | "explaining"
  | "done"
  | "failed";

// ── Match ──────────────────────────────────────────────────────
// A pair of transactions linked by a deterministic matcher.
//
// The API flattens both sides into one row (a join, not a nesting) — this is
// the shape `listMatches` actually selects, so it is the shape declared here.
export interface Match {
  id: string;
  strategy: MatchStrategy;
  detail: Record<string, unknown> | null; // e.g. { members: [...] } for a batch
  left_id: string;
  left_source: TransactionSource;
  left_ref: string; // the source's own id (external_id)
  left_amount: MoneyWire;
  left_currency: CurrencyCode;
  left_at: string; // ISO 8601
  right_id: string;
  right_source: TransactionSource;
  right_ref: string;
  right_amount: MoneyWire;
  right_currency: CurrencyCode;
  right_at: string;
}

export type MatchStrategy =
  | "exact"
  | "tolerant:timing"
  | "tolerant:fee"
  | "tolerant:batch"
  | "human_approved";

// ── Agent Explanation ──────────────────────────────────────────
// AI sidecar's hypothesis about an unmatched transaction.
// A suggestion, never an authoritative decision (ADR-0005).
export interface AgentExplanation {
  id: string;
  run_id: string;
  transaction_id: string;
  hypothesis: string;
  confidence: number; // 0.0–1.0
  suggested_action: SuggestedAction;
  needs_human: boolean;
  created_at: string;
  // populated on detail views
  transaction?: Transaction;
}

export type SuggestedAction =
  | `match_with:${string}`
  | "flag_refund"
  | "flag_chargeback"
  | "flag_fraud"
  | "investigate"
  | "dismiss";

// ── Review Item ────────────────────────────────────────────────
// A transaction awaiting (or having received) a human decision. One flat row
// joining review_items to its transaction — again, the shape the API really
// sends. The AI columns are null for fraud flags and for items the AI skipped.
//
// This same row backs the Explained, Review and Fraud tabs; they differ only by
// the filter applied (`kind`, `needs_human`, `resolution`), not by shape.
export interface ReviewItem {
  id: string; // the review item's OWN id — what POST /review-items/:id/action takes
  kind: "ai" | "fraud";
  hypothesis: string | null;
  confidence: number | null; // 0.0–1.0
  suggested_action: SuggestedAction | null;
  needs_human: boolean;
  candidate_count: number | null; // set when the fraud heuristic fired
  resolution: string | null; // null while open; else approve / override / dismiss
  resolution_note: string | null;
  // the joined transaction, flattened
  txn_id: string;
  source: TransactionSource;
  external_id: string;
  amount_minor: MoneyWire;
  currency: CurrencyCode;
  occurred_at: string;
}

// ── Review Action ──────────────────────────────────────────────
// The body of POST /review-items/:id/action — what the human decided.
// The item is identified by the URL, not the body.
export interface ReviewAction {
  action: "approve" | "override" | "dismiss";
  actor?: string; // defaults to "user:demo" server-side
  note?: string; // the human's rationale; carried into the audit log
  matchWith?: string; // transaction id to pair with, when overriding into a match
}

// ── Audit Entry ────────────────────────────────────────────────
export interface AuditEntry {
  id: number;
  at: string; // ISO 8601
  actor: string; // "system:exact_matcher", "system:agent", "user:<id>"
  event: AuditEvent;
  entity_id?: string;
  detail: Record<string, unknown>;
}

export type AuditEvent =
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "ingested"
  | "match.created"
  | "flag_fraud"
  | "explained"
  | "review.approved"
  | "review.overridden"
  | "review.dismissed"
  | "seed.generated";

// ── Dashboard Metrics ──────────────────────────────────────────
export interface DashboardMetrics {
  matched: number;
  unmatched: number;
  explained: number;
  review: number;
  fraud: number;
  total: number;
}

export interface PatternDistribution {
  pattern: string;
  count: number;
  percentage: number;
}

// ── Seed Manifest ──────────────────────────────────────────────
export interface SeedManifest {
  generated_at: string;
  window: { start: string; end: string };
  total_records: number;
  expected_results: {
    exact_matches: number;
    tolerant_matches: number;
    ai_explained: number;
    fraud_flagged: number;
    total_matched_pct: string;
  };
}

// ── API Response Wrappers ──────────────────────────────────────
// Every response from core arrives in one of these two envelopes — a single
// value under `data`, or a list under `data` with its paging meta alongside.
// Enforced server-side by services/core/.../http/envelope.ts; if you find
// yourself reaching for a bespoke top-level key, that is the bug.
export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number; // rows matching the query, NOT rows in this page
  page: number;
  per_page: number;
}

// POST /reconciliations → ApiResponse<CreateRunResponse>.
// The request body is camelCase — unlike every other payload here — because
// that is what the controller parses. "queued" comes back with 202 when a
// worker picks the run up; "done" with 201 when it ran inline. Either way the
// run itself is then fetched via GET /reconciliations/:id.
export interface CreateRunRequest {
  windowStart: string; // ISO 8601
  windowEnd: string;
}

export interface CreateRunResponse {
  status: "queued" | "done";
  runId: string;
}

// GET /reconciliations/:id → ApiResponse<RunDetail>.
// The tabs ship WITH the run, so the detail page needs exactly one request:
// there are no per-tab endpoints, and asking for them returns 404.
export interface RunDetail {
  run: ReconciliationRun;
  tabs: {
    matched: Match[];
    explained: ReviewItem[]; // AI-explained, no human needed
    review: ReviewItem[]; // open and awaiting a human
    fraud: ReviewItem[];
  };
}
