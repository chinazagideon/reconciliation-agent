"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchReviewItems, fetchFraudItems, submitReview } from "@/lib/api";
import { toReviewItemVM } from "@/lib/mappers";
import type { ReviewItemVM } from "@/lib/view-models";
import type { ReviewAction } from "@resolution/shared";
import { qk } from "./query-keys";

// Items awaiting human decision → ReviewItemVM[].
export function useReviewItems(runId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.runs.review(runId ?? "—"),
    queryFn: () => fetchReviewItems(runId as string),
    enabled: !!runId && enabled,
    select: (res): ReviewItemVM[] => res.data.map(toReviewItemVM),
  });
}

// Fraud-flagged items → ReviewItemVM[].
export function useFraudItems(runId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.runs.fraud(runId ?? "—"),
    queryFn: () => fetchFraudItems(runId as string),
    enabled: !!runId && enabled,
    select: (res): ReviewItemVM[] => res.data.map(toReviewItemVM),
  });
}

// Approve / override / dismiss a review item. On success, invalidate the
// review + fraud lists, the run's metrics, and the dashboard totals.
export function useSubmitReview(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: ReviewAction) => submitReview(runId, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.runs.review(runId) });
      qc.invalidateQueries({ queryKey: qk.runs.fraud(runId) });
      qc.invalidateQueries({ queryKey: qk.runs.detail(runId) });
      qc.invalidateQueries({ queryKey: qk.dashboard.all });
    },
  });
}
