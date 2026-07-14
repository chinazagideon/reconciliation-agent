"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRun } from "@/lib/api";
import { toMatchVM, toReviewItemVM } from "@/lib/mappers";
import type { MatchVM, ReviewItemVM } from "@/lib/view-models";
import { qk } from "./query-keys";

// The run detail endpoint returns the run AND all four tabs in one payload, so
// every tab hook here is a different `select` over that ONE query. They share a
// query key, which means React Query serves them all from a single request and
// a single cache entry — switching tabs refetches nothing.
//
// There are no per-tab endpoints to call: /reconciliations/:id/matches and
// friends return 404.
function useRunTab<T>(
  runId: string | undefined,
  select: (res: Awaited<ReturnType<typeof fetchRun>>) => T,
) {
  return useQuery({
    queryKey: qk.runs.detail(runId ?? "—"),
    queryFn: () => fetchRun(runId as string),
    enabled: !!runId,
    select,
  });
}

// Deterministic matches within a run → MatchVM[].
export function useMatches(runId: string | undefined) {
  return useRunTab(runId, (res): MatchVM[] =>
    res.data.tabs.matched.map(toMatchVM),
  );
}

// AI-explained items within a run → ReviewItemVM[].
export function useExplanations(runId: string | undefined) {
  return useRunTab(runId, (res): ReviewItemVM[] =>
    res.data.tabs.explained.map(toReviewItemVM),
  );
}
