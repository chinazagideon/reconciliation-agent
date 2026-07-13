// Shared types between Resolution AI services.
// This is the single source of truth for domain shapes that cross service
// boundaries. The API serialises these; the frontend deserialises them.
// Only SHAPES live here — no logic, no validation, no imports from any service.

// ── Money ──────────────────────────────────────────────────────
// Integer minor units (cents). Never a float. Ever.
export type Money = number; // branded in core service; plain number at the boundary
export type CurrencyCode = string; // ISO 4217, e.g. "CAD"

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
export interface Match {
  id: string;
  run_id: string;
  left_transaction_id: string;
  right_transaction_id: string;
  strategy: MatchStrategy;
  created_at: string;
  // populated on detail views
  left?: Transaction;
  right?: Transaction;
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
// A transaction awaiting human decision (low confidence or fraud flag).
export interface ReviewItem {
  transaction: Transaction;
  explanation?: AgentExplanation; // absent if AI was skipped or fraud-flagged
  flag_reason?: "low_confidence" | "ai_skipped" | "fraud";
  candidate_count?: number; // present when flag_reason is "fraud"
}

// ── Review Action ──────────────────────────────────────────────
// What the human decided to do with a review item.
export interface ReviewAction {
  transaction_id: string;
  action: "approve" | "override" | "dismiss";
  override_explanation?: string; // required when action is "override"
  override_action?: string;
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
export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}
