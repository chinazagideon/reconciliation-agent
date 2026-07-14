"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDashboardMetrics, fetchPatternDistribution } from "@/lib/api";
import { toDashboardVM, toPatternVM } from "@/lib/mappers";
import type { DashboardVM, PatternVM } from "@/lib/view-models";
import { qk } from "./query-keys";

// Dashboard headline metrics → DashboardVM (counts + percentages).
export function useDashboardMetrics() {
  return useQuery({
    queryKey: qk.dashboard.metrics(),
    queryFn: () => fetchDashboardMetrics(),
    select: (res): DashboardVM => toDashboardVM(res.data),
  });
}

// Discrepancy-pattern distribution → PatternVM[].
export function usePatternDistribution() {
  return useQuery({
    queryKey: qk.dashboard.patterns(),
    queryFn: () => fetchPatternDistribution(),
    select: (res): PatternVM[] => res.data.map(toPatternVM),
  });
}
