// Frontend view models (VMs).
//
// These are the ONLY shapes components are allowed to consume. They are
// camelCase and display-ready — every field is either already a string the
// UI renders verbatim, or a primitive the UI reasons about directly. The
// raw wire/DB shapes (snake_case, integer minor units, ISO timestamps) live
// in @resolution/shared and appear ONLY inside src/lib/mappers.ts.
//
// Keeping a hard boundary here means a backend column rename ripples through
// one mapper function, never through a dozen components.

import type {
  RunStatus,
  TransactionSource,
  MatchStrategy,
  SuggestedAction,
  AuditEvent,
} from "@resolution/shared";

// ── Transaction ────────────────────────────────────────────────
export interface TransactionVM {
  id: string;
  source: TransactionSource;
  externalId: string;
  amountFormatted: string; // "$147.23"
  amountMinor: number; // kept for the <Money> primitive (needs cents)
  currency: string;
  occurredOn: string; // "Jun 27, 2026"
  occurredAtIso: string; // raw ISO, for <time>/sorting if needed
  raw: Record<string, unknown>;
}

// ── Reconciliation Run ─────────────────────────────────────────
export interface RunVM {
  id: string;
  windowLabel: string; // "Jun 24 – Jun 30, 2026"
  status: RunStatus;
  aiSkipped: boolean;
  matchedCount: number;
  unmatchedCount: number;
  explainedCount: number;
  reviewCount: number;
  fraudCount: number;
  totalCount: number;
  createdAgo: string; // "3d ago"
  updatedAgo: string;
}

// ── Match ──────────────────────────────────────────────────────
export interface MatchVM {
  id: string;
  strategy: MatchStrategy;
  detail?: Record<string, unknown>; // e.g. { members: [...] } for a batch match
  left: TransactionVM;
  right: TransactionVM;
}

// ── Agent Explanation ──────────────────────────────────────────
// Never exists on its own — it is the AI half of a review item, present only
// when the AI actually produced a hypothesis.
export interface ExplanationVM {
  id: string;
  transactionId: string;
  hypothesis: string;
  confidence: number; // 0.0–1.0
  confidenceLabel: string; // "High"
  suggestedAction: SuggestedAction;
  needsHuman: boolean;
}

// ── Review Item ────────────────────────────────────────────────
export interface ReviewItemVM {
  id: string; // the review item's own id — what a review action targets
  kind: "ai" | "fraud";
  transaction: TransactionVM;
  explanation?: ExplanationVM; // absent for fraud flags and AI-skipped items
  flagReason?: "low_confidence" | "ai_skipped" | "fraud";
  candidateCount?: number;
  resolution?: string; // set once a human has acted
}

// ── Audit Entry ────────────────────────────────────────────────
export interface AuditEntryVM {
  id: number;
  when: string; // "Jul 1, 09:14:58"
  whenIso: string;
  actor: string;
  event: AuditEvent;
  entityId?: string;
  detail: Record<string, unknown>;
  detailSummary: string; // one-line rendering of `detail`
}

// ── Dashboard ──────────────────────────────────────────────────
export interface DashboardCategoryVM {
  count: number;
  percentage: string; // "93.4%"
}

export interface DashboardVM {
  total: number;
  matched: DashboardCategoryVM;
  unmatched: DashboardCategoryVM;
  explained: DashboardCategoryVM;
  review: DashboardCategoryVM;
  fraud: DashboardCategoryVM;
}

export interface PatternVM {
  pattern: string;
  count: number;
  percentage: number; // 0–100
}

// ── Seed Manifest ──────────────────────────────────────────────
export interface SeedManifestVM {
  generatedAgo: string;
  windowLabel: string;
  totalRecords: number;
  expected: {
    exactMatches: number;
    tolerantMatches: number;
    aiExplained: number;
    fraudFlagged: number;
    totalMatchedPct: string;
  };
}

// ── Paginated wrapper (camelCased) ─────────────────────────────
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}
