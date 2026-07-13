"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchMatches, fetchExplanations } from "@/lib/api";
import { toMatchVM, toExplanationVM, toPage } from "@/lib/mappers";
import type { MatchVM, ExplanationVM, Page } from "@/lib/view-models";
import { qk } from "./query-keys";

// Deterministic matches within a run → Page<MatchVM>.
// `enabled` lets the run-detail page fetch only the active tab's data.
export function useMatches(
  runId: string | undefined,
  page = 1,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.runs.matches(runId ?? "—", page),
    queryFn: () => fetchMatches(runId as string, page),
    enabled: !!runId && enabled,
    placeholderData: keepPreviousData,
    select: (res): Page<MatchVM> => toPage(res, toMatchVM),
  });
}

// AI explanations within a run → Page<ExplanationVM>.
export function useExplanations(
  runId: string | undefined,
  page = 1,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.runs.explanations(runId ?? "—", page),
    queryFn: () => fetchExplanations(runId as string, page),
    enabled: !!runId && enabled,
    placeholderData: keepPreviousData,
    select: (res): Page<ExplanationVM> => toPage(res, toExplanationVM),
  });
}
