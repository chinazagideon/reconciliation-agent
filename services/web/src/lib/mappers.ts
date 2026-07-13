// DTO → view-model mappers.
//
// THE translation seam. This is the ONLY module allowed to touch raw wire/DB
// field names (amount_minor, window_start, occurred_at, per_page, *_count …).
// Everything downstream consumes the camelCase, display-ready view models in
// ./view-models. All formatting (money, dates, confidence labels) is applied
// here via the helpers in ./utils, so components never format anything.

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
  PaginatedResponse,
} from "@resolution/shared";
import type {
  TransactionVM,
  RunVM,
  MatchVM,
  ExplanationVM,
  ReviewItemVM,
  AuditEntryVM,
  DashboardVM,
  DashboardCategoryVM,
  PatternVM,
  SeedManifestVM,
  Page,
} from "./view-models";
import {
  formatMoney,
  formatDate,
  formatDateTime,
  formatTimeAgo,
  confidenceLabel,
} from "./utils";

// ── Transaction ────────────────────────────────────────────────
export function toTransactionVM(dto: Transaction): TransactionVM {
  return {
    id: dto.id,
    source: dto.source,
    externalId: dto.external_id,
    amountFormatted: formatMoney(dto.amount_minor, dto.currency),
    amountMinor: dto.amount_minor,
    currency: dto.currency,
    occurredOn: formatDate(dto.occurred_at),
    occurredAtIso: dto.occurred_at,
    raw: dto.raw,
  };
}

// ── Reconciliation Run ─────────────────────────────────────────
export function toRunVM(dto: ReconciliationRun): RunVM {
  return {
    id: dto.id,
    windowLabel: `${formatDate(dto.window_start)} – ${formatDate(dto.window_end)}`,
    status: dto.status,
    aiSkipped: dto.ai_skipped,
    matchedCount: dto.matched_count,
    unmatchedCount: dto.unmatched_count,
    explainedCount: dto.explained_count,
    reviewCount: dto.review_count,
    fraudCount: dto.fraud_count,
    totalCount: dto.total_count,
    createdAgo: formatTimeAgo(dto.created_at),
    updatedAgo: formatTimeAgo(dto.updated_at),
  };
}

// ── Match ──────────────────────────────────────────────────────
export function toMatchVM(dto: Match): MatchVM {
  return {
    id: dto.id,
    runId: dto.run_id,
    strategy: dto.strategy,
    createdAgo: formatTimeAgo(dto.created_at),
    left: dto.left ? toTransactionVM(dto.left) : undefined,
    right: dto.right ? toTransactionVM(dto.right) : undefined,
  };
}

// ── Agent Explanation ──────────────────────────────────────────
export function toExplanationVM(dto: AgentExplanation): ExplanationVM {
  return {
    id: dto.id,
    runId: dto.run_id,
    transactionId: dto.transaction_id,
    hypothesis: dto.hypothesis,
    confidence: dto.confidence,
    confidenceLabel: confidenceLabel(dto.confidence),
    suggestedAction: dto.suggested_action,
    needsHuman: dto.needs_human,
    transaction: dto.transaction ? toTransactionVM(dto.transaction) : undefined,
  };
}

// ── Review Item ────────────────────────────────────────────────
export function toReviewItemVM(dto: ReviewItem): ReviewItemVM {
  return {
    transaction: toTransactionVM(dto.transaction),
    explanation: dto.explanation ? toExplanationVM(dto.explanation) : undefined,
    flagReason: dto.flag_reason,
    candidateCount: dto.candidate_count,
  };
}

// ── Audit Entry ────────────────────────────────────────────────
export function toAuditEntryVM(dto: AuditEntry): AuditEntryVM {
  return {
    id: dto.id,
    when: formatDateTime(dto.at),
    whenIso: dto.at,
    actor: dto.actor,
    event: dto.event,
    entityId: dto.entity_id,
    detail: dto.detail,
    detailSummary: summariseDetail(dto),
  };
}

// Render the freeform `detail` JSONB into a single readable line.
function summariseDetail(dto: AuditEntry): string {
  const parts: string[] = [];
  if (dto.entity_id) parts.push(dto.entity_id);
  for (const [k, v] of Object.entries(dto.detail ?? {})) {
    parts.push(`${k}: ${String(v)}`);
  }
  return parts.join(" · ");
}

// ── Dashboard ──────────────────────────────────────────────────
function toCategoryVM(count: number, total: number): DashboardCategoryVM {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return { count, percentage: `${pct.toFixed(1)}%` };
}

export function toDashboardVM(dto: DashboardMetrics): DashboardVM {
  const total = dto.total;
  return {
    total,
    matched: toCategoryVM(dto.matched, total),
    unmatched: toCategoryVM(dto.unmatched, total),
    explained: toCategoryVM(dto.explained, total),
    review: toCategoryVM(dto.review, total),
    fraud: toCategoryVM(dto.fraud, total),
  };
}

export function toPatternVM(dto: PatternDistribution): PatternVM {
  return {
    pattern: dto.pattern,
    count: dto.count,
    percentage: dto.percentage,
  };
}

// ── Seed Manifest ──────────────────────────────────────────────
export function toSeedManifestVM(dto: SeedManifest): SeedManifestVM {
  return {
    generatedAgo: formatTimeAgo(dto.generated_at),
    windowLabel: `${formatDate(dto.window.start)} – ${formatDate(dto.window.end)}`,
    totalRecords: dto.total_records,
    expected: {
      exactMatches: dto.expected_results.exact_matches,
      tolerantMatches: dto.expected_results.tolerant_matches,
      aiExplained: dto.expected_results.ai_explained,
      fraudFlagged: dto.expected_results.fraud_flagged,
      totalMatchedPct: dto.expected_results.total_matched_pct,
    },
  };
}

// ── Pagination ─────────────────────────────────────────────────
// Reshape a raw PaginatedResponse<DTO> into a camelCased Page<VM>, mapping
// every element through the provided item mapper.
export function toPage<DTO, VM>(
  res: PaginatedResponse<DTO>,
  mapItem: (dto: DTO) => VM,
): Page<VM> {
  return {
    items: res.data.map(mapItem),
    total: res.total,
    page: res.page,
    perPage: res.per_page,
  };
}
