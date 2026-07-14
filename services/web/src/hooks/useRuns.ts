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
import type { CreateRunRequest } from "@resolution/shared";
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
    select: (res): RunVM => toRunVM(res.data.run),
  });
}

// Start a new run. Resolves to the new run's id — the POST returns only
// { status, runId }, not the run itself, so there is nothing to map to a VM
// here; the detail page fetches the run with this id.
export function useCreateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRunRequest) =>
      createRun(input).then((res) => res.data.runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.runs.all });
      qc.invalidateQueries({ queryKey: qk.dashboard.all });
    },
  });
}
