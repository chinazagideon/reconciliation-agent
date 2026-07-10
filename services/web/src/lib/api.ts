// API client for the Resolution AI core service.
// Every HTTP call to the backend lives here — components never call fetch
// directly. This makes it trivial to swap the base URL, add auth headers,
// or mock the API layer in tests.

import type {
  ReconciliationRun,
  Transaction,
  Match,
  AgentExplanation,
  ReviewItem,
  ReviewAction,
  AuditEntry,
  DashboardMetrics,
  PatternDistribution,
  SeedManifest,
  ApiResponse,
  PaginatedResponse,
} from "@resolution/shared";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// ── Internal fetch wrapper ─────────────────────────────────────
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${path} — ${body}`);
  }

  return res.json() as Promise<T>;
}

// ── Dashboard ──────────────────────────────────────────────────
export function fetchDashboardMetrics() {
  return api<ApiResponse<DashboardMetrics>>("/dashboard/metrics");
}

export function fetchPatternDistribution() {
  return api<ApiResponse<PatternDistribution[]>>("/dashboard/patterns");
}

// ── Runs ───────────────────────────────────────────────────────
export function fetchRuns(page = 1, perPage = 20) {
  return api<PaginatedResponse<ReconciliationRun>>(
    `/reconciliations?page=${page}&per_page=${perPage}`,
  );
}

export function fetchRun(id: string) {
  return api<ApiResponse<ReconciliationRun>>(`/reconciliations/${id}`);
}

export function createRun(body: {
  window_start: string;
  window_end: string;
  sources: string[];
}) {
  return api<ApiResponse<ReconciliationRun>>("/reconciliations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Matches (within a run) ─────────────────────────────────────
export function fetchMatches(runId: string, page = 1) {
  return api<PaginatedResponse<Match>>(
    `/reconciliations/${runId}/matches?page=${page}`,
  );
}

// ── Explanations (within a run) ────────────────────────────────
export function fetchExplanations(runId: string, page = 1) {
  return api<PaginatedResponse<AgentExplanation>>(
    `/reconciliations/${runId}/explanations?page=${page}`,
  );
}

// ── Review items (within a run) ────────────────────────────────
export function fetchReviewItems(runId: string) {
  return api<ApiResponse<ReviewItem[]>>(
    `/reconciliations/${runId}/review`,
  );
}

export function submitReview(runId: string, action: ReviewAction) {
  return api<ApiResponse<void>>(`/reconciliations/${runId}/review`, {
    method: "POST",
    body: JSON.stringify(action),
  });
}

// ── Fraud items (within a run) ─────────────────────────────────
export function fetchFraudItems(runId: string) {
  return api<ApiResponse<ReviewItem[]>>(
    `/reconciliations/${runId}/fraud`,
  );
}

// ── Transactions ───────────────────────────────────────────────
export function fetchTransaction(id: string) {
  return api<ApiResponse<Transaction>>(`/transactions/${id}`);
}

export function fetchTransactionAudit(id: string) {
  return api<ApiResponse<AuditEntry[]>>(`/transactions/${id}/audit`);
}

// ── Audit log ──────────────────────────────────────────────────
export function fetchAuditLog(params?: {
  page?: number;
  event?: string;
  actor?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.event) qs.set("event", params.event);
  if (params?.actor) qs.set("actor", params.actor);
  return api<PaginatedResponse<AuditEntry>>(`/audit?${qs}`);
}

// ── Settings / seed ────────────────────────────────────────────
export function generateSeedData() {
  return api<ApiResponse<SeedManifest>>("/seed", { method: "POST" });
}

export function resetAllData() {
  return api<ApiResponse<void>>("/reset", { method: "POST" });
}

// ── CSV upload ─────────────────────────────────────────────────
export function uploadCsv(file: File, mapping: Record<string, string>) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mapping", JSON.stringify(mapping));

  return fetch(`${BASE}/ingest/csv`, {
    method: "POST",
    body: formData,
    // No Content-Type header — browser sets multipart boundary automatically
  }).then((res) => {
    if (!res.ok) throw new Error(`CSV upload failed: ${res.status}`);
    return res.json() as Promise<ApiResponse<{ imported: number; rejected: number }>>;
  });
}
