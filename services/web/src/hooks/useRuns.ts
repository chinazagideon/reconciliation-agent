"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { fetchRuns, fetchRun, createRun } from "@/lib/api";
import { toRunVM, toPage } from "@/lib/mappers";
import type { RunVM, Page } from "@/lib/view-models";
import { qk } from "./query-keys";

// Paginated list of runs → Page<RunVM>. keepPreviousData avoids a flash of
// the empty/loading state while paging.
export function useRuns(page = 1, perPage = 20) {
  return useQuery({
    queryKey: qk.runs.list(page, perPage),
    queryFn: () => fetchRuns(page, perPage),
    placeholderData: keepPreviousData,
    select: (res): Page<RunVM> => toPage(res, toRunVM),
  });
}

// A single run → RunVM. Disabled until an id is available.
export function useRun(id: string | undefined) {
  return useQuery({
    queryKey: qk.runs.detail(id ?? "—"),
    queryFn: () => fetchRun(id as string),
    enabled: !!id,
    select: (res): RunVM => toRunVM(res.data),
  });
}

// Input the UI works with — camelCase, like every other VM. The hook maps it
// to the wire request shape so components never write snake_case.
export interface CreateRunInput {
  windowStart: string;
  windowEnd: string;
  sources: string[];
}

// Start a new run. On success, invalidate the runs list + dashboard so the
// new run shows up immediately.
export function useCreateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRunInput) =>
      createRun({
        window_start: input.windowStart,
        window_end: input.windowEnd,
        sources: input.sources,
      }).then((res) => toRunVM(res.data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.runs.all });
      qc.invalidateQueries({ queryKey: qk.dashboard.all });
    },
  });
}
