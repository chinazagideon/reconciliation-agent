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
  ReviewItem,
  AuditEntry,
  MoneyWire,
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

// Postgres hands BIGINT back as a string to protect precision, so every amount
// arrives as "255362", not 255362. Coerce here — once, at the seam — because a
// string that reaches <Money> silently renders as NaN rather than throwing.
function toMinor(wire: MoneyWire): number {
  return typeof wire === "number" ? wire : Number(wire);
}

// ── Transaction ────────────────────────────────────────────────
export function toTransactionVM(dto: Transaction): TransactionVM {
  return {
    id: dto.id,
    source: dto.source,
    externalId: dto.external_id,
    amountFormatted: formatMoney(toMinor(dto.amount_minor), dto.currency),
    amountMinor: toMinor(dto.amount_minor),
    currency: dto.currency,
    occurredOn: formatDate(dto.occurred_at),
    occurredAtIso: dto.occurred_at,
    raw: dto.raw ?? {},
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
// The wire row is a flat join (left_* / right_*); the VM re-nests it into the
// two sides the UI actually renders.
export function toMatchVM(dto: Match): MatchVM {
  return {
    id: dto.id,
    strategy: dto.strategy,
    detail: dto.detail ?? undefined,
    left: {
      id: dto.left_id,
      source: dto.left_source,
      externalId: dto.left_ref,
      amountFormatted: formatMoney(toMinor(dto.left_amount), dto.left_currency),
      amountMinor: toMinor(dto.left_amount),
      currency: dto.left_currency,
      occurredOn: formatDate(dto.left_at),
      occurredAtIso: dto.left_at,
      raw: {},
    },
    right: {
      id: dto.right_id,
      source: dto.right_source,
      externalId: dto.right_ref,
      amountFormatted: formatMoney(toMinor(dto.right_amount), dto.right_currency),
      amountMinor: toMinor(dto.right_amount),
      currency: dto.right_currency,
      occurredOn: formatDate(dto.right_at),
      occurredAtIso: dto.right_at,
      raw: {},
    },
  };
}

// ── Review Item ────────────────────────────────────────────────
// One flat row backs the Explained, Review and Fraud tabs. The transaction is
// re-nested, and the AI columns — null for fraud flags and skipped items — are
// folded into an optional `explanation`.
export function toReviewItemVM(dto: ReviewItem): ReviewItemVM {
  return {
    id: dto.id,
    kind: dto.kind,
    transaction: {
      id: dto.txn_id,
      source: dto.source,
      externalId: dto.external_id,
      amountFormatted: formatMoney(toMinor(dto.amount_minor), dto.currency),
      amountMinor: toMinor(dto.amount_minor),
      currency: dto.currency,
      occurredOn: formatDate(dto.occurred_at),
      occurredAtIso: dto.occurred_at,
      raw: {},
    },
    explanation: toExplanationVM(dto),
    flagReason: toFlagReason(dto),
    candidateCount: dto.candidate_count ?? undefined,
    resolution: dto.resolution ?? undefined,
  };
}

// An explanation exists only when the AI actually produced one. A fraud flag or
// a skipped item carries null hypothesis/confidence, and rendering those as
// "0% confidence" would be a lie the operator might act on.
function toExplanationVM(dto: ReviewItem): ExplanationVM | undefined {
  if (dto.hypothesis == null || dto.confidence == null) return undefined;
  return {
    id: dto.id,
    transactionId: dto.txn_id,
    hypothesis: dto.hypothesis,
    confidence: dto.confidence,
    confidenceLabel: confidenceLabel(dto.confidence),
    suggestedAction: dto.suggested_action ?? "investigate",
    needsHuman: dto.needs_human,
  };
}

function toFlagReason(dto: ReviewItem): ReviewItemVM["flagReason"] {
  if (dto.kind === "fraud") return "fraud";
  if (dto.hypothesis == null) return "ai_skipped";
  return dto.needs_human ? "low_confidence" : undefined;
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
