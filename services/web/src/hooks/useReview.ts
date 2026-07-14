"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchRun, submitReview } from "@/lib/api";
import { toReviewItemVM } from "@/lib/mappers";
import type { ReviewItemVM } from "@/lib/view-models";
import type { ReviewAction } from "@resolution/shared";
import { qk } from "./query-keys";

// Like the tabs in useMatches: a projection of the one run-detail query, not a
// request of its own.
function useRunTab(
  runId: string | undefined,
  tab: "review" | "fraud",
) {
  return useQuery({
    queryKey: qk.runs.detail(runId ?? "—"),
    queryFn: () => fetchRun(runId as string),
    enabled: !!runId,
    select: (res): ReviewItemVM[] => res.data.tabs[tab].map(toReviewItemVM),
  });
}

// Items awaiting human decision → ReviewItemVM[].
export function useReviewItems(runId: string | undefined) {
  return useRunTab(runId, "review");
}

// Fraud-flagged items → ReviewItemVM[].
export function useFraudItems(runId: string | undefined) {
  return useRunTab(runId, "fraud");
}

// Approve / override / dismiss ONE review item. The action targets the review
// item by id (POST /review-items/:id/action) — the run id is only here so the
// right cache entries get invalidated afterwards.
export function useSubmitReview(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { reviewItemId: string; action: ReviewAction }) =>
      submitReview(vars.reviewItemId, vars.action),
    onSuccess: () => {
      // The tabs live inside the run detail payload, so invalidating it
      // refreshes the review list, the fraud list and the counts together.
      qc.invalidateQueries({ queryKey: qk.runs.detail(runId) });
      qc.invalidateQueries({ queryKey: qk.runs.all });
      qc.invalidateQueries({ queryKey: qk.dashboard.all });
    },
  });
}
